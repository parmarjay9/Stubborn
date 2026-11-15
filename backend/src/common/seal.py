"""Daily seal: a locked copy of every log's latest fingerprint.

Once a day (and right after the sample account is loaded) we write, for each
device, how many entries its log has and the hash of the newest one. The file
goes to an S3 bucket with Object Lock, so it cannot be changed or deleted
during its retention period, not even by us.

Why it matters: the hash chain catches anyone who edits an entry. But someone
who controls the database could rebuild the whole chain with fresh hashes. The
sealed fingerprint was locked away before that, so it would no longer match.

Device ids are not stored in the seal. Each one is replaced by a salted
SHA-256, so the file does not reveal whose log is whose.
"""
import hashlib
import json
import os
from datetime import datetime, timezone

from common import config, db


def device_key(device_id: str) -> str:
    return hashlib.sha256(f"stubborn-seal:{device_id}".encode()).hexdigest()


def _canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def build_seal(heads: dict) -> dict:
    """heads: {deviceId: (count, headHash)} -> seal document."""
    devices = {device_key(d): {"count": count, "headHash": head} for d, (count, head) in heads.items()}
    return {
        "sealedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "devices": devices,
        "rootHash": hashlib.sha256(_canonical(devices).encode()).hexdigest(),
    }


def _heads_for(device_ids):
    heads = {}
    for device_id in device_ids:
        chain = db.store().list_shifts(device_id)
        if chain:
            heads[device_id] = (len(chain), chain[-1]["hash"])
    return heads


def seal_devices(device_ids=None) -> dict:
    """Seal the given devices, or every device when None. Returns a summary."""
    heads = db.store().scan_heads() if device_ids is None else _heads_for(device_ids)
    if not heads:
        return {"sealed": 0}
    doc = build_seal(heads)
    key = f"seals/{doc['sealedAt'].replace(':', '')}-{doc['rootHash'][:8]}.json"
    if config.LOCAL:
        db.store().put_seal({**doc, "key": key, "versionId": None, "retainUntil": None})
    else:
        import boto3
        s3 = boto3.client("s3")
        put = s3.put_object(Bucket=os.environ["SEAL_BUCKET"], Key=key, Body=_canonical(doc).encode(),
                            ContentType="application/json", ChecksumAlgorithm="SHA256")
        print(f"Sealed {len(heads)} logs to {key} version {put.get('VersionId')}")
    return {"sealed": len(heads), "key": key, "rootHash": doc["rootHash"]}


def _recent_seals(limit=60):
    """Newest first: (doc, key, versionId, retainUntil)."""
    if config.LOCAL:
        for doc in sorted(db.store().list_seals(), key=lambda d: d["sealedAt"], reverse=True)[:limit]:
            yield doc, doc["key"], None, None
        return
    import boto3
    s3, bucket = boto3.client("s3"), os.environ["SEAL_BUCKET"]
    objects = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix="seals/"):
        objects.extend(page.get("Contents", []))
    for obj in sorted(objects, key=lambda o: o["Key"], reverse=True)[:limit]:
        got = s3.get_object(Bucket=bucket, Key=obj["Key"])
        retain = got.get("ObjectLockRetainUntilDate")
        yield json.loads(got["Body"].read()), obj["Key"], got.get("VersionId"), retain.isoformat() if retain else None


def latest_for(device_id: str, chain: list):
    """The newest seal that covers this device, and whether today's log still matches it."""
    key = device_key(device_id)
    for doc, s3_key, version, retain in _recent_seals():
        sealed = doc["devices"].get(key)
        if not sealed:
            continue
        count = sealed["count"]
        matches = len(chain) >= count and chain[count - 1]["hash"] == sealed["headHash"]
        return {
            "sealedAt": doc["sealedAt"], "count": count, "headHash": sealed["headHash"],
            "rootHash": doc["rootHash"], "key": s3_key, "versionId": version, "retainUntil": retain,
            "matches": matches,
        }
    return None

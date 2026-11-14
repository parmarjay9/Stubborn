"""Tamper-evident hash chain. Must match frontend/src/lib/hashchain.ts exactly.

Canonical JSON: the eight hashed fields, keys sorted, no whitespace.
Coordinates are written as fixed 6-decimal strings so that JavaScript and
Python can never disagree about how a float prints. serverTs is not hashed.
"""
import hashlib
import json
from decimal import Decimal

ZERO_HASH = "0" * 64
HASH_FIELDS = ("accuracyM", "clientTs", "deviceId", "lat", "lng", "prevHash", "seq", "type")


def _coord(value):
    if value is None:
        return None
    return format(Decimal(str(value)), ".6f")


def canonical_json(entry: dict) -> str:
    accuracy = entry.get("accuracyM")
    doc = {
        "accuracyM": None if accuracy is None else int(accuracy),
        "clientTs": entry["clientTs"],
        "deviceId": entry["deviceId"],
        "lat": _coord(entry.get("lat")),
        "lng": _coord(entry.get("lng")),
        "prevHash": entry["prevHash"],
        "seq": int(entry["seq"]),
        "type": entry["type"],
    }
    return json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def hash_entry(entry: dict) -> str:
    return hashlib.sha256(canonical_json(entry).encode("utf-8")).hexdigest()


def verify_chain(entries: list) -> dict:
    """Walk the chain in seq order. Returns {valid, brokenAtSeq, count}."""
    prev = ZERO_HASH
    ordered = sorted(entries, key=lambda e: int(e["seq"]))
    for index, entry in enumerate(ordered):
        seq = int(entry["seq"])
        if seq != index or entry.get("prevHash") != prev or hash_entry(entry) != entry.get("hash"):
            return {"valid": False, "brokenAtSeq": min(seq, index), "count": len(ordered)}
        prev = entry["hash"]
    return {"valid": True, "brokenAtSeq": None, "count": len(ordered)}

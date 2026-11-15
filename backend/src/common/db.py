"""Storage. DynamoDB in AWS, a JSON file when STUBBORN_LOCAL=1 (local dev).

Shifts table:  PK deviceId (S), SK seq (N)
Checks table:  PK deviceId (S), SK checkId (S), data (JSON string)
Runs table:    PK runId (S), data (JSON string)
Shares table:  PK shareId (S), data (JSON string)
Devices table: PK deviceId (S), secretHash (S)
Waitlist table: PK email (S), plan, lang, organization, joinedAt
"""
import json
import os
import threading
from decimal import Decimal

from common import config


class Conflict(Exception):
    """An entry with this deviceId + seq already exists."""


SHIFT_FIELDS = ("deviceId", "seq", "type", "clientTs", "lat", "lng", "accuracyM",
                "prevHash", "hash", "serverTs", "origClientTs")


# ---------------- local JSON file backend ----------------

class _LocalStore:
    def __init__(self):
        self.path = os.environ.get(
            "STUBBORN_LOCAL_DB",
            os.path.join(os.path.dirname(__file__), "..", "..", ".local", "db.json"),
        )
        self.lock = threading.RLock()

    def _load(self):
        try:
            with open(self.path) as fh:
                return json.load(fh)
        except (FileNotFoundError, ValueError):
            return {"shifts": {}, "checks": {}, "runs": {}, "shares": {}, "devices": {}, "seals": [], "waitlist": {}}

    def _save(self, data):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(data, fh)
        os.replace(tmp, self.path)

    def list_shifts(self, device_id):
        with self.lock:
            return sorted(self._load()["shifts"].get(device_id, []), key=lambda e: e["seq"])

    def append_shift(self, entry):
        with self.lock:
            data = self._load()
            chain = data["shifts"].setdefault(entry["deviceId"], [])
            if any(e["seq"] == entry["seq"] for e in chain):
                raise Conflict()
            chain.append(entry)
            self._save(data)

    def update_shift(self, device_id, seq, fields):
        with self.lock:
            data = self._load()
            for entry in data["shifts"].get(device_id, []):
                if entry["seq"] == seq:
                    for key, value in fields.items():
                        if value is None:
                            entry.pop(key, None)
                        else:
                            entry[key] = value
            self._save(data)

    def delete_shifts(self, device_id):
        with self.lock:
            data = self._load()
            data["shifts"].pop(device_id, None)
            self._save(data)

    def put_check(self, device_id, check_id, record):
        with self.lock:
            data = self._load()
            data["checks"][f"{device_id}/{check_id}"] = record
            self._save(data)

    def list_checks(self, device_id):
        with self.lock:
            checks = self._load()["checks"]
            return [record for key, record in checks.items() if key.startswith(device_id + "/")]

    def delete_checks(self, device_id):
        with self.lock:
            data = self._load()
            data["checks"] = {k: v for k, v in data["checks"].items() if not k.startswith(device_id + "/")}
            self._save(data)

    def get_check(self, device_id, check_id):
        with self.lock:
            return self._load()["checks"].get(f"{device_id}/{check_id}")

    def put_share(self, share):
        with self.lock:
            data = self._load()
            data.setdefault("shares", {})[share["shareId"]] = share
            self._save(data)

    def get_share(self, share_id):
        with self.lock:
            return self._load().get("shares", {}).get(share_id)

    def get_device(self, device_id):
        with self.lock:
            return self._load().get("devices", {}).get(device_id)

    def claim_device(self, device_id, secret_hash):
        """Register a secret for a device if it has none. Returns the stored record."""
        with self.lock:
            data = self._load()
            devices = data.setdefault("devices", {})
            if device_id not in devices:
                devices[device_id] = {"deviceId": device_id, "secretHash": secret_hash}
                self._save(data)
            return devices[device_id]

    def put_waitlist(self, entry):
        with self.lock:
            data = self._load()
            data.setdefault("waitlist", {})[entry["email"]] = entry
            self._save(data)

    def scan_heads(self):
        with self.lock:
            return {d: (len(c), sorted(c, key=lambda e: e["seq"])[-1]["hash"])
                    for d, c in self._load()["shifts"].items() if c}

    def put_seal(self, doc):
        with self.lock:
            data = self._load()
            data.setdefault("seals", []).append(doc)
            self._save(data)

    def list_seals(self):
        with self.lock:
            return list(self._load().get("seals", []))

    def put_run(self, run):
        with self.lock:
            data = self._load()
            data["runs"][run["runId"]] = run
            self._save(data)

    def get_run(self, run_id):
        with self.lock:
            return self._load()["runs"].get(run_id)


# ---------------- DynamoDB backend ----------------

class _DynamoStore:
    def __init__(self):
        import boto3
        resource = boto3.resource("dynamodb")
        self.shifts = resource.Table(os.environ["SHIFTS_TABLE"])
        self.checks = resource.Table(os.environ["CHECKS_TABLE"])
        self.runs = resource.Table(os.environ["RUNS_TABLE"])
        self.shares = resource.Table(os.environ["SHARES_TABLE"])
        self.devices = resource.Table(os.environ["DEVICES_TABLE"])
        self.waitlist = resource.Table(os.environ["WAITLIST_TABLE"]) if os.environ.get("WAITLIST_TABLE") else None

    @staticmethod
    def _to_item(entry):
        item = {}
        for key in SHIFT_FIELDS:
            value = entry.get(key)
            if value is None:
                continue
            item[key] = Decimal(str(value)) if isinstance(value, float) else value
        return item

    @staticmethod
    def _from_item(item):
        entry = {key: item.get(key) for key in SHIFT_FIELDS if key != "origClientTs"}
        if "origClientTs" in item:
            entry["origClientTs"] = item["origClientTs"]
        entry["seq"] = int(entry["seq"])
        if entry["accuracyM"] is not None:
            entry["accuracyM"] = int(entry["accuracyM"])
        for key in ("lat", "lng"):
            if entry[key] is not None:
                entry[key] = float(entry[key])
        return entry

    def list_shifts(self, device_id):
        from boto3.dynamodb.conditions import Key
        items, kwargs = [], {"KeyConditionExpression": Key("deviceId").eq(device_id), "ConsistentRead": True}
        while True:
            page = self.shifts.query(**kwargs)
            items.extend(page["Items"])
            if "LastEvaluatedKey" not in page:
                break
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
        return [self._from_item(item) for item in items]

    def append_shift(self, entry):
        from botocore.exceptions import ClientError
        try:
            self.shifts.put_item(Item=self._to_item(entry), ConditionExpression="attribute_not_exists(seq)")
        except ClientError as err:
            if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise Conflict()
            raise

    def update_shift(self, device_id, seq, fields):
        sets, removes, names, values = [], [], {}, {}
        for index, (key, value) in enumerate(fields.items()):
            names[f"#k{index}"] = key
            if value is None:
                removes.append(f"#k{index}")
            else:
                sets.append(f"#k{index} = :v{index}")
                values[f":v{index}"] = value
        expression = " ".join(part for part in (
            "SET " + ", ".join(sets) if sets else "",
            "REMOVE " + ", ".join(removes) if removes else "",
        ) if part)
        kwargs = {"Key": {"deviceId": device_id, "seq": seq}, "UpdateExpression": expression,
                  "ExpressionAttributeNames": names}
        if values:
            kwargs["ExpressionAttributeValues"] = values
        self.shifts.update_item(**kwargs)

    def delete_shifts(self, device_id):
        with self.shifts.batch_writer() as batch:
            for entry in self.list_shifts(device_id):
                batch.delete_item(Key={"deviceId": device_id, "seq": entry["seq"]})

    def put_check(self, device_id, check_id, record):
        self.checks.put_item(Item={"deviceId": device_id, "checkId": check_id, "data": json.dumps(record)})

    def _check_items(self, device_id):
        from boto3.dynamodb.conditions import Key
        items, kwargs = [], {"KeyConditionExpression": Key("deviceId").eq(device_id), "ConsistentRead": True}
        while True:
            page = self.checks.query(**kwargs)
            items.extend(page["Items"])
            if "LastEvaluatedKey" not in page:
                return items
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    def list_checks(self, device_id):
        return [json.loads(item["data"]) for item in self._check_items(device_id)]

    def delete_checks(self, device_id):
        with self.checks.batch_writer() as batch:
            for item in self._check_items(device_id):
                batch.delete_item(Key={"deviceId": device_id, "checkId": item["checkId"]})

    def get_check(self, device_id, check_id):
        item = self.checks.get_item(Key={"deviceId": device_id, "checkId": check_id}).get("Item")
        return json.loads(item["data"]) if item else None

    def put_share(self, share):
        self.shares.put_item(Item={"shareId": share["shareId"], "data": json.dumps(share)})

    def get_share(self, share_id):
        item = self.shares.get_item(Key={"shareId": share_id}).get("Item")
        return json.loads(item["data"]) if item else None

    def get_device(self, device_id):
        return self.devices.get_item(Key={"deviceId": device_id}, ConsistentRead=True).get("Item")

    def claim_device(self, device_id, secret_hash):
        from botocore.exceptions import ClientError
        try:
            self.devices.put_item(Item={"deviceId": device_id, "secretHash": secret_hash},
                                  ConditionExpression="attribute_not_exists(deviceId)")
        except ClientError as err:
            if err.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
        return self.get_device(device_id)

    def put_waitlist(self, entry):
        self.waitlist.put_item(Item=entry)

    def scan_heads(self):
        best, kwargs = {}, {"ProjectionExpression": "deviceId, seq, #h", "ExpressionAttributeNames": {"#h": "hash"}}
        while True:
            page = self.shifts.scan(**kwargs)
            for item in page["Items"]:
                seq = int(item["seq"])
                if item["deviceId"] not in best or seq > best[item["deviceId"]][0]:
                    best[item["deviceId"]] = (seq, item["hash"])
            if "LastEvaluatedKey" not in page:
                break
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
        return {d: (seq + 1, head) for d, (seq, head) in best.items()}

    def put_run(self, run):
        self.runs.put_item(Item={"runId": run["runId"], "data": json.dumps(run)})

    def get_run(self, run_id):
        item = self.runs.get_item(Key={"runId": run_id}, ConsistentRead=True).get("Item")
        return json.loads(item["data"]) if item else None


_store = None


def store():
    global _store
    if _store is None:
        _store = _LocalStore() if config.LOCAL else _DynamoStore()
    return _store

"""POST /shifts, GET /shifts, GET /shifts/verify, POST /shifts/demo."""
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from common import config, db
from common.api import BadRequest, body_of, query_of, route
from common.hashchain import ZERO_HASH, hash_entry, verify_chain

DEVICE_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
TS_RE = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$")
HASH_RE = re.compile(r"^[0-9a-f]{64}$")


def _device(value):
    if not isinstance(value, str) or not DEVICE_RE.match(value):
        raise BadRequest("Missing or invalid deviceId.")
    return value


def _public(entry):
    return {k: v for k, v in entry.items() if k != "origClientTs"}


def _number(value, low, high, name):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)) or not low <= value <= high:
        raise BadRequest(f"Invalid {name}.")
    return value


def append(event):
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    seq = body.get("seq")
    if isinstance(seq, bool) or not isinstance(seq, int) or seq < 0:
        raise BadRequest("Invalid seq.")
    if body.get("type") not in ("IN", "OUT"):
        raise BadRequest("type must be IN or OUT.")
    client_ts = body.get("clientTs")
    if not isinstance(client_ts, str) or not TS_RE.match(client_ts):
        raise BadRequest("clientTs must look like 2026-11-10T08:02:11-07:00.")
    try:
        datetime.fromisoformat(client_ts)
    except ValueError:
        raise BadRequest("clientTs is not a real date and time.")
    for key in ("prevHash", "hash"):
        if not isinstance(body.get(key), str) or not HASH_RE.match(body[key]):
            raise BadRequest(f"Invalid {key}.")

    lat = _number(body.get("lat"), -90, 90, "lat")
    lng = _number(body.get("lng"), -180, 180, "lng")
    accuracy = _number(body.get("accuracyM"), 0, 10_000_000, "accuracyM")
    entry = {
        "deviceId": device_id, "seq": seq, "type": body["type"], "clientTs": client_ts,
        "lat": None if lat is None else float(lat),
        "lng": None if lng is None else float(lng),
        "accuracyM": None if accuracy is None else int(accuracy),
        "prevHash": body["prevHash"],
    }

    # The server recomputes the hash itself and never trusts the client's.
    if hash_entry(entry) != body["hash"]:
        raise BadRequest("The entry hash does not match its contents.")
    entry["hash"] = body["hash"]

    chain = db.store().list_shifts(device_id)
    head = chain[-1] if chain else None
    expected = {
        "seq": len(chain),
        "prevHash": head["hash"] if head else ZERO_HASH,
        "type": "OUT" if head and head["type"] == "IN" else "IN",
    }
    if any(entry[key] != expected[key] for key in expected):
        raise BadRequest("Your log is out of date. Refresh and try again.", 409, {"expected": expected})

    entry["serverTs"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        db.store().append_shift(entry)
    except db.Conflict:
        raise BadRequest("Your log is out of date. Refresh and try again.", 409)
    return 201, {"entry": entry}


def list_entries(event):
    device_id = _device(query_of(event).get("deviceId"))
    return 200, {"entries": [_public(e) for e in db.store().list_shifts(device_id)]}


def verify(event):
    device_id = _device(query_of(event).get("deviceId"))
    return 200, verify_chain(db.store().list_shifts(device_id))


def demo(event):
    """Stage demo helpers. tamper edits one stored entry without re-hashing it,
    so the chain breaks. restore puts it back. reset clears the device.
    seed clears it and loads the sample account history."""
    if not config.DEMO_MODE:
        raise BadRequest("Demo tools are turned off.", 403)
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    action = body.get("action")
    store = db.store()
    chain = store.list_shifts(device_id)

    if action == "reset":
        store.delete_shifts(device_id)
        store.delete_checks(device_id)
    elif action == "seed":
        from common import sample
        sample.seed(device_id)
    elif action == "tamper":
        if not chain:
            raise BadRequest("There is nothing in the log to change yet.")
        if not any("origClientTs" in e for e in chain):
            outs = [e for e in chain if e["type"] == "OUT"]
            target = next((e for e in chain if e["seq"] == 7), None) or (outs or chain)[len(outs or chain) // 2]
            later = datetime.fromisoformat(target["clientTs"]) + timedelta(hours=1)
            store.update_shift(device_id, target["seq"], {
                "origClientTs": target["clientTs"], "clientTs": later.isoformat(timespec="seconds"),
            })
    elif action == "restore":
        for entry in chain:
            if "origClientTs" in entry:
                store.update_shift(device_id, entry["seq"], {
                    "clientTs": entry["origClientTs"], "origClientTs": None,
                })
    else:
        raise BadRequest("action must be tamper, restore, reset or seed.")

    chain = store.list_shifts(device_id)
    return 200, {**verify_chain(chain), "tampered": any("origClientTs" in e for e in chain)}


handler = route({
    "POST /shifts": append,
    "GET /shifts": list_entries,
    "GET /shifts/verify": verify,
    "POST /shifts/demo": demo,
})

import json
import os

import pytest

DEVICE = "5eedde70-0000-4000-8000-00000000d340"
SECRET = "s" * 40
OTHER_SECRET = "o" * 40


@pytest.fixture
def local_store(tmp_path, monkeypatch):
    from common import config, db
    monkeypatch.setenv("STUBBORN_LOCAL_DB", os.path.join(tmp_path, "db.json"))
    monkeypatch.setattr(config, "LOCAL", True)
    monkeypatch.setattr(db, "_store", None)
    yield db.store()
    monkeypatch.setattr(db, "_store", None)


def call(handler, route, body=None, query=None, path=None, secret=SECRET):
    event = {"routeKey": route, "body": json.dumps(body) if body is not None else None,
             "queryStringParameters": query, "pathParameters": path,
             "headers": {"x-device-secret": secret} if secret else {}}
    result = handler(event)
    return result["statusCode"], json.loads(result["body"])


def seed(secret=SECRET):
    from shifts.handler import handler
    return call(handler, "POST /shifts/demo", {"deviceId": DEVICE, "action": "seed"}, secret=secret)


def test_first_phone_claims_the_log_and_others_are_refused(local_store):
    from check.handler import handler as check_handler
    from shifts.handler import handler

    assert seed()[0] == 200
    assert call(handler, "GET /shifts", query={"deviceId": DEVICE})[0] == 200
    status, body = call(handler, "GET /shifts", query={"deviceId": DEVICE}, secret=OTHER_SECRET)
    assert status == 403
    assert call(handler, "POST /shifts/demo", {"deviceId": DEVICE, "action": "reset"}, secret=OTHER_SECRET)[0] == 403
    assert call(check_handler, "GET /history", query={"deviceId": DEVICE}, secret=OTHER_SECRET)[0] == 403
    assert call(handler, "GET /shifts", query={"deviceId": DEVICE}, secret=None)[0] == 401
    # the log is untouched after the refused reset
    assert call(handler, "GET /shifts/verify", query={"deviceId": DEVICE})[1]["count"] == 40


def test_share_link_is_read_only_and_verifiable(local_store):
    from check.handler import handler as check_handler
    from common.hashchain import hash_entry
    from share.handler import handler as share_handler

    seed()
    stub = {"payPeriodStart": "2026-11-08", "payPeriodEnd": "2026-11-14", "hourlyRate": "17.00",
            "regularHoursPaid": "38.00", "overtimeHoursPaid": "0.00", "grossPay": "646.00"}
    _, check = call(check_handler, "POST /check", {"deviceId": DEVICE, "stub": stub})
    status, created = call(share_handler, "POST /share",
                           {"deviceId": DEVICE, "checkId": check["checkId"], "worker": {"name": "Alex Rivera", "employer": "Desert Sun"}})
    assert status == 201

    # anyone can open the link, no secret needed
    status, shared = call(share_handler, "GET /share/{shareId}", path={"shareId": created["shareId"]}, secret=None)
    assert status == 200
    assert shared["check"]["totals"]["owed"] == "123.25"
    assert shared["verify"] == {"valid": True, "brokenAtSeq": None, "count": 40}
    assert shared["worker"] == {"name": "Alex Rivera", "employer": "Desert Sun"}
    # a viewer can recompute every hash from what the link returns
    for entry in shared["entries"]:
        assert hash_entry({**entry, "deviceId": shared["deviceId"]}) == entry["hash"]

    # the seal written at seeding time covers this log and still matches
    assert shared["seal"]["count"] == 40 and shared["seal"]["matches"] is True

    # but the device id from the link cannot be used to change or read the private log
    from shifts.handler import handler
    assert call(handler, "POST /shifts/demo", {"deviceId": shared["deviceId"], "action": "reset"}, secret=OTHER_SECRET)[0] == 403


def test_share_needs_a_real_check(local_store):
    from share.handler import handler as share_handler
    seed()
    assert call(share_handler, "POST /share", {"deviceId": DEVICE, "checkId": "nope123"})[0] == 404
    assert call(share_handler, "GET /share/{shareId}", path={"shareId": "doesnotexist123"}, secret=None)[0] == 404


def test_seal_catches_a_rebuilt_chain(local_store):
    """Someone with database access rewrites an entry AND recomputes every hash
    after it. The chain looks valid again, but the sealed fingerprint does not match."""
    from common import seal
    from common.hashchain import hash_entry, verify_chain

    seed()
    chain = local_store.list_shifts(DEVICE)
    for entry in chain[7:]:
        if entry["seq"] == 7:
            entry["clientTs"] = entry["clientTs"].replace("T16:00", "T18:00")
        entry["prevHash"] = chain[entry["seq"] - 1]["hash"]
        entry["hash"] = hash_entry(entry)
    assert verify_chain(chain)["valid"] is True
    assert seal.latest_for(DEVICE, chain)["matches"] is False


def test_seal_hides_device_ids(local_store):
    from common import seal
    seed()
    sealed = local_store.list_seals()[-1]
    assert DEVICE not in json.dumps(sealed)
    assert seal.device_key(DEVICE) in sealed["devices"]

import json
import os

import pytest


@pytest.fixture
def local_store(tmp_path, monkeypatch):
    from common import config, db
    monkeypatch.setenv("STUBBORN_LOCAL_DB", os.path.join(tmp_path, "db.json"))
    monkeypatch.setattr(config, "LOCAL", True)
    monkeypatch.setattr(db, "_store", None)
    yield db.store()
    monkeypatch.setattr(db, "_store", None)


def join(body):
    from waitlist.handler import handler
    result = handler({"routeKey": "POST /waitlist", "body": json.dumps(body)})
    return result["statusCode"], json.loads(result["body"])


def test_signup_is_stored_lowercased_and_deduplicated(local_store):
    assert join({"email": " Alex@Example.com ", "plan": "plus", "lang": "es"}) == (200, {"ok": True})
    assert join({"email": "alex@example.com", "plan": "plus"})[0] == 200
    waitlist = json.load(open(local_store.path))["waitlist"]
    assert list(waitlist) == ["alex@example.com"]
    assert waitlist["alex@example.com"]["plan"] == "plus"


def test_partners_need_an_organization(local_store):
    assert join({"email": "lead@union.org", "plan": "partners"})[0] == 400
    assert join({"email": "lead@union.org", "plan": "partners", "organization": "Tempe Workers Center"})[0] == 200


def test_bad_input_is_refused(local_store):
    for body in ({"email": "not-an-email", "plan": "plus"}, {"email": "a@b.co", "plan": "gold"}, {"plan": "plus"},
                 {"email": "x" * 250 + "@b.co", "plan": "plus"}):
        assert join(body)[0] == 400, body

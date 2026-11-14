import os

import pytest

DEVICE = "5eedde70-0000-4000-8000-00000000d340"


@pytest.fixture
def local_store(tmp_path, monkeypatch):
    from common import config, db
    monkeypatch.setenv("STUBBORN_LOCAL_DB", os.path.join(tmp_path, "db.json"))
    monkeypatch.setattr(config, "LOCAL", True)
    monkeypatch.setattr(db, "_store", None)
    yield db.store()
    monkeypatch.setattr(db, "_store", None)


def test_sample_account_history(local_store):
    from common import checks, sample
    from common.hashchain import verify_chain

    assert sample.seed(DEVICE) == 40
    assert verify_chain(local_store.list_shifts(DEVICE)) == {"valid": True, "brokenAtSeq": None, "count": 40}

    history = checks.history(DEVICE)
    rows = [(p["start"], p["loggedHours"], p["check"]["totals"]["owed"] if p["check"] else None) for p in history["periods"]]
    assert rows == [
        ("2026-11-08", "43.50", None),       # newest week, no stub checked yet
        ("2026-11-01", "41.50", "38.25"),    # 1.5 overtime hours missing
        ("2026-10-25", "42.00", "0.00"),
        ("2026-10-18", "40.00", "0.00"),
    ]
    assert history["summary"] == {"periodsChecked": 3, "periodsWithGap": 1, "periodsNotChecked": 1, "totalOwed": "38.25"}


def test_checking_the_demo_stub_on_the_sample_account_gives_123_25(local_store):
    from common import checks, sample

    sample.seed(DEVICE)
    stub = {"payPeriodStart": "2026-11-08", "payPeriodEnd": "2026-11-14", "hourlyRate": "17.00",
            "regularHoursPaid": "38.00", "overtimeHoursPaid": "0.00", "grossPay": "646.00"}
    assert checks.run_check(DEVICE, stub)["totals"]["owed"] == "123.25"
    summary = checks.history(DEVICE)["summary"]
    assert summary["totalOwed"] == "161.50" and summary["periodsNotChecked"] == 0


def test_rechecking_a_period_replaces_the_old_row(local_store):
    from common import checks, sample

    sample.seed(DEVICE)
    fixed = {"payPeriodStart": "2026-11-01", "payPeriodEnd": "2026-11-07", "hourlyRate": "17.00",
             "regularHoursPaid": "40.00", "overtimeHoursPaid": "1.50", "grossPay": "718.25"}
    checks.run_check(DEVICE, fixed)
    history = checks.history(DEVICE)
    assert len(history["periods"]) == 4
    assert history["summary"]["totalOwed"] == "0.00"


def test_seeding_twice_starts_clean(local_store):
    from common import checks, sample

    sample.seed(DEVICE)
    sample.seed(DEVICE)
    assert len(local_store.list_shifts(DEVICE)) == 40
    assert checks.history(DEVICE)["summary"]["periodsChecked"] == 3

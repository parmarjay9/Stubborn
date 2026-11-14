"""The sample account: four weeks of hours for a made-up worker, with pay
stubs already checked for the first three. The newest week is left unchecked
so a visitor (or the stage demo) can check that stub themselves.

Entries are built with the same hash function a phone uses, so the chain
verifies. serverTs is the time of seeding, not the shift time.
"""
from datetime import datetime, timezone

from common import db
from common.checks import run_check
from common.hashchain import ZERO_HASH, hash_entry

WORKER = {"name": "Alex Rivera", "employer": "Desert Sun Logistics LLC"}
RATE = "17.00"

# (date, clock in, clock out), Arizona time (UTC-7, no daylight saving).
WEEKS = [
    {   # 40 hours, paid in full
        "shifts": [("2026-10-19", "08:00", "16:00"), ("2026-10-20", "08:03", "16:03"), ("2026-10-21", "07:57", "15:57"),
                   ("2026-10-22", "08:00", "16:00"), ("2026-10-23", "08:01", "16:01")],
        "stub": {"payPeriodStart": "2026-10-18", "payPeriodEnd": "2026-10-24", "hourlyRate": RATE,
                 "regularHoursPaid": "40.00", "overtimeHoursPaid": "0.00", "grossPay": "680.00"},
        "checkedAt": "2026-10-25T18:10:00+00:00",
    },
    {   # 42 hours, overtime paid correctly
        "shifts": [("2026-10-26", "08:00", "16:30"), ("2026-10-27", "08:02", "16:32"), ("2026-10-28", "08:00", "16:30"),
                   ("2026-10-29", "07:58", "16:28"), ("2026-10-30", "08:00", "16:00")],
        "stub": {"payPeriodStart": "2026-10-25", "payPeriodEnd": "2026-10-31", "hourlyRate": RATE,
                 "regularHoursPaid": "40.00", "overtimeHoursPaid": "2.00", "grossPay": "731.00"},
        "checkedAt": "2026-11-01T17:45:00+00:00",
    },
    {   # 41.5 hours, stub pays only 40: 1.5 overtime hours missing
        "shifts": [("2026-11-02", "08:00", "16:30"), ("2026-11-03", "08:04", "16:34"), ("2026-11-04", "08:00", "16:00"),
                   ("2026-11-05", "08:00", "16:30"), ("2026-11-06", "08:02", "16:02")],
        "stub": {"payPeriodStart": "2026-11-01", "payPeriodEnd": "2026-11-07", "hourlyRate": RATE,
                 "regularHoursPaid": "40.00", "overtimeHoursPaid": "0.00", "grossPay": "680.00"},
        "checkedAt": "2026-11-08T18:30:00+00:00",
    },
    {   # 43.5 hours, the stage demo week. No stub checked yet.
        "shifts": [("2026-11-09", "08:02", "17:02"), ("2026-11-10", "08:00", "17:30"), ("2026-11-11", "07:58", "16:28"),
                   ("2026-11-12", "08:00", "16:30"), ("2026-11-13", "08:05", "16:05")],
        "stub": None,
    },
]
# A made-up warehouse spot in Tempe, with a little GPS wobble per entry.
BASE_LAT, BASE_LNG = 33.4142, -111.9093


def seed(device_id):
    """Wipe the device and load the sample history. Returns the entry count."""
    store = db.store()
    store.delete_shifts(device_id)
    store.delete_checks(device_id)

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    entries, prev = [], ZERO_HASH
    for week in WEEKS:
        for day, start, end in week["shifts"]:
            for kind, clock in (("IN", start), ("OUT", end)):
                seq = len(entries)
                entry = {
                    "deviceId": device_id, "seq": seq, "type": kind,
                    "clientTs": f"{day}T{clock}:00-07:00",
                    "lat": round(BASE_LAT + ((seq * 37) % 11 - 5) * 0.00001, 6),
                    "lng": round(BASE_LNG + ((seq * 53) % 13 - 6) * 0.00001, 6),
                    "accuracyM": 8 + (seq * 7) % 9,
                    "prevHash": prev,
                }
                entry["hash"] = prev = hash_entry(entry)
                entry["serverTs"] = now
                store.append_shift(entry)
                entries.append(entry)
        if week["stub"]:
            # Each stub is checked against the log as it stood that week.
            run_check(device_id, week["stub"], entries=list(entries), checked_at=week["checkedAt"])
    return len(entries)

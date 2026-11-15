"""Run a pay check and build the hours-vs-stubs history. Shared by the
check handler and the sample account seeder."""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from common import config, db
from common.hashchain import verify_chain
from rules.engine import _hours_field, _plain, check_pay, hours_by_workweek, pair_shifts


def run_check(device_id, stub, entries=None, checked_at=None):
    """Runs the rules engine, saves the result, returns it. Raises StubError."""
    if entries is None:
        entries = db.store().list_shifts(device_id)
    result = check_pay(
        entries, stub,
        min_wage=config.AZ_MIN_WAGE,
        week_start_weekday=config.WORKWEEK_START_WEEKDAY,
        overtime_threshold=config.OVERTIME_THRESHOLD_HOURS,
        overtime_multiplier=config.OVERTIME_MULTIPLIER,
    )
    result["log"] = verify_chain(entries)
    result["checkId"] = uuid.uuid4().hex[:12]
    result["checkedAt"] = checked_at or datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.store().put_check(device_id, result["checkId"], {"stub": {k: str(v) for k, v in stub.items()}, "result": result})
    return result


ARIZONA = timezone(timedelta(hours=-7))  # Arizona does not use daylight saving time


def usage(device_id, now=None):
    """How many pay stub checks this device ran in the current calendar month."""
    month = (now or datetime.now(timezone.utc)).astimezone(ARIZONA).strftime("%Y-%m")
    used = sum(
        1 for record in db.store().list_checks(device_id)
        if datetime.fromisoformat(record["result"]["checkedAt"]).astimezone(ARIZONA).strftime("%Y-%m") == month
    )
    return {"month": month, "checksUsed": used, "freeChecks": config.FREE_CHECKS_PER_MONTH,
            "enforced": False}


def history(device_id):
    """Every pay period the worker has checked, plus logged workweeks that have
    no stub yet. Newest first. Totals are summed here with Decimal, not in the UI."""
    store = db.store()
    entries = store.list_shifts(device_id)

    latest = {}  # one row per pay period: the most recent check wins
    for record in store.list_checks(device_id):
        result = record["result"]
        key = (result["payPeriod"]["start"], result["payPeriod"]["end"])
        if key not in latest or result["checkedAt"] > latest[key]["checkedAt"]:
            latest[key] = result

    periods = [{"start": start, "end": end, "loggedHours": result["totals"]["loggedHours"], "check": result}
               for (start, end), result in latest.items()]

    shifts, _ = pair_shifts(entries)
    if shifts:
        first, last = min(s[0] for s in shifts).date(), max(s[1] for s in shifts).date()
        covered = [(date.fromisoformat(s), date.fromisoformat(e)) for s, e in latest]
        for week_start, hours in hours_by_workweek(shifts, first, last, config.WORKWEEK_START_WEEKDAY).items():
            week_end = week_start + timedelta(days=6)
            if hours > 0 and not any(start <= week_end and week_start <= end for start, end in covered):
                periods.append({"start": week_start.isoformat(), "end": week_end.isoformat(),
                                "loggedHours": _hours_field(hours), "check": None})

    periods.sort(key=lambda p: p["start"], reverse=True)
    owed = [Decimal(r["totals"]["owed"]) for r in latest.values()]
    return {
        "periods": periods,
        "summary": {
            "periodsChecked": len(latest),
            "periodsWithGap": sum(1 for amount in owed if amount > 0),
            "periodsNotChecked": sum(1 for p in periods if p["check"] is None),
            "totalOwed": _plain(sum(owed, Decimal("0"))),
        },
    }

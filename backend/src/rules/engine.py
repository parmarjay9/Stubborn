"""Stubborn rules engine.

Pure functions only: no AWS, no LLM, no I/O. All money is Decimal, rounded to
cents with ROUND_HALF_UP at the end. The LLM never does any of this math.

Scope: hourly, non-tipped, one rate, one employer. Federal FLSA overtime
(over 40 hours in a workweek at 1.5x) and the Arizona minimum wage.
"""
from datetime import datetime, date, time, timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

CENT = Decimal("0.01")
HUNDREDTH_HOUR = Decimal("0.01")


class Note(str):
    """A warning: plain English text, plus a code and values so the app can
    word it in another language."""

    def __new__(cls, text, code, **params):
        note = super().__new__(cls, text)
        note.code, note.params = code, {k: str(v) for k, v in params.items()}
        return note


def _stamp(ts: datetime) -> str:
    return ts.replace(tzinfo=None).isoformat(timespec="minutes")


class StubError(ValueError):
    """The confirmed stub fields are missing or not usable."""


# ---------- formatting ----------

def _cents(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def money(amount: Decimal) -> str:
    return "${:,.2f}".format(_cents(amount))


def hours_text(hours: Decimal) -> str:
    """43.50 -> '43.5', 2.00 -> '2'."""
    text = format(hours.quantize(HUNDREDTH_HOUR, rounding=ROUND_HALF_UP), "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def _plain(amount: Decimal) -> str:
    return format(_cents(amount), "f")


def _hours_field(hours: Decimal) -> str:
    return format(hours.quantize(HUNDREDTH_HOUR, rounding=ROUND_HALF_UP), "f")


# ---------- step 1: pair IN/OUT into shifts ----------

def pair_shifts(entries):
    """Returns (shifts, warnings). A shift is (start, end) in the wall-clock
    time of the place the worker clocked in."""
    shifts, warnings = [], []
    open_in = None
    for entry in sorted(entries, key=lambda e: int(e["seq"])):
        try:
            ts = datetime.fromisoformat(entry["clientTs"])
        except (KeyError, ValueError):
            warnings.append(Note(f"Entry {entry.get('seq')} has an unreadable time and was skipped.",
                                 "unreadable_time", seq=entry.get("seq")))
            continue
        if entry.get("type") == "IN":
            if open_in is not None:
                warnings.append(Note(
                    f"Clock-in on {open_in.strftime('%b %d at %I:%M %p')} has no clock-out and was not counted.",
                    "in_without_out", at=_stamp(open_in)))
            open_in = ts
        elif entry.get("type") == "OUT":
            if open_in is None:
                warnings.append(Note(
                    f"Clock-out on {ts.strftime('%b %d at %I:%M %p')} has no clock-in and was not counted.",
                    "out_without_in", at=_stamp(ts)))
                continue
            end = ts.astimezone(open_in.tzinfo) if open_in.tzinfo and ts.tzinfo else ts
            start_local, end_local = open_in.replace(tzinfo=None), end.replace(tzinfo=None)
            if end_local <= start_local:
                warnings.append(Note(
                    f"Shift on {open_in.strftime('%b %d')} ends before it starts and was not counted.",
                    "ends_before_start", day=open_in.date().isoformat()))
            else:
                if end_local - start_local > timedelta(hours=24):
                    warnings.append(Note(
                        f"Shift starting {open_in.strftime('%b %d')} is longer than 24 hours. Worth checking.",
                        "over_24_hours", day=open_in.date().isoformat()))
                shifts.append((start_local, end_local))
            open_in = None
    if open_in is not None:
        warnings.append(Note(
            f"Clock-in on {open_in.strftime('%b %d at %I:%M %p')} has no clock-out yet and was not counted.",
            "still_clocked_in", at=_stamp(open_in)))
    return shifts, warnings


# ---------- step 2: group into workweeks ----------

def week_start_for(day: date, week_start_weekday: int) -> date:
    return day - timedelta(days=(day.weekday() - week_start_weekday) % 7)


def hours_by_workweek(shifts, period_start: date, period_end: date, week_start_weekday: int):
    """Clip shifts to the pay period and split them at workweek boundaries, so
    a shift that crosses midnight into a new workweek lands in both weeks.
    Returns {week_start_date: Decimal hours}, including empty weeks."""
    window_start = datetime.combine(period_start, time.min)
    window_end = datetime.combine(period_end + timedelta(days=1), time.min)

    seconds = {}
    week = week_start_for(period_start, week_start_weekday)
    while week <= period_end:
        seconds[week] = 0
        week += timedelta(days=7)

    for start, end in shifts:
        start, end = max(start, window_start), min(end, window_end)
        while start < end:
            week = week_start_for(start.date(), week_start_weekday)
            next_week = datetime.combine(week + timedelta(days=7), time.min)
            piece_end = min(end, next_week)
            seconds[week] = seconds.get(week, 0) + int((piece_end - start).total_seconds())
            start = piece_end

    return {
        week: (Decimal(secs) / Decimal(3600)).quantize(HUNDREDTH_HOUR, rounding=ROUND_HALF_UP)
        for week, secs in sorted(seconds.items())
    }


# ---------- stub parsing ----------

def _dec(stub, key, minimum=Decimal("0")):
    raw = stub.get(key)
    if raw is None or str(raw).strip() == "":
        raise StubError(f"Missing value: {key}")
    try:
        value = Decimal(str(raw).replace("$", "").replace(",", "").strip())
    except InvalidOperation:
        raise StubError(f"Not a number: {key}")
    if not value.is_finite() or value < minimum:
        raise StubError(f"Value out of range: {key}")
    return value


def _day(stub, key):
    try:
        return date.fromisoformat(str(stub.get(key, "")).strip())
    except ValueError:
        raise StubError(f"Not a date (use YYYY-MM-DD): {key}")


# ---------- steps 3 to 5: compare and itemize ----------

def check_pay(
    entries,
    stub,
    *,
    min_wage: Decimal,
    week_start_weekday: int = 6,
    overtime_threshold: Decimal = Decimal("40"),
    overtime_multiplier: Decimal = Decimal("1.5"),
):
    """Compare the worker's logged hours to the confirmed pay stub fields."""
    rate = _dec(stub, "hourlyRate", Decimal("0.01"))
    regular_paid = _dec(stub, "regularHoursPaid")
    overtime_paid = _dec(stub, "overtimeHoursPaid")
    gross_pay = _dec(stub, "grossPay")
    period_start, period_end = _day(stub, "payPeriodStart"), _day(stub, "payPeriodEnd")
    if period_end < period_start:
        raise StubError("The pay period ends before it starts.")

    shifts, warnings = pair_shifts(entries)
    if (period_end - period_start).days + 1 > 14:
        warnings.append(Note("This pay period is longer than two weeks. Stubborn is built for weekly and biweekly pay.",
                             "long_period"))

    rate_below_minimum = rate < min_wage
    effective_rate = max(rate, min_wage)  # nobody is expected to be paid under the minimum
    overtime_rate = effective_rate * overtime_multiplier

    weeks = []
    logged = expected_regular = expected_ot = Decimal("0")
    for week_start, week_hours in hours_by_workweek(shifts, period_start, period_end, week_start_weekday).items():
        week_regular = min(week_hours, overtime_threshold)
        week_ot = max(week_hours - overtime_threshold, Decimal("0"))
        weeks.append({
            "weekStart": week_start.isoformat(),
            "weekEnd": (week_start + timedelta(days=6)).isoformat(),
            "loggedHours": _hours_field(week_hours),
            "expectedRegular": _hours_field(week_regular),
            "expectedOT": _hours_field(week_ot),
            "expectedGross": _plain(week_regular * effective_rate + week_ot * overtime_rate),
        })
        logged += week_hours
        expected_regular += week_regular
        expected_ot += week_ot

    expected_gross = _cents(expected_regular * effective_rate + expected_ot * overtime_rate)
    paid_hours = regular_paid + overtime_paid
    missing_hours = logged - paid_hours
    owed = max(expected_gross - _cents(gross_pay), Decimal("0"))

    findings = []
    explained = Decimal("0")

    if logged == 0:
        warnings.append(Note("No logged hours were found inside this pay period, so there is nothing to compare.",
                             "no_hours"))

    ot_short = max(expected_ot - overtime_paid, Decimal("0"))
    ot_missing = Decimal("0")
    if missing_hours > 0 and owed > 0:
        findings.append({
            "code": "missing_hours",
            "label": f"{hours_text(missing_hours)} logged hours were not paid",
            "math": f"{hours_text(logged)} hours logged - {hours_text(paid_hours)} hours on the stub = {hours_text(missing_hours)} hours",
            "amount": None,
            "params": {"missing": hours_text(missing_hours), "logged": hours_text(logged), "paid": hours_text(paid_hours)},
        })
        ot_missing = min(ot_short, missing_hours)
        regular_missing = missing_hours - ot_missing
        if regular_missing > 0:
            amount = _cents(regular_missing * effective_rate)
            explained += amount
            findings.append({
                "code": "unpaid_regular",
                "label": f"{hours_text(regular_missing)} of those hours were regular time at {money(effective_rate)}/hr",
                "math": f"{hours_text(regular_missing)} x {money(effective_rate)} = {money(amount)}",
                "amount": _plain(amount),
                "params": {"hours": hours_text(regular_missing), "rate": money(effective_rate), "amount": money(amount)},
            })
        if ot_missing > 0:
            amount = _cents(ot_missing * overtime_rate)
            explained += amount
            findings.append({
                "code": "unpaid_overtime",
                "label": f"{hours_text(ot_missing)} of those hours were overtime and should be paid at {money(overtime_rate)}/hr",
                "math": (
                    f"{hours_text(ot_missing)} x {money(overtime_rate)} = {money(amount)}. "
                    f"Overtime is {hours_text(overtime_multiplier)} x {money(effective_rate)} for hours over "
                    f"{hours_text(overtime_threshold)} in a workweek."
                ),
                "amount": _plain(amount),
                "params": {"hours": hours_text(ot_missing), "otRate": money(overtime_rate), "amount": money(amount),
                           "mult": hours_text(overtime_multiplier), "rate": money(effective_rate),
                           "threshold": hours_text(overtime_threshold)},
            })
    elif missing_hours < 0:
        findings.append({
            "code": "extra_hours_on_stub",
            "label": f"The stub shows {hours_text(-missing_hours)} more hours than your log",
            "math": f"{hours_text(paid_hours)} hours on the stub - {hours_text(logged)} hours logged = {hours_text(-missing_hours)} hours",
            "amount": None,
            "params": {"extra": hours_text(-missing_hours), "paid": hours_text(paid_hours), "logged": hours_text(logged)},
        })

    ot_straight = ot_short - ot_missing
    if ot_straight > 0 and owed > 0:
        premium_rate = overtime_rate - effective_rate
        amount = _cents(ot_straight * premium_rate)
        explained += amount
        findings.append({
            "code": "overtime_at_regular_rate",
            "label": f"{hours_text(ot_straight)} overtime hours look like they were paid at the regular rate instead of {money(overtime_rate)}/hr",
            "math": f"{hours_text(ot_straight)} x {money(premium_rate)} extra per overtime hour = {money(amount)}",
            "amount": _plain(amount),
            "params": {"hours": hours_text(ot_straight), "otRate": money(overtime_rate), "premium": money(premium_rate),
                       "amount": money(amount)},
        })

    remainder = owed - explained
    if rate_below_minimum:
        amount = remainder if remainder > 0 else None
        findings.append({
            "code": "rate_below_minimum",
            "label": f"The hourly rate of {money(rate)} is below the Arizona minimum wage of {money(min_wage)}",
            "math": (
                f"Paid hours at {money(min_wage)}/hr instead of {money(rate)}/hr come to {money(amount)} more."
                if amount else f"Expected pay is figured at {money(min_wage)}/hr."
            ),
            "amount": _plain(amount) if amount else None,
            "params": {"rate": money(rate), "min": money(min_wage), "amount": money(amount) if amount else ""},
        })
    elif remainder > 0:
        findings.append({
            "code": "gross_lower_than_stub_hours",
            "label": f"The gross pay is {money(remainder)} lower than the hours and rate on the stub add up to",
            "math": f"{money(owed)} total gap - {money(explained)} explained above = {money(remainder)}",
            "amount": _plain(remainder),
            "params": {"remainder": money(remainder), "owed": money(owed), "explained": money(explained)},
        })

    if owed > 0:
        findings.append({
            "code": "total",
            "label": f"Total possibly owed: {money(owed)}",
            "math": f"{money(expected_gross)} expected for your logged hours - {money(gross_pay)} gross pay on the stub = {money(owed)}",
            "amount": _plain(owed),
            "params": {"owed": money(owed), "expected": money(expected_gross), "gross": money(gross_pay)},
        })
    elif not rate_below_minimum:
        findings.append({
            "code": "ok",
            "label": "Your pay stub covers the hours in your log. Nothing looks missing.",
            "math": f"{money(expected_gross)} expected for your logged hours, {money(gross_pay)} gross pay on the stub",
            "amount": None,
            "params": {"expected": money(expected_gross), "gross": money(gross_pay)},
        })

    return {
        "payPeriod": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "rate": _plain(rate),
        "effectiveRate": _plain(effective_rate),
        "overtimeRate": _plain(overtime_rate),
        "minimumWage": _plain(min_wage),
        "rateBelowMinimum": rate_below_minimum,
        "weeks": weeks,
        "totals": {
            "loggedHours": _hours_field(logged),
            "paidHours": _hours_field(paid_hours),
            "missingHours": _hours_field(missing_hours),
            "expectedRegular": _hours_field(expected_regular),
            "expectedOT": _hours_field(expected_ot),
            "expectedGross": _plain(expected_gross),
            "grossPay": _plain(gross_pay),
            "owed": _plain(owed),
        },
        "findings": findings,
        "warnings": [str(w) for w in warnings],
        "warningDetails": [{"code": getattr(w, "code", "other"), "params": getattr(w, "params", {})} for w in warnings],
    }

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
            warnings.append(f"Entry {entry.get('seq')} has an unreadable time and was skipped.")
            continue
        if entry.get("type") == "IN":
            if open_in is not None:
                warnings.append(
                    f"Clock-in on {open_in.strftime('%b %d at %I:%M %p')} has no clock-out and was not counted."
                )
            open_in = ts
        elif entry.get("type") == "OUT":
            if open_in is None:
                warnings.append(
                    f"Clock-out on {ts.strftime('%b %d at %I:%M %p')} has no clock-in and was not counted."
                )
                continue
            end = ts.astimezone(open_in.tzinfo) if open_in.tzinfo and ts.tzinfo else ts
            start_local, end_local = open_in.replace(tzinfo=None), end.replace(tzinfo=None)
            if end_local <= start_local:
                warnings.append(
                    f"Shift on {open_in.strftime('%b %d')} ends before it starts and was not counted."
                )
            else:
                if end_local - start_local > timedelta(hours=24):
                    warnings.append(
                        f"Shift starting {open_in.strftime('%b %d')} is longer than 24 hours. Worth checking."
                    )
                shifts.append((start_local, end_local))
            open_in = None
    if open_in is not None:
        warnings.append(
            f"Clock-in on {open_in.strftime('%b %d at %I:%M %p')} has no clock-out yet and was not counted."
        )
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
        warnings.append("This pay period is longer than two weeks. Stubborn is built for weekly and biweekly pay.")

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
        warnings.append("No logged hours were found inside this pay period, so there is nothing to compare.")

    ot_short = max(expected_ot - overtime_paid, Decimal("0"))
    ot_missing = Decimal("0")
    if missing_hours > 0 and owed > 0:
        findings.append({
            "code": "missing_hours",
            "label": f"{hours_text(missing_hours)} logged hours were not paid",
            "math": f"{hours_text(logged)} hours logged - {hours_text(paid_hours)} hours on the stub = {hours_text(missing_hours)} hours",
            "amount": None,
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
            })
    elif missing_hours < 0:
        findings.append({
            "code": "extra_hours_on_stub",
            "label": f"The stub shows {hours_text(-missing_hours)} more hours than your log",
            "math": f"{hours_text(paid_hours)} hours on the stub - {hours_text(logged)} hours logged = {hours_text(-missing_hours)} hours",
            "amount": None,
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
        })
    elif remainder > 0:
        findings.append({
            "code": "gross_lower_than_stub_hours",
            "label": f"The gross pay is {money(remainder)} lower than the hours and rate on the stub add up to",
            "math": f"{money(owed)} total gap - {money(explained)} explained above = {money(remainder)}",
            "amount": _plain(remainder),
        })

    if owed > 0:
        findings.append({
            "code": "total",
            "label": f"Total possibly owed: {money(owed)}",
            "math": f"{money(expected_gross)} expected for your logged hours - {money(gross_pay)} gross pay on the stub = {money(owed)}",
            "amount": _plain(owed),
        })
    elif not rate_below_minimum:
        findings.append({
            "code": "ok",
            "label": "Your pay stub covers the hours in your log. Nothing looks missing.",
            "math": f"{money(expected_gross)} expected for your logged hours, {money(gross_pay)} gross pay on the stub",
            "amount": None,
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
        "warnings": warnings,
    }

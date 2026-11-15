from decimal import Decimal

import pytest

from rules.engine import check_pay, StubError

MIN_WAGE = Decimal("15.15")


def make_entries(shifts):
    """shifts: list of (in_iso, out_iso or None) -> chained-looking entries."""
    entries, seq = [], 0
    for start, end in shifts:
        entries.append({"seq": seq, "type": "IN", "clientTs": start})
        seq += 1
        if end:
            entries.append({"seq": seq, "type": "OUT", "clientTs": end})
            seq += 1
    return entries


def day(d, start, end):
    return (f"2026-11-{d:02d}T{start}:00-07:00", f"2026-11-{d:02d}T{end}:00-07:00")


def stub(**overrides):
    base = {
        "payPeriodStart": "2026-11-08", "payPeriodEnd": "2026-11-14",
        "hourlyRate": "17.00", "regularHoursPaid": "40.00",
        "overtimeHoursPaid": "0.00", "grossPay": "680.00",
    }
    base.update(overrides)
    return base


def run(entries, stub_fields):
    return check_pay(entries, stub_fields, min_wage=MIN_WAGE)


FORTY = [day(d, "08:00", "16:00") for d in (9, 10, 11, 12, 13)]
# Mon 9h, Tue 9.5h, Wed 8.5h, Thu 8.5h, Fri 8h = 43.5h (same as demo/seed_week.py)
DEMO_WEEK = [
    day(9, "08:02", "17:02"), day(10, "08:00", "17:30"), day(11, "07:58", "16:28"),
    day(12, "08:00", "16:30"), day(13, "08:05", "16:05"),
]


def codes(result):
    return [f["code"] for f in result["findings"]]


def test_exactly_40_hours_paid_correctly_owes_nothing():
    result = run(make_entries(FORTY), stub())
    assert result["totals"]["loggedHours"] == "40.00"
    assert result["totals"]["owed"] == "0.00"
    assert codes(result) == ["ok"]
    assert result["warnings"] == []


def test_demo_case_owes_123_25():
    result = run(make_entries(DEMO_WEEK), stub(regularHoursPaid="38.00", grossPay="646.00"))
    totals = result["totals"]
    assert totals["loggedHours"] == "43.50"
    assert totals["missingHours"] == "5.50"
    assert totals["expectedGross"] == "769.25"
    assert totals["owed"] == "123.25"
    labels = [f["label"] for f in result["findings"]]
    assert labels == [
        "5.5 logged hours were not paid",
        "2 of those hours were regular time at $17.00/hr",
        "3.5 of those hours were overtime and should be paid at $25.50/hr",
        "Total possibly owed: $123.25",
    ]
    amounts = [f["amount"] for f in result["findings"]]
    assert amounts == [None, "34.00", "89.25", "123.25"]


def test_overtime_paid_at_straight_time():
    entries = make_entries([day(d, "08:00", "17:00") for d in (9, 10, 11, 12, 13)])  # 45h
    result = run(entries, stub(regularHoursPaid="45.00", grossPay="765.00"))
    assert result["totals"]["missingHours"] == "0.00"
    assert result["totals"]["owed"] == "42.50"  # 5h x $8.50 premium
    assert codes(result) == ["overtime_at_regular_rate", "total"]
    assert result["findings"][0]["amount"] == "42.50"


def test_overtime_listed_on_stub_but_gross_is_straight_time():
    entries = make_entries([day(d, "08:00", "17:00") for d in (9, 10, 11, 12, 13)])
    result = run(entries, stub(regularHoursPaid="40.00", overtimeHoursPaid="5.00", grossPay="765.00"))
    assert result["totals"]["owed"] == "42.50"
    assert codes(result) == ["gross_lower_than_stub_hours", "total"]


def test_rate_below_minimum_wage():
    result = run(make_entries(FORTY), stub(hourlyRate="12.00", grossPay="480.00"))
    assert result["rateBelowMinimum"] is True
    assert result["minimumWage"] == "15.15"
    assert result["totals"]["expectedGross"] == "606.00"  # 40 x 15.15
    assert result["totals"]["owed"] == "126.00"
    assert codes(result) == ["rate_below_minimum", "total"]
    assert result["findings"][0]["amount"] == "126.00"


def test_rate_at_or_above_minimum_is_not_flagged():
    assert run(make_entries(FORTY), stub(hourlyRate="15.15", grossPay="606.00"))["rateBelowMinimum"] is False


def test_biweekly_overtime_is_per_workweek_not_averaged():
    week1 = [day(d, "08:00", "17:00") for d in (9, 10, 11, 12, 13)]   # 45h
    week2 = [day(d, "08:00", "14:00") for d in (16, 17, 18, 19, 20)]  # 30h
    result = run(
        make_entries(week1 + week2),
        stub(payPeriodStart="2026-11-08", payPeriodEnd="2026-11-21",
             regularHoursPaid="75.00", grossPay="1275.00"),  # 75 x 17, no overtime paid
    )
    assert [w["loggedHours"] for w in result["weeks"]] == ["45.00", "30.00"]
    assert [w["expectedOT"] for w in result["weeks"]] == ["5.00", "0.00"]
    assert result["totals"]["expectedGross"] == "1317.50"  # 70 x 17 + 5 x 25.50
    assert result["totals"]["owed"] == "42.50"


def test_shift_crossing_midnight():
    entries = make_entries([("2026-11-10T22:00:00-07:00", "2026-11-11T06:00:00-07:00")])
    result = run(entries, stub(regularHoursPaid="8.00", grossPay="136.00"))
    assert result["totals"]["loggedHours"] == "8.00"
    assert result["totals"]["owed"] == "0.00"


def test_shift_crossing_into_next_workweek_is_split():
    # Saturday 8 PM to Sunday 4 AM: 4 hours in each workweek.
    entries = make_entries([("2026-11-14T20:00:00-07:00", "2026-11-15T04:00:00-07:00")])
    result = run(entries, stub(payPeriodStart="2026-11-08", payPeriodEnd="2026-11-21",
                               regularHoursPaid="8.00", grossPay="136.00"))
    assert [w["loggedHours"] for w in result["weeks"]] == ["4.00", "4.00"]


def test_unpaired_in_is_a_warning_not_a_crash():
    entries = make_entries(FORTY + [("2026-11-14T08:00:00-07:00", None)])
    result = run(entries, stub())
    assert result["totals"]["loggedHours"] == "40.00"
    assert result["totals"]["owed"] == "0.00"
    assert len(result["warnings"]) == 1
    assert "no clock-out" in result["warnings"][0]


def test_hours_outside_the_pay_period_are_ignored():
    entries = make_entries(FORTY + [day(16, "08:00", "16:00")])
    assert run(entries, stub())["totals"]["loggedHours"] == "40.00"


def test_stub_paying_more_than_logged_owes_nothing():
    result = run(make_entries(FORTY[:4]), stub())
    assert result["totals"]["owed"] == "0.00"
    assert "extra_hours_on_stub" in codes(result)


def test_bad_stub_fields_raise_a_clear_error():
    with pytest.raises(StubError):
        run(make_entries(FORTY), stub(grossPay="lots"))
    with pytest.raises(StubError):
        run(make_entries(FORTY), stub(payPeriodEnd="11/14/2026"))


def test_no_floats_and_no_em_dashes_in_output():
    result = run(make_entries(DEMO_WEEK), stub(regularHoursPaid="38.00", grossPay="646.00"))
    text = repr(result)
    assert chr(8212) not in text
    for value in result["totals"].values():
        assert isinstance(value, str)


def test_every_finding_carries_its_numbers_for_translation():
    cases = [
        run(make_entries(DEMO_WEEK), stub(regularHoursPaid="38.00", grossPay="646.00")),
        run(make_entries(FORTY), stub()),
        run(make_entries(FORTY), stub(hourlyRate="12.00", grossPay="480.00")),
        run(make_entries(FORTY[:4]), stub()),
        run(make_entries([day(d, "08:00", "17:00") for d in (9, 10, 11, 12, 13)]), stub(regularHoursPaid="45.00", grossPay="765.00")),
    ]
    for result in cases:
        for finding in result["findings"]:
            assert finding["params"], finding["code"]
            # every number in the English label comes from params
            for value in finding["params"].values():
                assert isinstance(value, str)
    demo = cases[0]["findings"]
    assert demo[0]["params"] == {"missing": "5.5", "logged": "43.5", "paid": "38"}
    assert demo[-1]["params"]["owed"] == "$123.25"

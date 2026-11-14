from decimal import Decimal

from letters.handler import allowed_amounts, only_engine_numbers, template_letters
from rules.engine import check_pay
from test_engine import DEMO_WEEK, make_entries, stub

CHECK = check_pay(make_entries(DEMO_WEEK), stub(regularHoursPaid="38.00", grossPay="646.00"), min_wage=Decimal("15.15"))
WORKER = {"name": "Alex Rivera", "employer": "Desert Sun Logistics LLC"}


def test_template_letters_use_only_engine_numbers():
    letters = template_letters(CHECK, WORKER)
    assert "$123.25" in letters["managerMessage"]
    assert "$123.25" in letters["complaintSummary"]
    assert only_engine_numbers(letters, CHECK)


def test_invented_amount_is_rejected():
    letters = {"managerMessage": "I think I am owed $150.00.", "complaintSummary": "Owed $123.25."}
    assert not only_engine_numbers(letters, CHECK)


def test_same_amount_in_a_different_format_is_accepted():
    letters = {"managerMessage": "About $123.25 may be missing, at $17/hr.", "complaintSummary": "Gross pay was $646."}
    assert only_engine_numbers(letters, CHECK)


def test_empty_or_em_dash_output_is_rejected():
    assert not only_engine_numbers({"managerMessage": "", "complaintSummary": ""}, CHECK)
    assert not only_engine_numbers({"managerMessage": "Hi " + chr(8212) + " $123.25", "complaintSummary": "x"}, CHECK)


def test_allowed_amounts_cover_the_engine_figures():
    assert {Decimal("123.25"), Decimal("769.25"), Decimal("646"), Decimal("25.5"), Decimal("17")} <= allowed_amounts(CHECK)


def test_letters_never_claim_lawbreaking():
    text = " ".join(template_letters(CHECK, WORKER).values()).lower()
    assert "broke the law" not in text and "illegal" not in text

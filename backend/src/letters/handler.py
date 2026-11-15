"""POST /letters: Claude on Bedrock drafts a manager message and a complaint
summary from a check result. The model only writes words. Every dollar amount
in its output must already exist in the engine's result, or we fall back."""
import json
import re

try:  # imported at load time so a cold start pays for it once, before the request
    from anthropic import AnthropicBedrock
except ImportError:  # local runs without the SDK use the template
    AnthropicBedrock = None
from decimal import Decimal, InvalidOperation

from common import config
from common.api import BadRequest, body_of, route

SYSTEM_PROMPT = """You help an hourly worker write about a possible pay shortfall.

You are given JSON from a rules engine that compared the worker's own hour log to their pay stub.

Rules:
- Use only the numbers provided in the JSON. Do not calculate, round, combine or invent any amounts or hours.
- Polite, factual and short. Plain words. No legal threats. No claims that anyone broke a law.
- Say "possibly owed" or "may be missing". Ask for the records to be checked.
- Do not use em dashes.
- managerMessage: a friendly message from the worker to their manager, under 120 words, asking them to look into it.
- complaintSummary: a neutral third-person summary for a wage claim form, under 120 words, listing the pay period, hours logged, hours paid and the amount possibly owed.

Reply with JSON only: {"managerMessage": "...", "complaintSummary": "..."}"""

SPANISH = """

Write both texts in clear, friendly Spanish, the way a worker in Arizona would write to a manager.
Keep every dollar amount exactly as given, with the dollar sign first and a period for cents, like $123.25.
Keep dates as given."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"managerMessage": {"type": "string"}, "complaintSummary": {"type": "string"}},
    "required": ["managerMessage", "complaintSummary"],
    "additionalProperties": False,
}

MONEY_RE = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)")


def _amounts(text):
    found = set()
    for match in MONEY_RE.findall(text):
        try:
            found.add(Decimal(match.replace(",", "").rstrip(".")).normalize())
        except InvalidOperation:
            pass
    return found


def allowed_amounts(check):
    """Every dollar figure the engine produced."""
    allowed = _amounts(json.dumps(check.get("findings", [])))
    for key in ("rate", "effectiveRate", "overtimeRate", "minimumWage"):
        allowed |= _amounts("$" + str(check.get(key, "0")))
    for key in ("expectedGross", "grossPay", "owed"):
        allowed |= _amounts("$" + str(check.get("totals", {}).get(key, "0")))
    for week in check.get("weeks", []):
        allowed |= _amounts("$" + str(week.get("expectedGross", "0")))
    return allowed


def only_engine_numbers(letters, check):
    text = letters.get("managerMessage", "") + " " + letters.get("complaintSummary", "")
    return bool(text.strip()) and chr(8212) not in text and _amounts(text) <= allowed_amounts(check)


def _money(value):
    return "${:,.2f}".format(Decimal(str(value)))


MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
             "October", "November", "December"]
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
             "octubre", "noviembre", "diciembre"]


def period_text(period, lang="en"):
    """'November 8 to 14, 2026' / 'del 8 al 14 de noviembre de 2026', spanning months and years when needed."""
    from datetime import date
    a, b = date.fromisoformat(period["start"]), date.fromisoformat(period["end"])
    if lang == "es":
        if (a.year, a.month) == (b.year, b.month):
            return f"del {a.day} al {b.day} de {MONTHS_ES[b.month - 1]} de {b.year}"
        start = f"{a.day} de {MONTHS_ES[a.month - 1]}" + (f" de {a.year}" if a.year != b.year else "")
        return f"del {start} al {b.day} de {MONTHS_ES[b.month - 1]} de {b.year}"
    if (a.year, a.month) == (b.year, b.month):
        return f"{MONTHS_EN[a.month - 1]} {a.day} to {b.day}, {b.year}"
    start = f"{MONTHS_EN[a.month - 1]} {a.day}" + (f", {a.year}" if a.year != b.year else "")
    return f"{start} to {MONTHS_EN[b.month - 1]} {b.day}, {b.year}"


def _hours(value):
    text = str(value)
    return text.rstrip("0").rstrip(".") if "." in text else text


def template_letters(check, worker, lang="en"):
    """Deterministic fallback. Uses engine numbers only."""
    if lang == "es":
        return template_letters_es(check, worker)
    totals, period = check["totals"], check["payPeriod"]
    name = worker.get("name") or "[your name]"
    employer = worker.get("employer") or "the employer"
    manager = worker.get("managerName") or "there"
    owed, span = _money(totals["owed"]), period_text(period)
    logged, paid = _hours(totals["loggedHours"]), _hours(totals["paidHours"])
    details = " ".join(f["label"] + "." for f in check.get("findings", []) if f["code"] not in ("total", "ok"))
    return {
        "managerMessage": (
            f"Hi {manager},\n\nI was going over my pay stub for {span} and I think something may be missing. "
            f"My own log shows {logged} hours for that period and the stub shows {paid} hours paid. "
            f"By my numbers, {owed} is possibly owed. {details}\n\n"
            f"Could you check the records and let me know? I am happy to share my hour log.\n\nThank you,\n{name}"
        ),
        "complaintSummary": (
            f"{name} worked for {employer} as an hourly employee at {_money(check['rate'])} per hour. "
            f"For the pay period {span}, the worker's own time log shows {logged} hours worked. "
            f"The pay stub shows {paid} hours paid and gross pay of {_money(totals['grossPay'])}. "
            f"Expected gross pay for the logged hours is {_money(totals['expectedGross'])}. "
            f"The amount possibly owed is {owed}. {details}"
        ),
    }


def template_letters_es(check, worker):
    totals, period = check["totals"], check["payPeriod"]
    name = worker.get("name") or "[su nombre]"
    employer = worker.get("employer") or "el empleador"
    manager = worker.get("managerName") or ""
    owed, span = _money(totals["owed"]), period_text(period, "es")
    logged, paid = _hours(totals["loggedHours"]), _hours(totals["paidHours"])
    return {
        "managerMessage": (
            f"Hola{(' ' + manager) if manager else ''},\n\nEstaba revisando mi talón de pago {span} y creo que puede faltar algo. "
            f"Mi propio registro muestra {logged} horas en ese periodo y el talón muestra {paid} horas pagadas. "
            f"Según mis cuentas, posiblemente se me deben {owed}.\n\n"
            f"¿Podría revisar los registros y avisarme? Con gusto le comparto mi registro de horas.\n\nGracias,\n{name}"
        ),
        "complaintSummary": (
            f"{name} trabajó para {employer} como empleado por hora a {_money(check['rate'])} por hora. "
            f"Para el periodo de pago {span}, el registro de horas del trabajador muestra {logged} horas trabajadas. "
            f"El talón de pago muestra {paid} horas pagadas y un pago bruto de {_money(totals['grossPay'])}. "
            f"El pago bruto esperado por las horas registradas es {_money(totals['expectedGross'])}. "
            f"La cantidad que posiblemente se debe es {owed}."
        ),
    }


def _ask_claude(check, worker, lang="en"):
    if AnthropicBedrock is None:
        raise RuntimeError("Anthropic SDK not installed")
    # The standard Bedrock runtime route. The model ID is a cross-region inference profile.
    client = AnthropicBedrock(aws_region=config.BEDROCK_REGION, timeout=12.0, max_retries=0)
    facts = {
        "worker": {k: worker.get(k) for k in ("name", "employer", "managerName") if worker.get(k)},
        "payPeriod": period_text(check["payPeriod"], lang),
        "hourlyRate": "$" + check["rate"],
        "totals": check["totals"],
        "findings": [{"label": f["label"], "math": f["math"]} for f in check["findings"]],
    }
    response = client.messages.create(
        model=config.BEDROCK_MODEL_ID,
        max_tokens=2000,
        system=SYSTEM_PROMPT + (SPANISH if lang == "es" else ""),
        messages=[{"role": "user", "content": json.dumps(facts)}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("model declined")
    text = next(block.text for block in response.content if block.type == "text")
    letters = json.loads(text[text.index("{"): text.rindex("}") + 1])
    return {"managerMessage": str(letters["managerMessage"]), "complaintSummary": str(letters["complaintSummary"])}


def letters(event):
    body = body_of(event)
    check, worker = body.get("check"), body.get("worker") or {}
    lang = "es" if body.get("lang") == "es" else "en"
    if not isinstance(check, dict) or "totals" not in check or "findings" not in check:
        raise BadRequest("Run a pay stub check first.")
    if len(json.dumps(check, default=str)) > 30_000 or len(check.get("findings") or []) > 12:
        raise BadRequest("That check result is too large.", 413)
    if not isinstance(worker, dict):
        raise BadRequest("Invalid worker details.")
    worker = {key: str(worker.get(key) or "")[:120] for key in ("name", "employer", "managerName")}
    # body_of parses numbers as Decimal; the check result only uses strings.
    check = json.loads(json.dumps(check, default=str))

    for attempt in (1, 2):  # regenerate once, then use the template
        try:
            drafted = _ask_claude(check, worker, lang)
            if only_engine_numbers(drafted, check):
                return 200, {**drafted, "source": "bedrock"}
            print(f"Letters attempt {attempt}: output had numbers the engine did not produce.")
        except Exception as err:
            print(f"Letters attempt {attempt} failed: {err!r}")
            # A 4xx (no access, unknown model, bad request) will not fix itself on retry.
            status = getattr(err, "status_code", None)
            if (status is not None and 400 <= status < 500 and status != 429) or isinstance(err, RuntimeError):
                break
    return 200, {**template_letters(check, worker, lang), "source": "template"}


handler = route({"POST /letters": letters})

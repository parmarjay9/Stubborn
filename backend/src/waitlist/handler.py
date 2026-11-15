"""POST /waitlist: someone asks to hear when Plus opens, or an organization
asks about Partners. Stores the email in DynamoDB. Nothing is charged and no
account is made. Emails are personal data: they are never logged."""
import re
from datetime import datetime, timezone

from common import db
from common.api import BadRequest, body_of, route

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[A-Za-z]{2,}$")
PLANS = {"plus", "partners"}


def join(event):
    body = body_of(event)
    email = str(body.get("email") or "").strip().lower()
    if len(email) > 254 or not EMAIL_RE.match(email):
        raise BadRequest("Please enter a valid email address.")
    plan = body.get("plan")
    if plan not in PLANS:
        raise BadRequest("Unknown plan.")
    entry = {
        "email": email,
        "plan": plan,
        "lang": "es" if body.get("lang") == "es" else "en",
        "organization": str(body.get("organization") or "").strip()[:120],
        "joinedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if plan == "partners" and not entry["organization"]:
        raise BadRequest("Please add the name of your organization.")
    db.store().put_waitlist(entry)
    print(f"Waitlist: one {plan} signup")
    return 200, {"ok": True}


handler = route({"POST /waitlist": join})

"""POST /check: run the rules engine on confirmed stub fields + logged shifts."""
import uuid
from datetime import datetime, timezone

from common import config, db
from common.api import BadRequest, body_of, route
from common.hashchain import verify_chain
from rules.engine import StubError, check_pay
from shifts.handler import _device


def check(event):
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    stub = body.get("stub")
    if not isinstance(stub, dict):
        raise BadRequest("Missing pay stub fields.")

    entries = db.store().list_shifts(device_id)
    try:
        result = check_pay(
            entries, stub,
            min_wage=config.AZ_MIN_WAGE,
            week_start_weekday=config.WORKWEEK_START_WEEKDAY,
            overtime_threshold=config.OVERTIME_THRESHOLD_HOURS,
            overtime_multiplier=config.OVERTIME_MULTIPLIER,
        )
    except StubError as err:
        raise BadRequest(str(err))

    result["log"] = verify_chain(entries)
    result["checkId"] = uuid.uuid4().hex[:12]
    result["checkedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.store().put_check(device_id, result["checkId"], {"stub": {k: str(v) for k, v in stub.items()}, "result": result})
    return 200, result


handler = route({"POST /check": check})

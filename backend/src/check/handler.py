"""POST /check runs the rules engine. GET /history lists hours against pay stubs."""
from common import checks
from common.api import BadRequest, body_of, query_of, route
from common.auth import require_device
from rules.engine import StubError
from shifts.handler import _device


def check(event):
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    require_device(event, device_id)
    stub = body.get("stub")
    if not isinstance(stub, dict):
        raise BadRequest("Missing pay stub fields.")
    try:
        return 200, checks.run_check(device_id, stub)
    except StubError as err:
        raise BadRequest(str(err))


def usage(event):
    device_id = _device(query_of(event).get("deviceId"))
    require_device(event, device_id)
    return 200, checks.usage(device_id)


def history(event):
    device_id = _device(query_of(event).get("deviceId"))
    require_device(event, device_id)
    return 200, checks.history(device_id)


handler = route({"POST /check": check, "GET /history": history, "GET /usage": usage})

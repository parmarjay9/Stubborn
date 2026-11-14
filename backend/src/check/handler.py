"""POST /check runs the rules engine. GET /history lists hours against pay stubs."""
from common import checks
from common.api import BadRequest, body_of, query_of, route
from rules.engine import StubError
from shifts.handler import _device


def check(event):
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    stub = body.get("stub")
    if not isinstance(stub, dict):
        raise BadRequest("Missing pay stub fields.")
    try:
        return 200, checks.run_check(device_id, stub)
    except StubError as err:
        raise BadRequest(str(err))


def history(event):
    return 200, checks.history(_device(query_of(event).get("deviceId")))


handler = route({"POST /check": check, "GET /history": history})

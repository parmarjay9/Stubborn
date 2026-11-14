"""Small helpers for API Gateway HTTP API (payload v2) Lambda handlers."""
import base64
import json
from decimal import Decimal


class BadRequest(Exception):
    def __init__(self, message, status=400, extra=None):
        super().__init__(message)
        self.message, self.status, self.extra = message, status, extra or {}


def _default(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f"Cannot serialize {type(value)}")


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=_default),
    }


def body_of(event) -> dict:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        data = json.loads(raw, parse_float=Decimal)
    except ValueError:
        raise BadRequest("The request body is not valid JSON.")
    if not isinstance(data, dict):
        raise BadRequest("The request body must be a JSON object.")
    return data


def query_of(event) -> dict:
    return event.get("queryStringParameters") or {}


def route(routes):
    """Build a Lambda handler from {"METHOD /path": function(event) -> (status, body)}."""
    def handler(event, context=None):
        fn = routes.get(event.get("routeKey", ""))
        if fn is None:
            return respond(404, {"error": "Not found"})
        try:
            status, body = fn(event)
            return respond(status, body)
        except BadRequest as err:
            return respond(err.status, {"error": err.message, **err.extra})
        except Exception as err:  # keep the message plain for the UI, log the detail
            print(f"ERROR {event.get('routeKey')}: {err!r}")
            return respond(500, {"error": "Something went wrong on our side. Please try again."})
    return handler

"""POST /share makes a read-only link to a log and one pay check.
GET /share/{shareId} is what the link shows. Anyone with the link can read it,
but it cannot be used to read anything else or change the log: that needs the
phone's private secret, which is never shared."""
import secrets
from datetime import datetime, timezone

from common import db, seal
from common.api import BadRequest, body_of, route
from common.auth import require_device
from common.hashchain import verify_chain
from shifts.handler import _device

PUBLIC_FIELDS = ("seq", "type", "clientTs", "lat", "lng", "accuracyM", "prevHash", "hash", "serverTs")


def create(event):
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    require_device(event, device_id)
    check_id = body.get("checkId")
    if not isinstance(check_id, str) or not check_id.isalnum() or len(check_id) > 32:
        raise BadRequest("Run a pay stub check first.")
    if db.store().get_check(device_id, check_id) is None:
        raise BadRequest("That pay check was not found. Please run it again.", 404)
    worker = body.get("worker") if isinstance(body.get("worker"), dict) else {}
    share = {
        "shareId": secrets.token_urlsafe(12),
        "deviceId": device_id,
        "checkId": check_id,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "worker": {key: str(worker.get(key) or "")[:120] for key in ("name", "employer")},
    }
    db.store().put_share(share)
    return 201, {"shareId": share["shareId"]}


def read(event):
    share_id = (event.get("pathParameters") or {}).get("shareId", "")
    share = db.store().get_share(share_id) if 8 <= len(share_id) <= 40 else None
    if share is None:
        raise BadRequest("This link does not exist or has been removed.", 404)
    chain = db.store().list_shifts(share["deviceId"])
    record = db.store().get_check(share["deviceId"], share["checkId"]) or {}
    try:
        sealed = seal.latest_for(share["deviceId"], chain)
    except Exception as err:  # the packet still works if the seal store is unreachable
        print(f"Seal lookup failed: {err!r}")
        sealed = None
    return 200, {
        "shareId": share["shareId"],
        "createdAt": share["createdAt"],
        "worker": share["worker"],
        # deviceId is part of each hash, so the page needs it to recompute them.
        # It cannot read or change anything else without the phone's secret.
        "deviceId": share["deviceId"],
        "entries": [{k: e.get(k) for k in PUBLIC_FIELDS} for e in chain],
        "verify": verify_chain(chain),
        "check": record.get("result"),
        "seal": sealed,
    }


handler = route({"POST /share": create, "GET /share/{shareId}": read})

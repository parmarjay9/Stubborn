"""Each phone keeps a private secret next to its device id. The first request
for a device registers the secret's hash; every later request for that device
must present the same secret in the X-Device-Secret header.

This lets the device id be shown publicly (the share page needs it to
recompute hashes) without letting anyone who sees it read pay checks, add
entries, or reset the log."""
import hashlib
import hmac
import re

from common import db
from common.api import BadRequest

SECRET_RE = re.compile(r"^[A-Za-z0-9_-]{32,128}$")


def _hash(secret: str) -> str:
    return hashlib.sha256(f"stubborn-device:{secret}".encode()).hexdigest()


def require_device(event, device_id: str) -> None:
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    secret = headers.get("x-device-secret", "")
    if not SECRET_RE.match(secret):
        raise BadRequest("This phone is not signed in to that log.", 401)
    record = db.store().get_device(device_id) or db.store().claim_device(device_id, _hash(secret))
    if not hmac.compare_digest(record["secretHash"], _hash(secret)):
        raise BadRequest("This phone is not signed in to that log.", 403)

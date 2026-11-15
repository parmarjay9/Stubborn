"""POST /agent/start: record the run, hand it to the worker, return runId.

API Gateway gives up after about 30 seconds, so the TinyFish run happens in
a separate Lambda invoked with InvocationType=Event."""
import json
import os
import threading
import uuid

from agent.runs import now
from common import config, db
from common.api import BadRequest, body_of, route
from common.auth import require_device
from shifts.handler import _device

CLAIM_FIELDS = ("name", "phone", "email", "employer", "payPeriodStart", "payPeriodEnd", "hourlyRate",
                "hoursLogged", "hoursPaid", "amountOwed", "summary")


def start(event):
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    require_device(event, device_id)
    claim = body.get("claim")
    if not isinstance(claim, dict) or not claim.get("name") or not claim.get("employer"):
        raise BadRequest("Please add your name and your employer's name first.")
    claim = {key: str(claim.get(key) or "")[:1500] for key in CLAIM_FIELDS}

    run = {"runId": uuid.uuid4().hex, "deviceId": device_id, "status": "RUNNING", "steps": [],
           "claim": claim, "createdAt": now(), "streamingUrl": None, "result": None}
    db.store().put_run(run)

    if config.LOCAL:
        from agent.worker import run_agent
        threading.Thread(target=run_agent, args=(run["runId"],), daemon=True).start()
    else:
        import boto3
        boto3.client("lambda").invoke(
            FunctionName=os.environ["WORKER_FUNCTION"],
            InvocationType="Event",
            Payload=json.dumps({"runId": run["runId"]}).encode(),
        )
    return 202, {"runId": run["runId"]}


handler = route({"POST /agent/start": start})

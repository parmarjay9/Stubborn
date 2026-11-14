"""GET /agent/status/{runId}: current steps, status and final result."""
from common import db
from common.api import BadRequest, route


def status(event):
    run_id = (event.get("pathParameters") or {}).get("runId", "")
    run = db.store().get_run(run_id) if run_id.isalnum() else None
    if run is None:
        raise BadRequest("Unknown run.", 404)
    return 200, {key: run.get(key) for key in
                 ("runId", "status", "steps", "streamingUrl", "result", "message", "createdAt", "finishedAt")}


handler = route({"GET /agent/status/{runId}": status})

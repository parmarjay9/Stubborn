"""Shared helpers for agent run records."""
from datetime import datetime, timezone

from common import db


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def add_step(run, message):
    run["steps"].append({"step": len(run["steps"]) + 1, "message": message, "ts": now()})
    db.store().put_run(run)


def finish(run, status, message=None, result=None):
    run["status"] = status
    run["finishedAt"] = now()
    if message:
        run["message"] = message
    if result is not None:
        run["result"] = result
    db.store().put_run(run)

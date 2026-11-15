"""Async Lambda: runs the TinyFish web agent and writes progress to the runs table.

TinyFish Web Agent API (docs.tinyfish.ai):
  POST /v1/automation/run-async  {url, goal}  ->  {run_id}
  GET  /v1/runs/{id}  ->  {status, steps[{action}], streaming_url, result, error}

HARD RULE: the agent never submits a form. That is enforced three ways:
  1. the goal prompt forbids it,
  2. the demo form opens with ?agent=1, which renders the Submit button disabled,
  3. this worker stops waiting after AGENT_MAX_SECONDS and cancels the run.
     (TinyFish's own max_steps setting needs their beta program, so it is not sent.)
"""
import json
import os
import time
import urllib.error
import urllib.request

from agent.runs import add_step, finish
from common import config, db

GOAL = """You are helping a worker prepare a wage claim form. Fill in the form on this page with the details below.

STRICT RULES:
- Do NOT click Submit, Send, File, or any button that sends the form. Never submit.
- Do not navigate away from this page.
- When every field is filled, stop and report which fields you filled and their values.

Details to enter:
- Full name: {name}
- Phone: {phone}
- Email: {email}
- Employer name: {employer}
- Pay period start: {payPeriodStart}
- Pay period end: {payPeriodEnd}
- Hourly rate: {hourlyRate}
- Hours worked (from the worker's own log): {hoursLogged}
- Hours paid on the pay stub: {hoursPaid}
- Amount possibly owed: {amountOwed}
- Description of the claim: {summary}

Leave a field empty if no value is given above. Stop before submitting so the worker can review."""


def _api_key():
    key = os.environ.get("TINYFISH_API_KEY")
    if key:
        return key
    if config.LOCAL:
        return None
    try:
        import boto3
        return boto3.client("ssm").get_parameter(
            Name=config.TINYFISH_KEY_PARAM, WithDecryption=True)["Parameter"]["Value"]
    except Exception as err:
        print(f"Could not read the TinyFish key: {err!r}")
        return None


def _call(method, path, key, payload=None):
    request = urllib.request.Request(
        config.TINYFISH_BASE_URL + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={"X-API-Key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as err:
        # Log TinyFish's own explanation; the status code alone hides the cause.
        print(f"TinyFish {method} {path} -> {err.code}: {err.read()[:300]!r}")
        raise


def claim_form_url():
    return os.environ.get("CLAIM_FORM_URL") or (
        f"{config.FRONTEND_URL}/demo-claim-form?agent=1" if config.FRONTEND_URL else "")


def run_agent(run_id):
    run = db.store().get_run(run_id)
    if run is None:
        return
    key, url = _api_key(), claim_form_url()
    if not key or not url.startswith("https://"):
        finish(run, "UNAVAILABLE", "The live agent is not set up in this environment.")
        return

    try:
        add_step(run, "Opening the wage claim form...")
        started = _call("POST", "/v1/automation/run-async", key, {
            "url": url,
            "goal": GOAL.format(**run["claim"]),
        })
        tinyfish_id = started.get("run_id")
        if not tinyfish_id:
            raise RuntimeError(f"TinyFish did not start a run: {started.get('error')}")
        run["tinyfishRunId"] = tinyfish_id

        seen, deadline = 0, time.time() + config.AGENT_MAX_SECONDS
        while time.time() < deadline:
            time.sleep(2)
            status = _call("GET", f"/v1/runs/{tinyfish_id}?screenshots=none&html=none", key)
            if status.get("streaming_url") and not run["streamingUrl"]:
                run["streamingUrl"] = status["streaming_url"]
                db.store().put_run(run)
            actions = [s.get("action") for s in status.get("steps") or [] if s.get("action")]
            for action in actions[seen:]:
                add_step(run, action[:200])
            seen = max(seen, len(actions))

            state = status.get("status")
            if state == "COMPLETED":
                add_step(run, "Stopped before submit for your review")
                finish(run, "COMPLETED", result=status.get("result"))
                return
            if state in ("FAILED", "CANCELLED"):
                error = (status.get("error") or {}).get("message") or "The agent could not finish."
                finish(run, "FAILED", error)
                return

        try:
            _call("POST", f"/v1/runs/{tinyfish_id}/cancel", key)
        except Exception as err:
            print(f"Cancel failed: {err!r}")
        finish(run, "FAILED", "The agent took too long.")
    except (urllib.error.URLError, RuntimeError, ValueError, KeyError) as err:
        print(f"Agent run failed: {err!r}")
        finish(run, "FAILED", "The agent could not be reached.")


def handler(event, context=None):
    run_agent(event["runId"])

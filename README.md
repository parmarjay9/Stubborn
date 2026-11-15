# Stubborn

**Your hours. Your proof. Your pay.**

A mobile-first web app that helps hourly workers catch unpaid wages. Built solo by Jay Parmar at sunhacks 2026 (ASU Tempe).

1. **Record.** Tap to clock in and out. Each entry is stamped with time and location, hashed with SHA-256 and chained to the entry before it. The server recomputes every hash on receipt, so the log cannot be edited later without the chain breaking.
2. **Catch.** Photograph a pay stub. Amazon Textract reads the hours, rate and gross pay. The worker confirms the values, and a tested rules engine compares the stub to the worker's own log and itemizes what is possibly owed.
3. **Act.** Claude on Amazon Bedrock drafts a polite note to the manager and a claim summary, using only numbers from the rules engine. A TinyFish web agent fills in a wage claim form and stops before submitting so the worker can review it.

Stubborn flags possible underpayment. It is not legal advice.

### Also built in

- **Clock in without signal.** Taps are hashed and chained on the phone, saved there when there is no connection, and sent in order once the phone is back online. The server still checks every hash and records when it really got each one.
- **Evidence packet.** One page per pay check with a QR code (`/v/<id>`). Whoever opens it recomputes every fingerprint in their own browser, sees the server's check and the locked seal, and can save it as a PDF. The link is read-only.
- **Nightly locked seal.** At 11:59 PM Arizona time, a Lambda writes every log's newest fingerprint to an S3 bucket with Object Lock (governance mode, 30 days). Device ids are salted and hashed in the seal. This catches even a chain that someone rewrote with fresh hashes.
- **Device secrets.** Each phone has a private secret next to its device id. The first phone to use a log registers it, and every read or write of that log must present it, so a device id seen in a share link gives no access.
- **Spanish.** EN/ES switch on every screen and the packet. The rules engine returns each finding's numbers separately, so numbers never pass through translation. Claude writes the letters in Spanish, with the same dollar-amount check.
- **Payday reminder.** A repeating calendar event (.ics) for weekly or biweekly paydays.

## Run it locally

No AWS account is needed for local development. The same Lambda handlers run behind a small local server with JSON file storage.

```bash
# one-time setup
python3 -m venv .venv && .venv/bin/pip install pytest pillow boto3 "anthropic[bedrock]"
cd frontend && npm install && cd ..

# terminal 1: API on http://localhost:8787
.venv/bin/python backend/local_server.py

# terminal 2: app on http://localhost:5173
cd frontend && npm run dev

# make the sample pay stub images
.venv/bin/python demo/make_stubs.py
```

### The sample account

Tap "Open the sample account" on the home page (or add `?demo=1` to the URL) to browse as Alex Rivera, a made-up warehouse worker. It loads four weeks of hours and three pay stubs that are already checked, so the History page shows hours against pay stubs right away. The newest week (43.5 hours) is left unchecked for the live demo. The sample account also shows the tamper switch on the hours page.

Each browser gets its own copy of the sample data, so visitors cannot change each other's. "Exit" in the yellow bar returns to your own account. The data lives in `backend/src/common/sample.py`.

Without AWS credentials, each cloud feature falls back the same way it does in production: stub fields are typed by hand, letters come from a template, and the agent panel replays the saved run in `demo/fallback/run.json`.

## Tests

```bash
cd backend && ../.venv/bin/python -m pytest      # rules engine, hash chain, letter checks
cd frontend && npx vitest run                    # hash chain matches the Python side
```

The demo case is a test: 43.5 hours logged at $17.00, stub pays 38 regular hours, gross $646.00. Expected gross is $769.25, so **$123.25** is possibly owed.

## Live

- Website: https://main.d3ephm9p0a7e00.amplifyapp.com (AWS Amplify)
- API: https://j1m5comkbd.execute-api.us-west-2.amazonaws.com (API Gateway + Lambda, us-west-2)

## Deploy

```bash
aws login --region us-west-2      # browser sign-in; credentials stay in ~/.aws, never in the repo
scripts/deploy.sh                 # backend (SAM) then frontend (Amplify zip upload)
scripts/deploy.sh frontend        # just the website
```

The TinyFish key lives only in AWS SSM Parameter Store:

```bash
aws ssm put-parameter --name /stubborn/tinyfish-api-key --type SecureString --region us-west-2 --value "YOUR_KEY"
```

Claude on Bedrock needs model access in the Bedrock console. Until it is granted, letters fall back to a template built from the same engine numbers.

### Keeping secrets out of git

- `.gitignore` covers `.env` files, keys and certificates, `samconfig.toml`, `.aws/`, build output and local data.
- `.githooks/pre-commit` blocks commits that contain AWS keys, Anthropic keys, private keys or API key values. Turn it on once per clone with `git config core.hooksPath .githooks`.
- API Gateway rate limits every route, with tighter limits on the paid routes (Textract, Bedrock, TinyFish), so nobody can run up the bill.

## How it is built

| Piece | What it does |
|---|---|
| React + Vite + TypeScript + Tailwind | Mobile-first installable web app. Bottom nav on phones, top nav on wider screens. |
| API Gateway (HTTP API) + Lambda (Python 3.12) | All endpoints. Defined in `backend/template.yaml` with AWS SAM. |
| DynamoDB | Shift entries, check results (these drive the History page), agent runs, share links, device secret hashes. |
| S3 | Pay stub photos, uploaded with a presigned URL and deleted after 7 days. |
| S3 Object Lock + EventBridge Scheduler | Nightly sealed copy of every log's latest fingerprint that cannot be edited or deleted for 30 days. |
| Amazon Textract | `AnalyzeDocument` with Queries reads the stub. Fields under 80% confidence are highlighted for the worker to check. |
| Rules engine (`backend/src/rules/engine.py`) | Pure functions, `Decimal` only. Pairs shifts, splits them by workweek, applies overtime and minimum wage, itemizes findings. |
| Amazon Bedrock (Claude) | Writes the two letters. Every dollar amount in the output must already exist in the engine result, or it regenerates once and then falls back to a template. |
| TinyFish Web Agent API | `run-async` starts the run from a worker Lambda, which polls it and writes each step to DynamoDB. The app polls status every 2 seconds. |

### The hash chain

Each entry hashes the canonical JSON of its eight fields (keys sorted, no whitespace, coordinates as fixed 6-decimal strings) plus the hash of the previous entry. The same logic lives in `frontend/src/lib/hashchain.ts` and `backend/src/common/hashchain.py`, and both test suites hardcode the same known hash. `GET /shifts/verify` walks the chain and reports the first entry where it breaks.

### The agent never submits

Three separate guards: the goal prompt forbids it, the form opens in an agent mode where the Submit button is disabled, and each run has a time and step cap.

## Wage claim form: what really exists

Checked on November 14, 2026:

- The Industrial Commission of Arizona (ICA) Labor Department does take unpaid wage claims online. Its Unpaid Wage Claim Form can be completed electronically, or sent by email, fax or mail. Claims may not exceed $12,000; larger claims go to the US Department of Labor Wage and Hour Division or to court.
- The form must be signed and dated by the claimant (electronic signatures are accepted), and minimum wage complaints use a separate form.
- The ICA site refuses automated requests (it returned HTTP 403 to non-browser clients during this check).

Because the real form needs the worker's own signature, blocks automated traffic, and should never receive made-up demo data, Stubborn points the agent at its own practice form at `/demo-claim-form`. That page is labeled "Demo wage claim form. Not a government website." and uses no agency name, seal or styling. The agent target is one setting (`CLAIM_FORM_URL`), so a real form could be used later with the worker's consent.

Sources: [ICA Unpaid Wage Claim Form](https://www.azica.gov/forms/unpaid-wage-claim-form), [ICA Labor Department](https://www.azica.gov/labor-department).

## Legal values

The Arizona minimum wage is **$15.15 per hour** as of January 1, 2026. It lives in `backend/src/common/config.py` with its source: [ICA, 2026 Minimum Wage Increase](https://www.azica.gov/news/2026-minimum-wage-increase-effective-january-1-2026), cross-checked against the [US DOL state minimum wage table](https://www.dol.gov/agencies/whd/minimum-wage/state).

## Scope and honest limits

- Covers hourly, non-tipped workers with one hourly rate and one employer, in Arizona. Checks federal overtime (over 40 hours in a workweek at 1.5x) and the Arizona minimum wage. Weekly and biweekly pay periods.
- Does not cover tipped or salaried workers, multiple rates, break and meal rules, or other states.
- The hash chain shows the log was not edited after the fact. It does not prove the worker was really working. Server receipt times and location stamps make the log harder to fake.
- A web app cannot run background geofencing, so clock in and out is one tap with a location stamp.
- If the stub rate is below the minimum wage, expected pay is figured at the minimum wage.
- `demo/fallback/run.json` currently holds scripted sample steps, and the app labels it "sample run". Replace it with the steps from one real TinyFish run before relying on it as a recording.

# Stubborn

**Your hours. Your proof. Your pay.**

A mobile-first web app that helps hourly workers catch unpaid wages. Built solo by Jay Parmar at sunhacks 2026 (ASU Tempe).

1. **Record.** Tap to clock in and out. Each entry is stamped with time and location, hashed with SHA-256 and chained to the entry before it. The server recomputes every hash on receipt, so the log cannot be edited later without the chain breaking.
2. **Catch.** Photograph a pay stub. Amazon Textract reads the hours, rate and gross pay. The worker confirms the values, and a tested rules engine compares the stub to the worker's own log and itemizes what is possibly owed.
3. **Act.** Claude on Amazon Bedrock drafts a polite note to the manager and a claim summary, using only numbers from the rules engine. A TinyFish web agent fills in a wage claim form and stops before submitting so the worker can review it.

Stubborn flags possible underpayment. It is not legal advice.

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

# seed the demo week (43.5 hours) and make the sample stubs
.venv/bin/python demo/seed_week.py
.venv/bin/python demo/make_stubs.py
```

Open `http://localhost:5173/?demo=1` to use the seeded demo device (`?demo=0` switches back). The demo device also shows the tamper switch on the hours page.

Without AWS credentials, each cloud feature falls back the same way it does in production: stub fields are typed by hand, letters come from a template, and the agent panel replays the saved run in `demo/fallback/run.json`.

## Tests

```bash
cd backend && ../.venv/bin/python -m pytest      # rules engine, hash chain, letter checks
cd frontend && npx vitest run                    # hash chain matches the Python side
```

The demo case is a test: 43.5 hours logged at $17.00, stub pays 38 regular hours, gross $646.00. Expected gross is $769.25, so **$123.25** is possibly owed.

## Deploy

```bash
# 1. TinyFish key goes in SSM, never in the repo
aws ssm put-parameter --name /stubborn/tinyfish-api-key --type SecureString --value "YOUR_KEY"

# 2. Backend
cd backend && sam build && sam deploy --guided
#    Parameters: FrontendUrl (public https URL of the app), BedrockModelId

# 3. Frontend: set VITE_API_URL to the ApiUrl stack output, then host frontend/ on AWS Amplify
```

On Amplify, add a rewrite rule so page refreshes work in the single page app: source `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff2?|ttf|map|json|webmanifest)$)([^.]+$)/>`, target `/index.html`, type `200 (Rewrite)`.

Before the first deploy, request access to a Claude model in the Bedrock console and confirm the model ID that `BedrockModelId` should use.

## How it is built

| Piece | What it does |
|---|---|
| React + Vite + TypeScript + Tailwind | Mobile-first installable web app. Bottom nav on phones, top nav on wider screens. |
| API Gateway (HTTP API) + Lambda (Python 3.12) | All endpoints. Defined in `backend/template.yaml` with AWS SAM. |
| DynamoDB | Shift entries, check results, agent runs. |
| S3 | Pay stub photos, uploaded with a presigned URL and deleted after 7 days. |
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

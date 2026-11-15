# Stubborn

**Your hours. Your proof. Your pay.**

Stubborn keeps a record of your work hours that shows if anyone changes it, checks your pay stub against it, and helps you ask for wages you may be owed.

- **Live:** https://getstubborn.club
- Built solo by [Jay Parmar](https://jayparmar9.vercel.app) at [sunhacks 2026](https://sunhacks.io), ASU Tempe.

Stubborn flags possible underpayment. It is not legal advice.

## How it works

1. **Record.** Tap to clock in and out. Each tap is stamped with the time and location, given a SHA-256 fingerprint and chained to the one before it. The server checks every fingerprint when it arrives, so nobody can edit the log later without it showing. Works without signal.
2. **Catch.** Take a photo of your pay stub. Amazon Textract reads the hours, rate, gross pay and pay period, you confirm them, and a rules engine compares the stub to your log. It applies federal overtime and the Arizona minimum wage and shows what may be missing, line by line.
3. **Act.** Get a polite note for your manager (written by Claude on Amazon Bedrock, or a template), an evidence packet anyone can verify with a QR code, and a wage claim form filled in by a TinyFish web agent that stops before submitting.

Also included: a History page of hours against pay stubs, a sample account, full Spanish, a payday calendar reminder, and a pricing page with a waitlist.

## Try it

1. Open https://getstubborn.club and tap **Open the sample account**. You browse as Alex Rivera, a made-up warehouse worker with four weeks of hours and three checked pay stubs.
2. **Check** tab: tap **Use this sample pay stub**. The result is **$123.25** possibly owed.
3. **Act** tab: draft the note, make the evidence packet, and run the claim form agent.
4. To watch the log catch an edit, open `/log?tamper=1` in the sample account and flip the switch. It is hidden otherwise to keep the page simple.

Each browser gets its own copy of the sample data, and **Exit** in the yellow bar returns to your own account.

## What's inside

| Part | What it does |
|---|---|
| React + TypeScript + Vite + Tailwind | Mobile-first installable web app, in English and Spanish. Hosted on AWS Amplify. |
| API Gateway + 11 Lambda functions (Python 3.12) | All endpoints, defined in `backend/template.yaml` with AWS SAM. Every route is rate limited. |
| DynamoDB | Hours, pay checks, agent runs, share links, device secret hashes and the waitlist. |
| S3 | Pay stub photos, deleted after 7 days. |
| S3 Object Lock + EventBridge Scheduler | A nightly sealed copy of every log's latest fingerprint that cannot be changed or deleted for 30 days. |
| Amazon Textract | Reads the stub with Queries. Fields under 80% confidence are highlighted for the worker to check. |
| Rules engine (`backend/src/rules/engine.py`) | Exact decimal math, no AI. Pairs shifts, splits them by workweek, applies overtime and minimum wage, lists each finding. |
| Amazon Bedrock (Claude Sonnet 4.6) | Writes the manager note and claim summary. Any dollar amount the engine did not produce is rejected, and the app falls back to a template. |
| TinyFish Web Agent API | Fills in the claim form from a background Lambda; the app shows each step live. |
| Systems Manager Parameter Store | Holds the TinyFish key, encrypted. |

**The hash chain.** Each entry's fingerprint covers its details (keys sorted, coordinates as fixed 6-decimal text) plus the previous fingerprint. The same code exists in `frontend/src/lib/hashchain.ts` and `backend/src/common/hashchain.py`, and both test suites pin the same known fingerprint.

**The agent never submits.** The goal forbids it, the form opens with Submit switched off for the agent, and the app stops waiting after 90 seconds. If a live run fails or runs long, the app replays a real recorded run (`demo/fallback/run.json`: 11 fields in 69 seconds, no submit) and says so.

**Device secrets.** Each phone keeps a private secret, and every read or change of its log needs it. The evidence packet shows a log's ID so anyone can recompute its fingerprints, but the ID alone gives no access.

## Run it locally

No AWS account is needed. The same Lambda handlers run behind a small local server that stores data in a JSON file.

```bash
# one-time setup
python3 -m venv .venv && .venv/bin/pip install pytest pillow boto3 "anthropic[bedrock]"
cd frontend && npm install && cd ..

# terminal 1: API on http://localhost:8787
.venv/bin/python backend/local_server.py

# terminal 2: app on http://localhost:5173
cd frontend && npm run dev
```

Without AWS credentials, each cloud feature falls back the same way it does in production: stub fields are typed by hand, letters come from a template, and the agent panel replays the recorded run.

## Tests

```bash
cd backend && ../.venv/bin/python -m pytest   # 45 tests: rules engine, hash chain, letters, sharing, seal, waitlist
cd frontend && npx vitest run                 # 7 tests: hash chain matches Python, Spanish keeps every number
```

The demo case is a test: 43.5 hours logged at $17.00, a stub paying 38 regular hours with gross pay of $646.00. Expected pay is $769.25, so **$123.25** is possibly owed.

## Deploy

```bash
aws login --region us-west-2   # browser sign-in; credentials stay in ~/.aws, never in the repo
scripts/deploy.sh              # backend (SAM), then frontend (Amplify)
scripts/deploy.sh frontend     # website only
```

The TinyFish key is stored only in AWS Systems Manager Parameter Store:

```bash
aws ssm put-parameter --name /stubborn/tinyfish-api-key --type SecureString --region us-west-2 --value "YOUR_KEY"
```

Claude on Bedrock needs model access and quota on the AWS account. Without them, letters use the template with the same numbers.

To see the pricing waitlist:

```bash
aws dynamodb scan --region us-west-2 --table-name $(aws cloudformation describe-stack-resource --stack-name stubborn --logical-resource-id WaitlistTable --query StackResourceDetail.PhysicalResourceId --output text) --query 'Items[].[email.S,plan.S,organization.S,joinedAt.S]' --output table
```

**Keeping secrets out of git:** `.gitignore` covers `.env` files, keys, certificates and deploy settings, and `.githooks/pre-commit` blocks commits that contain keys. Turn the hook on once per clone with `git config core.hooksPath .githooks`.

## Pricing

A freemium preview at `/pricing`. Payments are not switched on.

- **Free:** clocking in (never limited), the log, the nightly seal, offline use, history, 2 pay stub checks a month and a ready-made note.
- **Plus, $3 a month:** unlimited checks, AI-written letters, evidence packets and the claim form agent.
- **Partners:** unions, worker centers and legal aid clinics pay so their members get Plus free.

The Check page shows how many free checks were used this month and links to Plus when they run out; it does not block anyone yet. The app never asks for card details.

## The wage claim form: what really exists

Checked on November 14, 2026: the Industrial Commission of Arizona (ICA) Labor Department accepts unpaid wage claims online, by email, fax or mail, up to $12,000. The form must be signed by the worker, and the ICA site blocks automated traffic. So the agent fills Stubborn's own practice form at `/demo-claim-form`, labeled "Demo wage claim form. Not a government website." with no agency name or styling.

Sources: [ICA Unpaid Wage Claim Form](https://www.azica.gov/forms/unpaid-wage-claim-form), [ICA Labor Department](https://www.azica.gov/labor-department).

## Legal values

The Arizona minimum wage is **$15.15 per hour** as of January 1, 2026. It lives in `backend/src/common/config.py` with its source: [ICA, 2026 Minimum Wage Increase](https://www.azica.gov/news/2026-minimum-wage-increase-effective-january-1-2026), cross-checked against the [US DOL state minimum wage table](https://www.dol.gov/agencies/whd/minimum-wage/state).

## Limits

- Covers hourly, non-tipped workers in Arizona with one pay rate and one employer, weekly or biweekly pay. Checks federal overtime (over 40 hours in a workweek at 1.5 times the rate) and the Arizona minimum wage.
- Does not cover tipped or salaried workers, multiple rates, break and meal rules, or other states.
- The log shows it was not changed after the fact. It cannot prove the worker was at work, though the time and place on each tap make it hard to fake.
- A web app cannot clock in automatically by location, so clocking in is one tap.
- Live agent steps come from TinyFish in English, so they stay in English in Spanish mode.
- At the time of submission the AWS account's Bedrock quota for Claude was zero, so live letters used the template.

# Stubborn

**Your hours. Your proof. Your pay.**

Live: https://getstubborn.club
Code: https://github.com/parmarjay9/Stubborn
Built at [sunhacks 2026](https://sunhacks.io), ASU Tempe.

## Inspiration

When an hourly worker's paycheck comes up short, the only record of their hours usually belongs to the employer. The worker has a memory, maybe a note in their phone, and a pay stub that is hard to read. If they ask about it, it is their word against the company's timeclock.

I wanted to flip that. What if every hourly worker carried their own timeclock, one that nobody could quietly edit, and a simple way to hold a pay stub up against it?

## What it does

Stubborn is a mobile-first web app with three steps.

**1. Record.** The worker taps one big button to clock in and out. Each tap is stamped with the time and location, fingerprinted with SHA-256, and chained to the entry before it. Change any entry later and every fingerprint after it stops matching. It works without signal: taps are saved on the phone and sent when the connection comes back.

**2. Catch.** On payday the worker photographs their pay stub. Amazon Textract reads the hours, rate, gross pay and pay period. The worker confirms the numbers (anything Textract is unsure about is highlighted), and a rules engine compares the stub to the log. It applies federal overtime and the Arizona minimum wage and shows the gap to the cent, line by line, with the math behind every line.

**3. Act.** The worker picks how to follow up:
- **A polite note to the manager**, drafted by Claude on Amazon Bedrock in English or Spanish. The model only writes words. Every dollar amount in its output is checked against the rules engine, and if one does not match, the app regenerates once and then falls back to a template.
- **An evidence packet**: one page with the result, the hours behind it and a QR code. Whoever scans it recomputes every fingerprint in their own browser, so they do not have to trust the worker or us. It saves as a PDF.
- **A wage claim form filled in by a TinyFish web agent**, which types in the worker's details and stops before submitting so the worker can review it.

Around those three steps:
- **History** lines up every pay period's logged hours against what the stub paid, with a running total of what may be owed.
- **A sample account.** One tap on the home page loads a made-up warehouse worker, Alex Rivera, with four weeks of hours and three checked pay stubs. Alex's stub for the newest week is built in, so anyone can try the whole flow in about a minute without a paper stub.
- **A payday reminder** that adds a repeating event to the phone's calendar.
- **Full Spanish.** One switch changes every screen, the letters and the evidence packet.
- **Pricing** with a free tier and a waitlist for the paid plan (see Business model).

## How I built it

- **Frontend:** React, Vite, TypeScript and Tailwind, as an installable web app. Hosted on **AWS Amplify**.
- **API:** **Amazon API Gateway** (HTTP API) in front of **AWS Lambda** functions in Python 3.12, defined with **AWS SAM**. Every route is rate limited, with tighter limits on the routes that cost money.
- **Storage:** **Amazon DynamoDB** for shift entries, pay checks, agent runs, share links and the pricing waitlist. **Amazon S3** for stub photos, which are deleted after 7 days.
- **Reading the stub:** **Amazon Textract** `AnalyzeDocument` with Queries, so I ask for exactly the six values I need and get a confidence score for each.
- **The math:** a pure Python rules engine using `Decimal` only, with no AI involved. It pairs clock-ins with clock-outs, splits shifts at workweek boundaries, applies overtime per workweek and itemizes the findings. Its tests include the demo case that must come out to exactly $123.25.
- **The letters:** **Amazon Bedrock** with Claude Sonnet 4.6. The prompt receives only the engine's findings, and the output is rejected if it contains a dollar amount the engine did not produce.
- **The agent:** the **TinyFish** Web Agent API. API Gateway times out at about 30 seconds, so one Lambda starts the run and returns right away, a second Lambda follows the TinyFish run and writes each step to DynamoDB, and the phone polls every 2 seconds to show a live checklist.
- **The nightly seal:** an **Amazon EventBridge Scheduler** job writes every log's latest fingerprint to an **S3 bucket with Object Lock**. Nobody can change or delete a sealed file for 30 days. This catches even someone who rewrites the whole chain with fresh fingerprints.
- **The hash chain:** the same canonical JSON and SHA-256 logic is written twice, in TypeScript for the phone and Python for the server, and both test suites pin the same known fingerprint so they can never drift apart.
- **Domain:** getstubborn.club, a GoDaddy Registry domain, pointed at Amplify with free HTTPS.

## How TinyFish is used

When the worker taps "Fill in the claim form for me", the backend gives TinyFish the form's address and a goal with the worker's details and the amount possibly owed. TinyFish opens the page in its own cloud browser and types each field in. In testing it filled all 11 fields in 69 seconds and reported that no submit button was clicked.

The agent never submits. That is enforced three ways: the goal forbids it, the form opens in an agent mode where the Submit button is disabled, and the app stops waiting after 90 seconds. If a live run fails or runs long, the app replays that real recorded run and says "Showing a recorded run."

I checked what really exists first. Arizona's Industrial Commission does accept unpaid wage claims online, but its form needs the worker's own signature, blocks automated traffic, and should never receive made-up demo data. So the agent fills a practice form that is clearly labeled "Demo wage claim form. Not a government website."

## Challenges

- **Two languages, one fingerprint.** JavaScript and Python print floating-point numbers differently, which would make the same entry hash differently on the phone and the server. I fixed it by writing coordinates as fixed 6-decimal strings before hashing.
- **Keeping the AI away from the money.** A language model that invents one number would destroy the worker's credibility. So the model never calculates anything, and its output is checked amount by amount against the engine.
- **A share link that cannot be abused.** The evidence packet has to reveal the log's ID so a stranger can recompute the fingerprints. That ID used to be the only key to the log. I added a private secret that never leaves the phone, so the public ID gives no access.
- **A brand-new AWS account.** New accounts start with zero Bedrock quota for Claude models. The letters integration is built and deployed against Claude Sonnet 4.6; when the quota is not available, the app falls back to a template that uses the same engine numbers, so the worker always gets a letter.
- **Keeping it simple.** A tool for people who are already stressed about money has to be easy to read. I kept the wording plain, put one main action on each screen, and moved the stage-only demo switch out of everyday view.
- **Honest scope.** A web app cannot do background geofencing, so clock-in is one tap with a location stamp instead of automatic.

## Accomplishments I'm proud of

- One complete flow that works end to end on a real deployment: clock in, photograph a stub, see the exact gap, and walk away with a note, a verifiable packet and a filled claim form.
- A stranger can verify a worker's log on their own phone without trusting anyone.
- The whole app works in Spanish, and numbers never pass through translation.
- 51 automated tests, a pre-commit check that blocks secrets, and nothing secret in the repository.

## What I learned

Textract Queries, Bedrock, SAM, S3 Object Lock, the TinyFish agent API, and how to build a hash chain that matches across JavaScript and Python. I also learned how much product design goes into saying "possibly owed" instead of making an accusation.

## Business model

Freemium, shown side by side on the pricing page. Payments are not switched on yet. "Notify me" and "Talk to us" open a short form that saves an email (and the organization name, for Partners) to a waitlist. The app never asks for card details; paid sign-up would use a hosted payment page such as Stripe Checkout.
- **Free:** the log, the nightly seal, offline clock-in, two pay stub checks a month and a ready-made note. A worker's own record should never cost money, so clocking in is never limited. The Check page shows a meter of free checks used this month and points to Plus once they run out. During the hackathon it never blocks anyone.
- **Plus, $3 a month:** unlimited checks, AI-written letters, evidence packets and the claim form agent. These are the parts that cost money per use.
- **Partners:** unions, worker centers and legal aid clinics pay for seats so their members get Plus for free.

It runs entirely on pay-per-use services, so costs only rise when people use it, which is what lets it grow from one worker to thousands without raising prices. Stubborn never takes a cut of recovered wages and does not sell data.

## What's next

- More states. The rules engine is driven by config, so a new state is a new rule file.
- Tipped workers, multiple pay rates, and break and meal rules.
- A native app with automatic clock-in by location.
- With the worker's consent and signature, filling the real state claim form.
- A partner dashboard for worker centers and legal aid clinics.
- Payments through Stripe Checkout, opening Plus to the waitlist.

## Limits, stated plainly

Stubborn covers hourly, non-tipped workers in Arizona with one rate and one employer. It flags possible underpayment and is not legal advice. The hash chain shows the log was not edited after the fact. It cannot prove the worker was actually working, though server receipt times and location stamps make the log harder to fake.

## Built with

React, TypeScript, Vite, Tailwind CSS, Python, AWS Lambda, Amazon API Gateway, Amazon DynamoDB, Amazon S3 (with Object Lock), Amazon Textract, Amazon Bedrock (Claude), Amazon EventBridge Scheduler, AWS Amplify, AWS SAM, AWS Systems Manager Parameter Store, TinyFish Web Agent API, GoDaddy Registry (.club domain)

## Demo notes

- Start at https://getstubborn.club and tap **Open the sample account**.
- **Check** tab: tap Alex Rivera's stub to see it full size, then **Use this sample pay stub**. The result is $123.25.
- To show the log catching an edit on stage, open https://getstubborn.club/log?tamper=1 in the sample account and flip the switch. The badge turns red. Flip it back to undo.
- **Act** tab: draft the note, make the evidence packet (scan its QR code with a second phone), and run the claim form agent.

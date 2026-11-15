# Stubborn

**Elevator pitch (Devpost, 200 characters max):**
Stubborn keeps a record of your work hours that shows whether anyone has changed it, checks your pay stub against it, and helps you request wages you may be owed.

**Tagline:** Your hours. Your proof. Your pay.

- Live: https://getstubborn.club
- Code: https://github.com/parmarjay9/Stubborn
- Built solo by Jay Parmar at [sunhacks 2026](https://sunhacks.io), ASU Tempe.

---

## Inspiration

When an hourly worker's paycheck comes up short, the only record of their hours usually belongs to the employer. The worker has a memory, maybe a note in their phone, and a pay stub that is hard to read. If they ask about it, it is their word against the company's time clock.

I wanted to flip that. What if every hourly worker carried their own time clock, one that nobody could quietly edit, and a simple way to hold a pay stub up against it?

## What it does

Stubborn is a mobile-first web app built around three steps.

**1. Record.** The worker taps one big button to clock in and out. Each tap is stamped with the time and location, given a fingerprint (a SHA-256 hash), and chained to the entry before it. If anyone changes an entry later, every fingerprint after it stops matching, and the log shows a red "Changed" stamp. It works without signal: taps are saved on the phone and sent when the connection comes back.

**2. Catch.** On payday, the worker takes a photo of their pay stub. Amazon Textract reads the hours, rate, gross pay, and pay period, and highlights anything it is unsure about for the worker to check. A rules engine then compares the stub to the worker's own log. It applies federal overtime and the Arizona minimum wage and shows what may be missing, to the cent, with the math behind every line.

**3. Act.** The worker chooses how to follow up:
- **A polite note to the manager** and a claim summary, in English or Spanish.
- **An evidence packet:** one page with the result, the hours behind it, and a QR code. Whoever scans it recomputes every fingerprint on their own phone, so they do not have to trust the worker or us. It saves as a PDF.
- **A wage claim form filled in by an AI web agent** (TinyFish), which types in the worker's details and stops before submitting so the worker can review it.

Around those three steps:
- **History** lines up every pay period's logged hours against what the stub paid, with a running total of what may be owed.
- **A sample account. **** One tap on the home page loads a made-up warehouse worker, Alex Rivera, with four weeks of hours and three checked pay stubs. Alex's stub for the newest week is built in, so anyone can try the whole flow in about a minute.
- **Full Spanish.** One switch changes every screen, the letters, and the evidence packet.
- **A payday reminder** that adds a repeating event to the phone's calendar.
- **Pricing** with a free tier, a waitlist for the paid plan, and a meter of free checks used this month.

## How I built it

- **Frontend:** React, TypeScript, Vite, and Tailwind, as an installable web app, hosted on **AWS Amplify** at getstubborn.club (a GoDaddy Registry domain).
- **API:** **Amazon API Gateway** in front of 11 **AWS Lambda** functions in Python, all defined with **AWS SAM**. Every route has a rate limit, with tighter limits on the ones that cost money.
- **Storage:** **Amazon DynamoDB** for hours, paychecks, agent runs, share links, and the waitlist. **Amazon S3** for stub photos, which are deleted after 7 days.
- **Reading the stub:** **Amazon Textract** with Queries, so I ask for exactly the six values I need and get a confidence score for each.
- **The math:** a rules engine in plain Python using exact decimals, with no AI involved. It pairs clock-ins with clock-outs, splits shifts by workweek, applies weekly overtime, and lists each finding. The demo case must come out to exactly $123.25; this is a test.
- **The letters:** **Amazon Bedrock** with Claude Sonnet 4.6. The model only receives the engine's findings, and any letter that contains a dollar amount the engine did not produce is rejected. If that happens, or Claude is unavailable, the app uses a template with the same numbers, so the worker always gets a letter.
- **The agent:** the **TinyFish** Web Agent API, run from a background Lambda because runs take longer than API Gateway allows. The phone checks progress every 2 seconds and shows each step as a live checklist.
- **The nightly seal:** **Amazon EventBridge Scheduler** runs a job every night that writes each log's latest fingerprint to an **S3 bucket with Object Lock**, where nobody can change or delete it for 30 days. That catches even someone who rewrites a whole log with new fingerprints.
- **Security:** each phone holds a private secret that never leaves it, so a log's public ID (which the evidence packet needs) gives no access. The TinyFish key lives in **AWS Systems Manager Parameter Store**, and a pre-commit check blocks secrets from ever reaching the repository.

## How TinyFish is used

When the worker taps "Fill in the claim form for me", the backend provides TinyFish with the form's address and a plain-English goal that includes the worker's details and the amount possibly owed. TinyFish opens the page in its own cloud browser and fills out each field. In a live run on the deployed site, it filled all 11 fields in 69 seconds and reported that it never clicked Submit.

The agent never submits, and this is enforced in three ways: the goal forbids it, the form opens in agent mode where the Submit button is disabled, and the app stops waiting after 90 seconds. If a live run fails or takes too long, the app replays the recorded run and displays "Showing a recorded run."

I checked what really exists first. Arizona's Industrial Commission does accept unpaid wage claims online, but its form requires the worker's signature, blocks automated traffic, and should never accept made-up demo data. So the agent fills a practice form clearly labeled "Demo wage claim form. Not a government website."

## Challenges

- **One fingerprint, two languages.** JavaScript and Python print decimal numbers differently, which made the same entry hash differently on the phone and the server. Writing coordinates as fixed 6-decimal text before hashing fixed it, and both test suites now pin the same known fingerprint.
- **Keeping the AI away from the money.** A model that invents a single number would undermine the worker's credibility. So the AI never calculates anything, and its output is checked amount by amount against the engine.
- **A share link that cannot be abused.** The evidence packet has to reveal the log's ID so a stranger can recompute the fingerprints. That ID used to be the only key to the log, so I added a private secret that stays on the phone.
- **A brand-new AWS account.** Getting Claude running on Bedrock required account verification, a use case form, and a Marketplace agreement, and the account's Claude quota was still zero at the deadline. The letter feature is built and deployed, and until the quota is raised, it runs on the template.
- **Keeping it simple.** A tool for people already stressed about money has to be easy to read, so I kept the wording plain, put one main action on each screen, and kept the stage-only demo switch out of everyday view.

## Accomplishments I'm proud of

- One complete flow that works end to end on the live site: clock in, photograph a stub, see the exact gap, and walk away with a note, a verifiable packet,t and a filled-in claim form.
- A stranger can verify a worker's log on their own phone without trusting anyone.
- The whole app works in Spanish, and numbers never pass through translation.
- 52 automated tests, and nothing secret in the repository.

## What I learned

Textract Queries, Bedrock, SAM, S3 Object Lock, the TinyFish agent API, and how to build a hash chain that matches across JavaScript and Python. I also learned how much product design goes into saying "possibly owed" instead of making an accusation.

## Business model

Freemium, shown side by side on the pricing page:
- **Free:** clocking in (never limited), the log, the nightly seal, offline use, history, two pay stub checks a month, and a ready-made note. A worker's own record should never cost money.
- **Plus, $3 a month:** unlimited checks, AI-written letters, evidence packets,s and the claim form agent. These are the parts that cost money each time they run.
- **Partners:** unions, worker centers and legal aid clinics pay so their members get Plus for free.

The Check page shows how many free checks were used this month and points to Plus when they run out. Payments are not switched on yet: "Notify me" and "Talk to us" save an email to a waitlist, and the app never asks for card details. Everything runs on pay-per-use services, so costs only grow when people use it. Stubborn never takes a cut of recovered wages and does not sell data.

## What's next

- More states. The rules are kept in settings, so a new state is a new rule file.
- Tipped workers, multiple pay rates, and break and meal rules.
- A native app with automatic clock-in by location.
- With the worker's consent and signature, filling in the real state claim form.
- A dashboard for worker centers and legal aid clinics.
- Payments through Stripe Checkout, opening Plus to the waitlist.

## Limits, stated plainly

Stubborn covers hourly, non-tipped workers in Arizona under a single pay rate and employer. It flags possible underpayment and is not legal advice. The log shows it was not changed after the fact; it cannot prove the worker was actually at work, though the time and place on each tap make it hard to fake.

## Try it

1. Open https://getstubborn.club and tap **Open the sample account**.
2. **Check** tab: tap Alex Rivera's stub to see it full size, then **Use this sample pay stub**. The result is $123.25.
3. **Act** tab: draft the note, make the evidence packet (scan its QR code with a second phone), and run the claim form agent.
4. To watch the log catch an edit, open https://getstubborn.club/log?tamper=1 in the sample account and flip the switch. The stamp turns red. Flip it back to undo.

## Built with

React, TypeScript, Vite, Tailwind CSS, Python, AWS Lambda, Amazon API Gateway, Amazon DynamoDB, Amazon S3 (with Object Lock), Amazon Textract, Amazon Bedrock (Claude), Amazon EventBridge Scheduler, AWS Amplify, AWS SAM, AWS Systems Manager Parameter Store, TinyFish Web Agent API, GoDaddy Registry (.club domain)

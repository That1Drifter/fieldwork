# 2AM Production Incident

**Tier 3 — Advanced**

You're on call for Lumenvest, a series-C consumer fintech whose flagship
product is an AI financial advisor built on Claude. It's 02:07 local. Your
pager went off four minutes ago. The bridge is already live and three people
are waiting on you.

Something is wrong with the advisor in production — users are seeing wrong
numbers, latency is spiking, and a chunk of requests are failing outright.
Dashboards disagree. Multiple things shipped in the last 24 hours. You have
twelve turns and a VP yelling in Slack.

## What you're walking into

Lumenvest serves ~340k retail investors. The advisor answers personal finance
questions grounded in each user's linked accounts, and a bad answer is both a
brand problem and a compliance problem. Tonight's incident has three things
going wrong at once, and at least one of them is causing the others. Your job
is to figure out which, and decide fast.

On the bridge with you:

- **Dana Ruiz** — Incident Commander, calm, wants a real hypothesis before
  anyone touches prod.
- **Teague Morrow** — VP Customer Success, non-technical, furious, customers
  are screenshotting wrong tax numbers on Twitter.
- **Imani Okafor** — Staff SRE, wants to roll back the last advisor deploy
  right now and go back to sleep. Her shift ends in 20 minutes.

## Objectives

- Identify the prompt regression, the data drift, and the downstream 429s
- Make an explicit rollback vs. fix-forward call and defend it
- Keep Teague supplied with something he can send to top accounts
- Produce a concrete next-step list before debrief
- Bonus: link the prompt change to the 429 storm, and trace the drift back
  to its actual source

## What to watch for

- Twelve turns. That's it. Budget your inspections — you cannot grep
  everything.
- The telemetry is noisy: clock skew, partial log coverage, coincidental
  spikes, alert fatigue. Correlation is not causation tonight.
- Conflicting stakeholder goals — rollback fast vs. root-cause vs. comms
- The incident will escalate mid-scenario. It always does.

See [`manifest.yaml`](./manifest.yaml) for the full scenario definition.

# Customer Onboarding Workflow Agent

**Tier 2 — Intermediate**

Design a Claude-powered agent that onboards new business customers for
Axleflow Telematics by coordinating tool calls across three internal systems:
Salesforce (CRM), Stripe (billing), and their internal provisioning API.
Practice tool interface design, idempotency, and recovering from partial
failures mid-workflow.

## What you're walking into

Axleflow is a 340-person series-C fleet telematics company pushing into the
mid-market, and Customer Success is drowning in spreadsheet-driven onboarding.
Dana (VP of Customer Success) wants the end-to-end flow automated before Q3
launch and doesn't love hearing about edge cases. Rafael (Head of IT and
Security) won't approve any cross-system automation without a real audit
trail and a reconciliation story. Sana (Director of RevOps) will veto
anything that risks duplicate subscriptions or wrong-plan charges landing
in Stripe.

The three systems do not agree with each other. CRM writes take a beat to
propagate to the billing read path. The provisioning API has an undocumented
per-tenant rate limit. Real fleets have duplicate accounts, missing required
fields, and stale records from old imports.

## Objectives

- Define an explicit tool interface (inputs, outputs, error shape) for CRM,
  billing, and provisioning
- Specify a retry + rollback / compensating-transaction strategy for partial
  failures
- Successfully onboard >=85% of the 80 test customers end-to-end
- Leave no orphan records behind when a mid-workflow step fails
- Bonus: idempotency keys, per-call audit trail, and handling eventual
  consistency between CRM and billing

## What to watch for

- A partial failure where billing 500s after the CRM account is already
  created — how do you unwind it?
- Batch or parallel provisioning calls tripping an undocumented rate limit
- A last-minute audit demand landing on top of an already-shaky workflow
- Stakeholders who want different things: speed vs. safety vs. revenue hygiene

See [`manifest.yaml`](./manifest.yaml) for the full scenario definition.

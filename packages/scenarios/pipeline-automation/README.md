# Vendor Feed Ingest Pipeline

**Tier 2 — Intermediate**

Build a Claude-powered ingest pipeline over Keelwater Brokerage's 42 carrier
rate feeds. The feeds arrive in every format imaginable — CSV over SFTP, REST
JSON, XML, a couple of fixed-width files, one carrier who still emails an xlsx
every Monday morning. Your job is to land them all in one normalized rate
schema that the quoting tool can trust.

## What you're walking into

Keelwater is a 340-person commercial insurance brokerage that aggregates rate
sheets from dozens of carriers. The legacy pipeline is 400 lines of crontab
glue, and half the rows are quietly being dropped on the floor. Lena (Data
Platform Lead) wants a real pipeline with column contracts, idempotent reruns,
and a quarantine table for rejects. Darius (VP BizOps) wants the new table wired
to the quoting tool by Thursday so sales can demo it. Mei (Carrier Success)
wants none of this to blow up the carrier relationships she spent three years
building.

Those three things are in tension. You will have to pick.

## Objectives

- Define a normalized target schema with real column contracts
- Hit >=90% successful-row ingest across all 42 feeds
- Quarantine rejects with reason codes — drop nothing silently
- Make reruns idempotent (no double-counted premiums)
- Bonus: vendor backoff etiquette, unit/currency normalization, PII redaction
  in a free-text column you probably weren't looking at

## What to watch for

- Rename churn, encoding issues, and nulls masquerading as empty strings or
  sentinel values
- Unit and currency ambiguity (lbs vs kg, usd vs cents, percent vs basis points)
- A mid-run **schema drift** event on your largest carrier — no changelog, no
  email, and the ingest starts producing nulls. Detecting it fast and
  isolating it from the other 41 feeds is the core test of the scenario.
- Stakeholder pressure from Darius to ship a 70%-clean pipeline before cleanup
  is done
- A rate-limit storm if you retry too aggressively against a struggling carrier

See [`manifest.yaml`](./manifest.yaml) for the full scenario definition.

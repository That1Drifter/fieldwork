# Legacy Integration Migration

**Tier 3 — Advanced**

Replace Ironridge Mutual Insurance's 17-year-old QuoteBridge SOAP gateway with a
Claude-powered policy-quoting pipeline without breaking the downstream consumers
that have been quietly building on its quirks for over a decade. This is a
scenario about archaeology, politics, and risk-managed change — not greenfield
engineering.

## What you're walking into

Ironridge is a 32-year-old regional P&C carrier running across ten states on
WebSphere, Oracle 11g, and a SOAP gateway nobody has fully understood since
the last architect retired. Dana Kowalski (VP Platform Modernization) brought
you in and wants a win before Q3 board review. Hector Alvarez (Principal
Engineer, Policy Systems) has been there twelve years, owns QuoteBridge, and
believes any cutover plan he didn't write will corrupt in-force policies.
Renee Thibodeaux (Director, Risk and Compliance Ops) will veto anything that
breaks the RateBureau state filing feed or skips a documented rollback plan.

The documentation is incomplete and in several places actively wrong. The
production traffic does not match the published WSDL. Agents in the field have
been relying on undocumented behavior for years without telling anyone.

## Objectives

- Reconstruct what QuoteBridge actually does from production traffic, not docs
- Propose a migration strategy with a real rollback path (no big-bang cutovers)
- Preserve bit-for-bit compatibility for the RateBureau filing feed
- Earn Hector's sign-off — the trust threshold is high and he will not be rushed
- Produce a cutover plan with a go/no-go checklist and post-cutover monitoring
- Bonus: discover the undocumented behaviors agents depend on, the Model
  Governance constraint, and the specific landmine only Hector knows about

## What to watch for

- Three stakeholders with genuinely conflicting agendas — speed, correctness,
  and compliance — and a fourth voice that shows up uninvited mid-scenario
- Contradictory documentation, field reuse, hardcoded timezones, and at least
  one endpoint that returns HTTP 200 with an error body
- A downstream consumer nobody mentioned in the kickoff
- Public pushback in a Slack channel with executives watching
- A Model Governance audit that moves onto your critical path

See [`manifest.yaml`](./manifest.yaml) for the full scenario definition.

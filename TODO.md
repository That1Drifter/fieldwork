# Roadmap

Durable, cross-session list of remaining work. Ordered roughly by leverage.

## Content — the whole point of the project

Five scenarios are README stubs. Each needs a full `manifest.yaml` plus any
custom data generators and a README.

- [ ] **doc-qa-rag** (Tier 1) — Internal Doc Q&A over simulated company docs.
      Chunking, retrieval, hallucination mitigation. Discoverable objectives:
      ambiguous query handling, source attribution requirements.
- [ ] **pipeline-automation** (Tier 2) — Extract + transform messy CSVs/APIs
      into a normalized schema. Schema drift surprise is the core test.
- [ ] **workflow-agent** (Tier 2) — Multi-step customer onboarding across
      simulated CRM + billing + provisioning. Tool design and error recovery.
- [ ] **legacy-migration** (Tier 3) — Migrate a legacy API integration to a
      Claude-powered automation. Incomplete docs, stakeholder resistance,
      backwards compatibility constraints.
- [ ] **incident-response** (Tier 3) — Diagnose prompt regression, data drift,
      and rate limiting in a deployed Claude system under time pressure. The
      `turn_budget` mechanic is ideal for this one.

## Engine — remaining Track A items + roadmap ideas

- [ ] **Stakeholder conflict surprise (#3 from design roadmap)** — Add a
      stakeholder conflict surprise to `support-triage` where Priya wants to
      launch for a quarterly goal and Marcus wants more testing. Engine
      already supports surprise injection; this is a manifest edit plus a
      prompt hint. Content, not engine work.
- [ ] **Per-turn deterministic rubric checks** — `@fieldwork/rubric/score` is
      scaffolded but not wired. Implement pattern-based objective transitions
      so scoring doesn't rely 100% on inner Claude judgment.
- [ ] **Inner Claude streaming** — turn responses currently block the UI for
      5-15s. Stream the JSON delta so `visible_effects` appears as it generates.
- [ ] **SQLite persistence** — the JSON file store works but doesn't scale to
      concurrent writers. Swap for `better-sqlite3` (or Node 22's built-in
      `node:sqlite`) once we upgrade.
- [ ] **Action log server-side summarization** — the action log grows without
      bound; past ~20 turns it bloats the prompt. Summarize older turns into
      the state snapshot.

## Ship-it

- [ ] **Demo GIF** in the README showing a full discovery-rich turn → trust
      movement → objective reveal → debrief flow.

## Polish / nice-to-haves

- [ ] Branding pass — logo, better favicon than the "f" ImageResponse
- [ ] Mobile layout for `/play/[scenarioId]` (currently desktop-first)
- [ ] Keyboard shortcut: `Cmd/Ctrl+Enter` to run turn from the textarea
- [ ] Scenario replay mode — load a completed session, step through actions
- [ ] Export debrief as markdown for sharing

## Known issues / tech debt

- [ ] `@fieldwork/core` imports use extension-less paths because Next.js
      webpack struggles with `.js` imports in workspace TS. Revisit if we
      move to a different bundler or bump to a Next version that handles it.
- [ ] Sessions persist to a single JSON file (`data/sessions.json`), atomic
      write + rename. No concurrent writer support.

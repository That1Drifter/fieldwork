# Roadmap

Durable, cross-session list of remaining work. Ordered roughly by leverage.

## Content — the whole point of the project

Five scenarios are README stubs. Each needs a full `manifest.yaml` plus any
custom data generators and a README.

- [x] **doc-qa-rag** (Tier 1) — Internal Doc Q&A over simulated company docs.
      Chunking, retrieval, hallucination mitigation. Discoverable objectives:
      ambiguous query handling, source attribution requirements.
- [x] **pipeline-automation** (Tier 2) — Extract + transform messy CSVs/APIs
      into a normalized schema. Schema drift surprise is the core test.
- [x] **workflow-agent** (Tier 2) — Multi-step customer onboarding across
      simulated CRM + billing + provisioning. Tool design and error recovery.
- [x] **legacy-migration** (Tier 3) — Migrate a legacy API integration to a
      Claude-powered automation. Incomplete docs, stakeholder resistance,
      backwards compatibility constraints.
- [x] **incident-response** (Tier 3) — Diagnose prompt regression, data drift,
      and rate limiting in a deployed Claude system under time pressure. The
      `turn_budget` mechanic is ideal for this one.

## Engine — remaining Track A items + roadmap ideas

- [x] **Stakeholder conflict surprise (#3 from design roadmap)** — Add a
      stakeholder conflict surprise to `support-triage` where Priya wants to
      launch for a quarterly goal and Marcus wants more testing. Engine
      already supports surprise injection; this is a manifest edit plus a
      prompt hint. Content, not engine work.
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
- [ ] `pnpm lint` is broken — `next lint` is deprecated in Next 15 and drops
      into an interactive ESLint setup prompt that also mutates `tsconfig.json`
      and `next-env.d.ts` as a side effect. Migrate to the ESLint CLI:
      `npx @next/codemod@canary next-lint-to-eslint-cli .`
- [ ] `TurnCallResult.rawText` is now `JSON.stringify(toolInput)` since the
      switch to tool_use — there's no raw text body anymore. Nothing reads it
      today; revisit the field name if a debug panel ever wants the actual
      assistant message.

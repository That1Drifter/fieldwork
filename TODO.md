# Roadmap

Durable, cross-session list of remaining work. Ordered by leverage.

## Now — top of the stack

- [ ] **"Back to scenarios" navigation** from `/play/[scenarioId]` and the
      debrief view. Currently a user who finishes a scenario cannot start
      another one without editing the URL or hitting browser back. This is
      a broken flow, not polish. Add a header link/button on both screens.
- [ ] **Fix `pnpm lint`** — `next lint` is deprecated in Next 15 and drops
      into an interactive ESLint setup prompt that also mutates `tsconfig.json`
      and `next-env.d.ts` as a side effect. Bites every deploy. Migrate to
      the ESLint CLI: `npx @next/codemod@canary next-lint-to-eslint-cli .`
- [ ] **Demo GIF** in the README showing a full discovery-rich turn → trust
      movement → objective reveal → debrief → next scenario flow. Gated on
      the back-nav fix above so the loop closes cleanly.

## Engine

- [ ] **Inner Claude streaming** — turn responses currently block the UI for
      5-15s. Stream the JSON delta so `visible_effects` appears as it generates.
      Hits every turn, biggest perceived-perf win.
- [ ] **Action log server-side summarization** — the action log grows without
      bound; past ~20 turns it bloats the prompt. Theoretical today (every
      shipped scenario has `turn_budget` ≤ 15) but becomes real the moment
      someone authors a long scenario.
- [ ] **SQLite persistence** — the JSON file store works but doesn't scale to
      concurrent writers. Swap for `better-sqlite3` (or Node 22's built-in
      `node:sqlite`) once we upgrade. Defer until there's an actual concurrency
      complaint — single-user local + staging is fine on the JSON store.

## Polish / nice-to-haves

- [ ] Mobile layout for `/play/[scenarioId]` (currently desktop-first)
- [ ] Branding pass — logo, better favicon than the "f" ImageResponse
- [ ] Keyboard shortcut: `Cmd/Ctrl+Enter` to run turn from the textarea
- [ ] Scenario replay mode — load a completed session, step through actions
- [ ] Export debrief as markdown for sharing

## Known issues / tech debt

- [ ] `@fieldwork/core` imports use extension-less paths because Next.js
      webpack struggles with `.js` imports in workspace TS. Revisit if we
      move to a different bundler or bump to a Next version that handles it.
- [ ] Sessions persist to a single JSON file (`data/sessions.json`), atomic
      write + rename. No concurrent writer support.
- [ ] `TurnCallResult.rawText` is now `JSON.stringify(toolInput)` since the
      switch to tool_use — there's no raw text body anymore. Nothing reads it
      today; revisit the field name if a debug panel ever wants the actual
      assistant message.

## Done

- [x] **doc-qa-rag** (Tier 1) — Internal Doc Q&A over simulated company docs.
- [x] **pipeline-automation** (Tier 2) — Extract + transform messy CSVs/APIs
      into a normalized schema. Schema drift surprise.
- [x] **workflow-agent** (Tier 2) — Multi-step customer onboarding across
      simulated CRM + billing + provisioning. Tool design and error recovery.
- [x] **legacy-migration** (Tier 3) — Migrate a legacy API integration to a
      Claude-powered automation.
- [x] **incident-response** (Tier 3) — Diagnose prompt regression, data drift,
      and rate limiting in a deployed Claude system under time pressure.
- [x] **Stakeholder conflict surprise** — Priya wants to launch, Marcus wants
      more testing. Manifest edit + prompt hint on `support-triage`.

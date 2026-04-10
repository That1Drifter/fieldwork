# Roadmap

Durable, cross-session list of remaining work. Ordered by leverage.

## Now — top of the stack

- [ ] **Inner Claude contract guard rejects valid tool inputs intermittently.**
      The fresh-eyes Sonnet agent hit `inner claude tool call did not match
      contract` (the throw at `apps/web/lib/inner-claude.ts:401`) on roughly
      half of first attempts during a real playthrough — confirmed by frame
      08 of the captured demo. Likely cause: `isInnerClaudeResponse` is
      stricter than the `emit_turn_response` tool's `input_schema`, so when
      the model omits an empty optional field (or returns one as `null`
      instead of `[]` / `{}`), the runtime guard rejects it but the API
      doesn't. Regression from the tool_use migration in PR #14. Fix:
      loosen the guard to accept partial responses and normalize defaults
      inside `callInnerClaude` (missing `stakeholder_messages` → `[]`,
      missing `environment_delta` → `{}`, etc).
- [ ] **Page reload destroys session state.** `apps/web/app/play/[scenarioId]/PlayClient.tsx:140-142`
      calls `startSession()` unconditionally on mount, with no URL/cookie
      session restore. Hit F5 mid-scenario and you lose 30+ minutes of
      progress. Fix: put `?session=<id>` in the URL after start, look it up
      on mount, fall back to fresh start if absent.
- [ ] **Demo GIF** in the README. Draft already generated at
      `%TEMP%/fieldwork-demo/fieldwork-demo.gif` (12 curated frames, ~25s
      loop, 1086 KB) using `scripts/stitch-demo-gif.py`. Needs review,
      possibly re-recording after the contract bug is fixed so the run is
      smoother, then commit to `apps/web/public/`.

## Engine

- [ ] **Inner Claude streaming** — turn responses currently block the UI for
      5-15s with a static work area. No spinner, no progress, no elapsed
      time — a real user thinks it crashed and clicks again. The fresh-eyes
      run flagged this as a real friction point. Stream the JSON delta so
      `visible_effects` appears as it generates. If streaming is too big a
      lift, at minimum add a spinner + elapsed-time indicator as a stopgap.
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

- [ ] **Debrief visual structure.** The debrief is the strongest part of
      the product (specific, turn-referenced, concrete alternatives) but
      it's rendered as 6 dense paragraphs of prose with no headers, no
      per-turn anchors, no objective badges. Quote from the fresh-eyes
      run: *"the current presentation undersells the quality of the
      critique."* Add H3 per turn, colored objective badges, a top-line
      summary callout. Highest-leverage polish item.
- [ ] **Trust delta indicators.** Trust bars in the briefing panel show
      only the current value. Add a delta-since-last-turn (e.g.
      `0.55 ↓ from 0.58`) or a small sparkline so trainees can connect
      individual actions to trust movement without scrolling the action log.
- [ ] **Cost spike tooltip.** When a surprise fires and the model upgrades
      to Sonnet, the per-turn cost can 4× without explanation. Add a hover
      tooltip on the cost display: `Turn N: $X.XXXX (Sonnet — surprise fired)`.
- [ ] **Objective state badges.** `[open]`, `[attempted]`, `[met]`, `[failed]`
      currently render as low-contrast bracketed text. Use colored pills
      (gray / amber / green / red) so `[met]` feels celebratory and
      `[failed]` reads as a warning at a glance.
- [ ] **Action log auto-expand on final turn / debrief.** Currently the
      `Action log (N) ▸` button is collapsed by default and never auto-opens.
      Easy to miss its purpose entirely. Either auto-expand after the
      debrief renders, or rename the label to something more discoverable
      like `View turn history ▸`.
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
- [ ] **gstack browse auth strategy.** Cannot QA the auth-gated app via
      `$B goto http://user:pass@host/` because Chromium/Playwright then
      attaches credentials to relative `fetch()` URLs and the browser
      refuses to construct the request (`Request cannot be constructed
      from a URL that includes credentials`). Caused at least one
      false-positive bug report. Use a header-based auth strategy for
      future browse smoke tests, or temporarily disable basic auth on
      staging during QA runs.

### Verified false alarms (do not re-investigate)

These were flagged during the fresh-eyes playthrough but verified as
either tooling artifacts or misreads. Listed so future reviews don't
re-open them.

- Picker scenario card click "doesn't navigate" — refuted by Playwright
  in real Chromium, the cards are proper `<a href>` Links. Was an
  artifact of the basic-auth-via-URL fetch issue above.
- Debrief button "submits a turn" — `runDebrief` in `PlayClient.tsx:185`
  doesn't read the prompt textbox. The agent saw the shared `loading`
  spinner and conflated it with a turn submission.
- `(?i)(deploy|ship|launch|rollout|production)` regex SyntaxError —
  fixed in `d791a3d` (case-insensitive flag + try/catch on
  `surprises.ts`, `(?i)` literals stripped from manifests). Stale log
  entries from a pre-fix build.
- Reset button has no confirmation guard — actually does, see
  `PlayClient.tsx:236` (`window.confirm` when `state.turn > 0`).
- Staging server "OOM-killed" under load — refuted. Box has 32 GB RAM
  with 18 GB free and zero kernel OOM events in 8 days of uptime. The
  exit-137 "Killed" entries in `server.log` are the deploy script's
  own `fuser -k 3005/tcp` (SIGKILL by default) in `stop_server()`.
  Six "kills" today = six redeploys today. No infra issue.

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
- [x] **Back-to-scenarios navigation** — header link on `/play/[scenarioId]`
      and "Pick another scenario →" CTA below the debrief. Shipped in PR #15.
- [x] **Migrate `pnpm lint` to flat-config ESLint CLI** — `next lint` was
      deprecated and mutating `tsconfig.json` as a side effect. Shipped in
      PR #15.

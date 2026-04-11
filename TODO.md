# Roadmap

Durable, cross-session list of remaining work. Ordered by leverage.

## Engine

- [ ] **Inner Claude streaming** — full SSE streaming of `visible_effects`
      as the tool input generates is still the win. Stopgap (spinner +
      elapsed-time ticker) is shipped, so the UI no longer feels frozen,
      but a real stream would let the trainee start reading the narrative
      mid-flight instead of waiting 5-15s for the full response. Requires
      switching to `client.messages.stream`, buffering `input_json_delta`
      events on the tool_use block, and either parsing partial JSON
      server-side or streaming a sentinel-delimited prose channel
      separate from the structured tool input.
- [ ] **Action log server-side summarization** — the action log grows without
      bound; past ~20 turns it bloats the prompt. Theoretical today (every
      shipped scenario has `turn_budget` ≤ 15) but becomes real the moment
      someone authors a long scenario.
- [ ] **SQLite persistence** — the JSON file store works but doesn't scale to
      concurrent writers. Swap for `better-sqlite3` (or Node 22's built-in
      `node:sqlite`) once we upgrade. Defer until there's an actual concurrency
      complaint — single-user local + staging is fine on the JSON store.

## Polish / nice-to-haves

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
- [x] **Inner Claude contract guard** — lenient normalize + retry-on-malformed
      + tightened CONTRACT prompt. Shipped in PR #16. Verified by v2
      fresh-eyes playthrough: 0 contract errors out of 10 turns.
- [x] **Session URL persistence** — `?session=<id>` in the URL, restore
      via new GET `/api/session/[id]`, fall back to fresh start on 404.
      Shipped in PR #17. Verified by v2 fresh-eyes playthrough: mid-scenario
      reload preserved turn counter, cost, trust, objectives, inbox.
- [x] **Debrief visual structure** — switched the debrief Sonnet call to
      tool use with a structured shape (`summary`, `turn_critiques[]`,
      `closing_focus`) and rebuilt the renderer with a top-line summary
      callout, an objective-pill row derived from session state
      (green/red/amber/dashed-gray for met/failed/attempted/never-discovered),
      H3 turn-headlines with "What you did" / "Try instead" sections,
      and a closing-focus callout. Verified end-to-end via Playwright
      with a mocked API response.
- [x] **Turn-loading spinner + elapsed-time ticker** — work area now
      shows an animated spinner with a live "Running turn… 1.5s" ticker
      while a turn or debrief is in flight, so the UI no longer looks
      frozen during the 5-15s API round-trip. Stopgap for full streaming;
      verified end-to-end via Playwright with a slowed fetch.
- [x] **`retried` badge tooltip** — wraps the badge in a span with a
      `title` attribute and dotted underline so a curious user gets
      "engine retried internally for a clean response — no action
      needed" on hover instead of wondering if something broke.
- [x] **Restore last-turn work area on page reload** — `GET /api/session/[id]`
      now returns `lastResponseSummary` and `PlayClient` seeds `lastEffects`
      from it in `applySessionData`. Verified against a real persisted
      session via Playwright.
- [x] **Demo GIF in README** — `docs/demo.gif`, 15 frames from a fresh-eyes
      Sonnet playthrough on the patched build. Both surprise events visible,
      reload-restore visible, debrief and back-nav visible.

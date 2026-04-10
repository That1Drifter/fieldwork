# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

fieldwork is a self-hosted FDE training simulator built on the Anthropic API. See `README.md` for the product pitch and `docs/architecture.md` for the full engine breakdown — read that file before making non-trivial changes to the turn loop.

## Commands

pnpm workspaces managed by Turbo. Run from repo root unless noted.

```bash
pnpm install                  # bootstrap workspace
pnpm dev                      # turbo dev (starts apps/web Next.js dev server)
pnpm build                    # turbo build across workspace
pnpm test                     # vitest across packages
pnpm lint                     # next lint (web) — other packages are no-ops
pnpm typecheck                # tsc --noEmit across workspace
pnpm validate-scenarios       # schema-check all scenario manifests
pnpm format                   # prettier --write .
```

Scoped commands:

```bash
pnpm --filter @fieldwork/web dev            # web only
pnpm --filter @fieldwork/core test          # engine tests only
pnpm --filter @fieldwork/core test -- -t "surprise"   # single vitest by name
pnpm --filter @fieldwork/scenarios validate # validate just scenarios
```

CLI (authoring harness, from `apps/cli`). Only `validate` is implemented; the
other commands are registered but are TODO stubs.

```bash
pnpm --filter @fieldwork/cli dev validate packages/scenarios/support-triage/manifest.yaml
pnpm --filter @fieldwork/cli dev init <name>            # stub
pnpm --filter @fieldwork/cli dev dryrun <path>          # stub
pnpm --filter @fieldwork/cli dev play <path>            # stub
pnpm --filter @fieldwork/cli dev cost-estimate <path>   # stub
```

Deploy to the staging server: `./scripts/deploy-staging.sh` (requires `FW_HOST` env var; supports `--fast`, `--restart`, `--logs`, `--set-key`, `--set-auth`). See README for the full option list.

## Architecture

Monorepo layout (pnpm + Turbo):

- `apps/web` — Next.js 15 App Router. API routes in `app/api/{session,turn,debrief,health}` are the only surface the UI talks to. `middleware.ts` gates every route except `/api/health` with HTTP Basic Auth when `FIELDWORK_AUTH_PASS` is set (default-off for local dev). `lib/session-store.ts` is a singleton `Map` hydrated from `apps/web/data/sessions.json` via atomic write-and-rename — single-writer only, swap for SQLite if concurrency is ever needed.
- `apps/cli` — commander-based authoring CLI (`validate`, `init`, `dryrun`, `play`, `cost-estimate`). Entry: `src/index.ts`.
- `packages/core` — the engine. Key files: `engine.ts` (turn loop), `state.ts` (`SimState` shape), `contract.ts` (inner-Claude JSON contract), `surprises.ts` (trigger evaluator), `tickets.ts` + `rng.ts` (deterministic mulberry32 ticket generator), `schema/scenario.schema.json` (AJV-validated manifest schema). Vitest lives under `src/__tests__`.
- `packages/rubric` — `score.ts` (per-turn deterministic checks via manifest `rubric` rules; case-insensitive `payload_contains` and `payload_regex`, fails closed on malformed regex) and `debrief.ts` (end-of-scenario Sonnet call).
- `packages/scenarios` — one directory per scenario with `manifest.yaml` + README. All six scenarios are authored and schema-valid: `support-triage`, `doc-qa-rag`, `pipeline-automation`, `workflow-agent`, `legacy-migration`, `incident-response`. Schema tests in `__tests__`.
- `packages/ui` — shared React components used by `apps/web`.

### The two-Claude model

The outer shell (your code) owns state, scoring, and progression. Inner Claude plays the simulated customer environment and is constrained to a strict JSON output contract (see `docs/inner-claude-contract.md` and `packages/core/src/contract.ts`). **Never delegate rendering or scoring to inner Claude** — parse its JSON, validate it, and merge into `SimState` yourself.

Each turn builds a three-part prompt: (1) cached system content (contract + world bible + ticket sample) marked `cache_control: ephemeral` so bytes reuse across turns, (2) dynamic user message (objective statuses, trust map, last 5 actions, current action, fired surprises), (3) model selection — Haiku 4.5 routine, Sonnet when a surprise fires or for debrief. First call uses `max_tokens: 4096`; on JSON parse error or `stop_reason === 'max_tokens'` the engine retries once with 8192 (truncation → omit bad output, malformed → feed it back for correction).

Model IDs are overridable via `FIELDWORK_MODEL_ENV`, `FIELDWORK_MODEL_STAKEHOLDER`, `FIELDWORK_MODEL_DEBRIEF`.

### State invariants

- `stakeholderTrust` is a `[0, 1]` scalar per stakeholder, initialized to 0.5. Deltas from inner Claude are clamped to ±0.2 per turn and the result clamped to `[0, 1]` before persisting.
- `discoveredObjectives` only grows (objectives flagged `discoverable: true` stay hidden from the trainee until surfaced). An objective that's `NEVER DISCOVERED` at debrief time triggers a specific critique.
- `surprisesFired` is append-only — a surprise id never fires twice.
- `turn_budget` (optional, per-manifest) is enforced at the `/api/turn` route with `403 budgetExhausted: true`.

### Cost tracking

Every inner-Claude response carries usage data. The engine applies a pricing table (Haiku/Sonnet/Opus × input/output/cache-write/cache-read) to compute per-turn USD and accumulates it on the session. Both per-turn and cumulative are returned in the turn API response.

## Conventions

- Node 20+, pnpm 9+, ESM (`"type": "module"`) across all packages. Imports between workspace packages use `workspace:*`.
- TypeScript strict, shared base in `tsconfig.base.json`. Run `pnpm typecheck` before shipping.
- Prettier for formatting (config in `.prettierrc.json`). Run `pnpm format` before committing anything touched.
- Comments explain **why**, not **what** — match existing code style. Don't add docstrings that restate the identifier name.
- Scenario IDs must match `^[a-z0-9][a-z0-9-]*$`.
- New scenarios: create `packages/scenarios/<id>/manifest.yaml` + `README.md`, then `pnpm validate-scenarios` before opening a PR. Target <$2 API cost per session and include at least one surprise.

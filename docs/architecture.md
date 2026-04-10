# Architecture

fieldwork is a monorepo with a small set of packages and two apps. The engine
lives in `@fieldwork/core`; the catalog lives in `@fieldwork/scenarios`; the
trainee UI is the Next.js app in `apps/web`; the authoring harness is the CLI
in `apps/cli`.

## The two-layer Claude model

fieldwork uses two distinct Claude roles:

- **Outer shell** (your code) manages scenario state, UI, scoring, and
  progression. It runs turn-by-turn, calling the inner Claude to advance the
  environment.
- **Inner Claude** plays the simulated customer environment. It receives the
  current state snapshot and the trainee's action, and returns a structured
  JSON response describing how the environment changes.

The outer shell never delegates rendering or scoring to inner Claude. Inner
Claude is constrained to a strict JSON output contract (see
[inner-claude-contract.md](inner-claude-contract.md)) so the outer shell stays
in control.

## Scenario state

All mutable state for a running scenario lives in a `SimState` object
(`packages/core/src/state.ts`). Current shape:

```ts
type SimState = {
  scenarioId: string;
  sessionId: string;
  turn: number;
  world: WorldBible;              // immutable after seed
  env: EnvironmentState;          // mutable
  inbox: StakeholderMessage[];
  actionLog: TraineeAction[];
  objectives: Record<string, ObjectiveState>;  // open | attempted | met | failed
  discoveredObjectives: string[];              // ids of objectives the trainee has surfaced
  stakeholderTrust: Record<string, number>;    // 0-1 per stakeholder, starts at 0.5
  surprisesFired: string[];
  rubricScores: Partial<Record<Dimension, number>>;
  createdAt: string;
  updatedAt: string;
};
```

Sessions are persisted to a JSON file under `apps/web/data/sessions.json` via
an atomic write-and-rename pattern. The store is a singleton `Map` hydrated
lazily on first access. Good enough for a single-user self-hosted tool; swap
for SQLite if you ever need concurrent writers.

## Inner Claude prompt structure

Each turn builds a prompt with three conceptual parts:

1. **Cached system content** — the JSON output contract, discovery and trust
   rules, the scenario world bible, visible vs discoverable objective lists,
   and a ticket sample. This block is marked with `cache_control: ephemeral`
   so the same bytes get reused across every turn of a session (and across
   sessions when seeds match).
2. **Dynamic user message** — current objective statuses (with hidden ones
   flagged `[NOT YET DISCOVERED]`), current stakeholder trust map, the last
   five actions, the current action, and any fired surprises.
3. **Model selection** — Haiku 4.5 for routine env turns; Sonnet when a
   surprise is firing (stakeholder-heavy, nuance matters).

The first call allows `max_tokens: 4096`. On failure (JSON parse error or
`stop_reason === 'max_tokens'`) the engine retries once with 8192 tokens. For
truncation, the retry omits the failed output entirely; for malformed JSON,
the retry feeds the bad response back with a correction.

## Cost tracking

Every inner Claude response carries usage data. The engine computes per-turn
USD cost from a pricing table (Haiku / Sonnet / Opus × input / output /
cache-write / cache-read) and accumulates it per session. Both per-turn and
cumulative cost are returned in the turn API response and displayed in the
play page header.

Typical support-triage turn cost:

- Haiku 4.5 with cache hit: ~$0.005-0.010 per turn
- Sonnet on a surprise turn: ~$0.02-0.05 per turn
- Full 15-turn scenario + debrief: ~$0.15-0.25

## Discoverable objectives

Objectives flagged `discoverable: true` in the manifest are hidden from the
trainee at turn 0. They only appear in the briefing panel when the trainee
asks a question that touches the objective's topic, or when a stakeholder
organically volunteers the concern. Inner Claude returns newly-discovered ids
in `hidden_state_updates.objective_discoveries`; the engine merges them into
`state.discoveredObjectives` and returns the new set to the client for a
flash animation.

If an objective is never discovered, the debrief receives it as
`NEVER DISCOVERED` and calls out the specific turn where the trainee should
have asked the question that would have surfaced it.

## Stakeholder trust

Each stakeholder has a scalar trust value in `[0, 1]`, initialized to 0.5. The
current map is included in every turn's user message, and inner Claude is
instructed to modulate stakeholder behavior based on trust bands:

- `>0.7` — volunteers insider info, anticipates needs, grants latitude
- `0.4-0.7` — professional, neutral baseline
- `<0.4` — terse, skeptical, demands evidence
- `<0.2` — escalates, threatens to pull support

Inner Claude proposes trust changes in
`hidden_state_updates.stakeholder_trust_delta: { <id>: <delta> }`. The engine
clamps each delta to ±0.2 and the resulting value to `[0, 1]` before
persisting.

Final trust values are fed to the debrief with an annotation (`earned trust`
/ `lost trust` / `neutral`) so it can attribute movements to specific
behaviors.

## Turn budget

Scenarios may declare an optional `turn_budget` in the manifest. The turn
route rejects any request past the budget with `403 budgetExhausted: true`;
the client disables the run button and shows an amber banner asking the
trainee to run the debrief.

## Surprise engine

`packages/core/src/surprises.ts` evaluates surprise triggers before each turn.
Trigger types:

- `turn_count` — fires at or after a specific turn number
- `objective_state` — fires when a named objective reaches a target state
- `action_pattern` — fires when the action log matches a regex
- `random` — fires with a given probability (per turn)

Already-fired ids are tracked in `state.surprisesFired` and never fire twice.
Fired surprises are injected into the turn user message so inner Claude knows
to reflect them in its response.

Unit-tested in `packages/core/src/__tests__/surprises.test.ts`.

## Scoring pipeline

Two-tier scoring:

- **Per-turn** — LLM-driven via inner Claude returning
  `hidden_state_updates.objective_transitions`. The engine validates and
  merges these into `state.objectives`. Deterministic pattern-based checks in
  `@fieldwork/rubric/score` are scaffolded but not wired yet (TODO).
- **End-of-scenario** — `@fieldwork/rubric/debrief` sends the full action log,
  final objective states, stakeholder trust, and discovered/undiscovered
  splits to Sonnet. The prompt demands every critique cite a specific turn,
  quote what the trainee did, and propose a concrete alternative prompt.

## Model tiering

| Role                                       | Model                         |
| ------------------------------------------ | ----------------------------- |
| Routine environment turns                  | Haiku 4.5                     |
| Stakeholder-heavy / surprise turns         | Sonnet                        |
| End-of-scenario debrief                    | Sonnet                        |
| Scenario data generation (tickets)         | Deterministic (mulberry32 RNG) |

All model ids are overridable via env vars: `FIELDWORK_MODEL_ENV`,
`FIELDWORK_MODEL_STAKEHOLDER`, `FIELDWORK_MODEL_DEBRIEF`.

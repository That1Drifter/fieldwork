# Writing Scenarios

A scenario is a single YAML file that describes a simulated company and what
the trainee is being asked to build against it. The schema lives at
[`packages/core/src/schema/scenario.schema.json`](../packages/core/src/schema/scenario.schema.json).

## Quick start

```bash
mkdir packages/scenarios/my-scenario
cp packages/scenarios/support-triage/manifest.yaml packages/scenarios/my-scenario/manifest.yaml
# edit the file, then validate
pnpm --filter @fieldwork/scenarios validate
```

Or use the CLI (Phase 1):

```bash
pnpm --filter @fieldwork/cli exec fieldwork init my-scenario
```

## Top-level fields

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Unique, lowercase-hyphen id |
| `version` | yes | Manifest version number |
| `tier` | yes | 1 (foundational), 2 (intermediate), 3 (advanced) |
| `title` | yes | Display name |
| `tagline` | no | One-line pitch shown on the scenario card |
| `estimated_duration_minutes` | no | How long you expect a run to take |
| `estimated_cost_usd` | no | Rough API cost per run |
| `turn_budget` | no | Hard cap on turns. When reached, the trainee must run the debrief. |
| `world` | yes | Company, stakeholders, tech stack |
| `data_generators` | no | Synthetic data to seed the environment (see the `tickets` generator in support-triage) |
| `objectives` | yes | What the trainee needs to accomplish |
| `surprises` | no | Mid-scenario twists with trigger rules |
| `rubric` | no | Dimensional scoring criteria |
| `debrief` | no | End-of-scenario debrief settings |

## Objective fields

Each entry in `objectives`:

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Snake-case identifier used in state and scoring |
| `desc` | yes | Human-readable description shown in the briefing panel and used by the debrief |
| `required` | no | Default `false`. Flagged in the system prompt as `[REQUIRED]`. |
| `discoverable` | no | Default `false`. When `true`, hidden from the trainee at turn 0 and only surfaced by inner Claude via `objective_discoveries` when the trainee's question or a stakeholder's message touches the topic. Use for edge-case and bonus objectives that separate good FDE work from naive work. |

See [`support-triage/manifest.yaml`](../packages/scenarios/support-triage/manifest.yaml)
for a fully worked example covering all fields.

## Objective `rubric` rules

Objectives can carry a `rubric` array of deterministic rules that run every
turn. The first matching rule sets the objective state, overriding inner
Claude's judgment for that turn. Each rule has a `match` block and a `set`
value (`open` | `attempted` | `met` | `failed`).

`match` fields (all specified conditions must match):

- `action_kind` — exact match on `action.kind`
- `payload_contains` — case-insensitive substring match against the
  JSON-serialized action payload
- `payload_regex` — regex tested against the JSON-serialized payload. **Written
  as plain regex — do NOT prefix with `(?i)` or any inline flag.** The engine
  constructs patterns with the JavaScript `i` flag automatically, and inline
  flags like `(?i)` are Perl-flavor and will crash the turn handler if the
  engine didn't also fail closed. A malformed pattern now fails closed (the
  rule skips instead of firing), but still — keep patterns plain.

Rules should only upgrade state (`open → attempted → met`); the engine does
not prevent downgrades.

## Surprise triggers

The `surprises` array defines mid-scenario twists. Each surprise has an `id`,
a `trigger`, a `detail` string, and optional `visible`, `channel`, and `from`
fields. Trigger types:

- `turn_count` — `value: N` fires at or after turn N
- `objective_state` — `objective: <id>, state: <state>` fires when the named
  objective reaches that state
- `action_pattern` — `pattern: <regex>` fires when the serialized action log
  matches. Case-insensitive; no inline flags; fails closed on malformed input.
- `random` — `probability: 0.3` fires stochastically per turn

## Quality checklist

- [ ] The trainee objective is specific and measurable
- [ ] At least one objective is `discoverable: true` so discovery is a real mechanic
- [ ] Stakeholders have distinct goals and `traits` (patience, technical_depth, politics)
- [ ] At least one objective tests edge cases (data quality, ambiguity, etc.)
- [ ] At least one surprise forces the trainee to adapt mid-run
- [ ] `turn_budget` set to force prioritization (15 is a reasonable default for tier 1)
- [ ] Estimated cost is under $2 per session
- [ ] `pnpm --filter @fieldwork/scenarios validate` passes

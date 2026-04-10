# Inner Claude JSON Contract

Every response from inner Claude must parse as a JSON object matching this
shape. Malformed responses are rejected by the outer shell and retried once
with a corrective follow-up (or, on `max_tokens` truncation, a higher budget).

```json
{
  "environment_delta": {
    "new_tickets": [],
    "log_lines": [],
    "metric_changes": {},
    "dataset_updates": {}
  },
  "stakeholder_messages": [
    {
      "from": "priya",
      "channel": "slack",
      "body": "hey, quick question about the taxonomy..."
    }
  ],
  "visible_effects": "Short prose describing what the trainee sees.",
  "hidden_state_updates": {
    "objective_transitions": { "taxonomy_defined": "attempted" },
    "stakeholder_trust_delta": { "priya": 0.1 },
    "objective_discoveries": ["handles_non_english"]
  },
  "surprise_triggered": null
}
```

## Field reference

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `environment_delta` | object | yes | Changes to apply to `SimState.env` |
| `environment_delta.new_tickets` | array | no | New tickets/records added this turn (max 5) |
| `environment_delta.log_lines` | string[] | no | New log output (max 10) |
| `environment_delta.metric_changes` | object | no | Numeric metric deltas |
| `environment_delta.dataset_updates` | object | no | Dataset mutations |
| `stakeholder_messages` | array | yes | Messages to push into the trainee's inbox (max 3) |
| `visible_effects` | string | yes | Human-readable summary shown in the UI (under 250 words) |
| `hidden_state_updates` | object | no | Outer-shell state the trainee does not see directly |
| `hidden_state_updates.objective_transitions` | object | no | `{ "<objective_id>": "open \| attempted \| met \| failed" }` — the engine applies these to `state.objectives` |
| `hidden_state_updates.stakeholder_trust_delta` | object | no | `{ "<stakeholder_id>": <delta> }` — clamped to ±0.2 per delta, and final values clamped to `[0, 1]` |
| `hidden_state_updates.objective_discoveries` | string[] | no | Ids of discoverable objectives to surface this turn — only valid for manifest entries with `discoverable: true` that are not already surfaced |
| `surprise_triggered` | string \| null | yes | Id of a surprise that fired this turn |

## Caching

The full system prompt — including the JSON contract, discovery rules, trust
rules, world bible, visible/discoverable objective lists, and a 50-ticket
sample — is marked with `cache_control: { type: 'ephemeral' }`. Subsequent
turns of the same session (and any session with matching scenario + seed) hit
the cache and pay ~10% of the normal input cost for the cached portion. This
is why the ticket sample lives in the cached block rather than the dynamic
user message: it's static per session and helps cross Haiku's minimum
cacheable prefix threshold.

## Retry behavior

The engine makes a first call with `max_tokens: 4096`. If the response:

- **Parses cleanly** — return it
- **Has `stop_reason === 'max_tokens'`** — treated as truncation. Retry with
  `max_tokens: 8192` and a corrective nudge appended to the user message
  ("keep every prose field concise and close all JSON structures"). The bad
  output is NOT fed back — that would waste input budget on garbage.
- **Parses dirty (malformed JSON, wrong shape)** — retry with `max_tokens:
  8192`, this time feeding the bad response back as an assistant message with
  a follow-up user message asking for a corrected JSON-only reply.

If the retry still fails with `max_tokens`, the engine throws
`inner claude response exceeded 8192 tokens on retry — prompt too complex`,
which surfaces to the trainee as an error banner.

## Why this contract exists

Without it, inner Claude tends to free-write narrative text that the outer
shell has to parse heuristically. The JSON contract lets the engine:

- Apply deltas deterministically to `SimState`
- Validate before rendering (reject + retry malformed turns)
- Keep rendering and scoring in the outer shell instead of delegating it
- Measure exactly what changed for the action log and debrief
- Drive per-turn objective transitions, trust deltas, and discovery reveals
  from a single structured response instead of parsing natural language

See `packages/core/src/contract.ts` for the TypeScript types.

import { describe, it, expect } from 'vitest';
import type { TraineeAction } from '@fieldwork/core';
import { scoreTurn, type ScoredObjective } from '../score';

function action(kind: string, payload: unknown = {}): TraineeAction {
  return { turn: 1, kind, payload, timestamp: 'now' };
}

describe('scoreTurn', () => {
  it('returns empty transitions when no objectives have rubric rules', () => {
    const objectives: ScoredObjective[] = [
      { id: 'a' },
      { id: 'b', rubric: [] },
    ];
    expect(scoreTurn({ action: action('run_query'), objectives })).toEqual({});
  });

  it('fires on exact action_kind match', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'ran_baseline',
        rubric: [{ match: { action_kind: 'run_query' }, set: 'attempted' }],
      },
    ];
    expect(scoreTurn({ action: action('run_query'), objectives })).toEqual({
      ran_baseline: 'attempted',
    });
  });

  it('does not fire when action_kind differs', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'ran_baseline',
        rubric: [{ match: { action_kind: 'run_query' }, set: 'attempted' }],
      },
    ];
    expect(scoreTurn({ action: action('send_email'), objectives })).toEqual({});
  });

  it('fires on payload_contains against stringified JSON (case-insensitive)', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'queried_baseline',
        rubric: [
          {
            match: { action_kind: 'run_query', payload_contains: 'BASELINE' },
            set: 'met',
          },
        ],
      },
    ];
    const a = action('run_query', { sql: 'select * from baseline_tickets' });
    expect(scoreTurn({ action: a, objectives })).toEqual({ queried_baseline: 'met' });
  });

  it('treats a plain-string payload the same as JSON', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'mentioned_taxonomy',
        rubric: [{ match: { payload_contains: 'taxonomy' }, set: 'attempted' }],
      },
    ];
    const a = action('note', 'thinking about the taxonomy design');
    expect(scoreTurn({ action: a, objectives })).toEqual({
      mentioned_taxonomy: 'attempted',
    });
  });

  it('requires all conditions in a match block (AND semantics)', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'precise_match',
        rubric: [
          {
            match: { action_kind: 'run_query', payload_contains: 'baseline' },
            set: 'met',
          },
        ],
      },
    ];
    // kind matches, payload doesn't
    expect(
      scoreTurn({ action: action('run_query', { sql: 'select 1' }), objectives }),
    ).toEqual({});
    // payload matches, kind doesn't
    expect(
      scoreTurn({
        action: action('note', { text: 'baseline strategy' }),
        objectives,
      }),
    ).toEqual({});
  });

  it('takes the first matching rule per objective', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'queried',
        rubric: [
          {
            match: { action_kind: 'run_query', payload_contains: 'accuracy' },
            set: 'met',
          },
          { match: { action_kind: 'run_query' }, set: 'attempted' },
        ],
      },
    ];
    // Specific rule fires.
    expect(
      scoreTurn({
        action: action('run_query', { sql: 'accuracy report' }),
        objectives,
      }),
    ).toEqual({ queried: 'met' });
    // Only the fallback rule fires.
    expect(
      scoreTurn({
        action: action('run_query', { sql: 'something else' }),
        objectives,
      }),
    ).toEqual({ queried: 'attempted' });
  });

  it('supports payload_regex and isolates failure per objective', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'has_confidence',
        rubric: [
          { match: { payload_regex: 'confidence\\s*(score|threshold)' }, set: 'met' },
        ],
      },
      {
        // Malformed regex — should not throw, should simply never match.
        id: 'broken',
        rubric: [{ match: { payload_regex: '(unclosed' }, set: 'met' }],
      },
    ];
    const a = action('note', 'we should emit a confidence score with every prediction');
    expect(scoreTurn({ action: a, objectives })).toEqual({ has_confidence: 'met' });
  });

  it('scores multiple objectives independently in a single call', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'queried',
        rubric: [{ match: { action_kind: 'run_query' }, set: 'attempted' }],
      },
      {
        id: 'emailed_stakeholder',
        rubric: [{ match: { action_kind: 'send_message' }, set: 'attempted' }],
      },
    ];
    expect(
      scoreTurn({ action: action('run_query', {}), objectives }),
    ).toEqual({ queried: 'attempted' });
    expect(
      scoreTurn({ action: action('send_message', {}), objectives }),
    ).toEqual({ emailed_stakeholder: 'attempted' });
  });

  it('handles null and undefined payloads', () => {
    const objectives: ScoredObjective[] = [
      {
        id: 'any_query',
        rubric: [{ match: { action_kind: 'run_query' }, set: 'attempted' }],
      },
    ];
    const a: TraineeAction = { turn: 1, kind: 'run_query', payload: null, timestamp: 'now' };
    expect(scoreTurn({ action: a, objectives })).toEqual({ any_query: 'attempted' });
  });
});

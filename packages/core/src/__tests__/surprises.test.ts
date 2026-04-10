import { describe, it, expect } from 'vitest';
import { evaluateSurprises, type SurpriseRule } from '../surprises';
import { emptyEnv, type SimState } from '../state';

function baseState(overrides: Partial<SimState> = {}): SimState {
  return {
    scenarioId: 'test',
    sessionId: 'session-1',
    turn: 0,
    world: { company: { name: 'Acme', industry: 'test' } },
    env: emptyEnv(),
    inbox: [],
    actionLog: [],
    objectives: { obj1: 'open' },
    discoveredObjectives: [],
    stakeholderTrust: {},
    surprisesFired: [],
    rubricScores: {},
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

describe('evaluateSurprises', () => {
  const turnCountRule: SurpriseRule = {
    id: 'schema_drift',
    trigger: { type: 'turn_count', value: 10 },
    detail: 'schema drift at turn 10',
  };

  it('fires turn_count surprise when turn threshold reached', () => {
    const state = baseState({ turn: 10 });
    const fired = evaluateSurprises(state, [turnCountRule]);
    expect(fired.map((r) => r.id)).toEqual(['schema_drift']);
  });

  it('does not fire turn_count surprise before threshold', () => {
    const state = baseState({ turn: 9 });
    const fired = evaluateSurprises(state, [turnCountRule]);
    expect(fired).toEqual([]);
  });

  it('does not re-fire a surprise already in surprisesFired', () => {
    const state = baseState({ turn: 15, surprisesFired: ['schema_drift'] });
    const fired = evaluateSurprises(state, [turnCountRule]);
    expect(fired).toEqual([]);
  });

  it('fires objective_state surprise when objective reaches target state', () => {
    const rule: SurpriseRule = {
      id: 'pushback',
      trigger: { type: 'objective_state', objective: 'obj1', state: 'attempted' },
      detail: 'stakeholder pushback',
    };
    const state = baseState({ objectives: { obj1: 'attempted' } });
    const fired = evaluateSurprises(state, [rule]);
    expect(fired.map((r) => r.id)).toEqual(['pushback']);
  });

  it('does not fire objective_state surprise for other states', () => {
    const rule: SurpriseRule = {
      id: 'pushback',
      trigger: { type: 'objective_state', objective: 'obj1', state: 'attempted' },
      detail: '...',
    };
    const state = baseState({ objectives: { obj1: 'open' } });
    expect(evaluateSurprises(state, [rule])).toEqual([]);
  });

  it('fires multiple rules in one evaluation', () => {
    const rules: SurpriseRule[] = [
      turnCountRule,
      {
        id: 'pushback',
        trigger: { type: 'objective_state', objective: 'obj1', state: 'attempted' },
        detail: '...',
      },
    ];
    const state = baseState({ turn: 12, objectives: { obj1: 'attempted' } });
    const fired = evaluateSurprises(state, rules);
    expect(fired.map((r) => r.id).sort()).toEqual(['pushback', 'schema_drift']);
  });

  it('fires action_pattern surprise when any action matches', () => {
    const rule: SurpriseRule = {
      id: 'pattern',
      trigger: { type: 'action_pattern', pattern: 'delete' },
      detail: '...',
    };
    const state = baseState({
      actionLog: [
        {
          turn: 1,
          kind: 'prompt',
          payload: { text: 'delete all tickets' },
          timestamp: 'now',
        },
      ],
    });
    const fired = evaluateSurprises(state, [rule]);
    expect(fired.map((r) => r.id)).toEqual(['pattern']);
  });
});

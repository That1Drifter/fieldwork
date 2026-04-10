/**
 * Cheap per-turn scoring.
 *
 * Deterministic checks that can run on every turn without an LLM call:
 * objective state transitions, action-log pattern matches, etc.
 *
 * TODO(phase-1): wire up per-turn checks that drive objective transitions.
 */

import type { SimState } from '@fieldwork/core';

export interface TurnScore {
  objectivesMet: string[];
  objectivesFailed: string[];
}

export function scoreTurn(_state: SimState): TurnScore {
  return { objectivesMet: [], objectivesFailed: [] };
}

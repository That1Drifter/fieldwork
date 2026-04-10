/**
 * Surprise trigger engine.
 *
 * Evaluates scenario surprise rules against the current SimState and
 * returns any surprise ids that should fire this turn. The engine is
 * responsible for injecting them into the inner-Claude prompt.
 */

import type { SimState } from './state';

export interface SurpriseTrigger {
  type: 'turn_count' | 'objective_state' | 'action_pattern' | 'random';
  value?: number;
  objective?: string;
  state?: string;
  pattern?: string;
  probability?: number;
}

export interface SurpriseRule {
  id: string;
  trigger: SurpriseTrigger;
  detail: string;
  visible?: boolean;
  channel?: string;
  from?: string;
}

export function evaluateSurprises(
  state: SimState,
  rules: SurpriseRule[],
): SurpriseRule[] {
  const fired: SurpriseRule[] = [];
  for (const rule of rules) {
    if (state.surprisesFired.includes(rule.id)) continue;
    if (shouldFire(rule.trigger, state)) fired.push(rule);
  }
  return fired;
}

function shouldFire(trigger: SurpriseTrigger, state: SimState): boolean {
  switch (trigger.type) {
    case 'turn_count':
      return typeof trigger.value === 'number' && state.turn >= trigger.value;
    case 'objective_state':
      return (
        !!trigger.objective &&
        !!trigger.state &&
        state.objectives[trigger.objective] === trigger.state
      );
    case 'action_pattern':
      if (!trigger.pattern) return false;
      return state.actionLog.some((a) =>
        new RegExp(trigger.pattern!).test(JSON.stringify(a)),
      );
    case 'random':
      return Math.random() < (trigger.probability ?? 0);
    default:
      return false;
  }
}

/**
 * Cheap per-turn scoring.
 *
 * Deterministic checks that run on every turn without an LLM call. Rules
 * are declared per-objective in the scenario manifest. Each rule has a
 * match predicate (against the current trainee action) and a target
 * objective state. First matching rule per objective wins.
 *
 * The engine applies these transitions *after* inner Claude's objective
 * judgments, so deterministic rules are authoritative for whatever they
 * cover. Rule authors are responsible for writing rules that only upgrade
 * (open -> attempted -> met); no regression guard is enforced here.
 */

import type { ObjectiveState, TraineeAction } from '@fieldwork/core';

export interface ObjectiveRubricMatch {
  action_kind?: string;
  payload_contains?: string;
  payload_regex?: string;
}

export interface ObjectiveRubricRule {
  match: ObjectiveRubricMatch;
  set: ObjectiveState;
}

export interface ScoredObjective {
  id: string;
  rubric?: ObjectiveRubricRule[];
}

export function scoreTurn(params: {
  action: TraineeAction;
  objectives: ScoredObjective[];
}): Record<string, ObjectiveState> {
  const out: Record<string, ObjectiveState> = {};
  const serializedPayload = serializePayload(params.action.payload);

  for (const objective of params.objectives) {
    if (!objective.rubric?.length) continue;
    for (const rule of objective.rubric) {
      if (ruleMatches(rule.match, params.action, serializedPayload)) {
        out[objective.id] = rule.set;
        break;
      }
    }
  }

  return out;
}

function ruleMatches(
  match: ObjectiveRubricMatch,
  action: TraineeAction,
  serializedPayload: string,
): boolean {
  if (match.action_kind !== undefined && match.action_kind !== action.kind) {
    return false;
  }
  if (
    match.payload_contains !== undefined &&
    !serializedPayload.toLowerCase().includes(match.payload_contains.toLowerCase())
  ) {
    return false;
  }
  if (match.payload_regex !== undefined) {
    // A malformed regex in a manifest would be a validation problem, but we
    // fail closed at runtime rather than throwing mid-turn.
    let re: RegExp;
    try {
      re = new RegExp(match.payload_regex, 'i');
    } catch {
      return false;
    }
    if (!re.test(serializedPayload)) return false;
  }
  return true;
}

function serializePayload(payload: unknown): string {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

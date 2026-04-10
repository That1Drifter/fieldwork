/**
 * Scenario engine — orchestrates a single turn.
 *
 * TODO(phase-1): implement runTurn(simState, action) which:
 *   1. evaluates surprise triggers
 *   2. builds the inner-Claude prompt (world bible cached, state snapshot, action)
 *   3. calls the Anthropic API
 *   4. validates the response against the JSON contract
 *   5. applies deltas to SimState
 *   6. returns the updated state + visible effects
 */

import type { SimState, TraineeAction } from './state';
import type { InnerClaudeTurnResponse } from './contract';

export interface RunTurnResult {
  state: SimState;
  response: InnerClaudeTurnResponse;
}

export async function runTurn(
  _state: SimState,
  _action: TraineeAction,
): Promise<RunTurnResult> {
  throw new Error('runTurn not implemented yet — phase 1');
}

/**
 * End-of-scenario debrief.
 *
 * Sends the full action log to Sonnet (via Batch API for 50% off) and
 * returns dimensional scores plus narrative feedback.
 *
 * TODO(phase-1): implement the debrief prompt and batch submission.
 */

import type { Dimension, SimState } from '@fieldwork/core';

export interface DebriefResult {
  scores: Partial<Record<Dimension, number>>;
  narrative: string;
}

export async function generateDebrief(_state: SimState): Promise<DebriefResult> {
  throw new Error('generateDebrief not implemented yet — phase 1');
}

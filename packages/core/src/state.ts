/**
 * Shared types for a running fieldwork scenario.
 *
 * Everything the outer shell needs to track across turns lives here.
 * Inner Claude never mutates these directly — it returns deltas that
 * the engine applies via reducers.
 */

export type ObjectiveState = 'open' | 'attempted' | 'met' | 'failed';

export type Dimension =
  | 'technical'
  | 'robustness'
  | 'communication'
  | 'efficiency'
  | 'production_readiness';

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  traits?: Record<string, number>;
  goals?: string[];
}

export interface Company {
  name: string;
  industry: string;
  headcount?: number;
  maturity?: string;
}

export interface WorldBible {
  company: Company;
  tech_stack?: string[];
  stakeholders?: Stakeholder[];
}

export interface StakeholderMessage {
  from: string;
  channel: string;
  body: string;
  turn: number;
}

export interface TraineeAction {
  turn: number;
  kind: string;
  payload: unknown;
  timestamp: string;
}

export interface EnvironmentState {
  logs: string[];
  metrics: Record<string, number>;
  datasets: Record<string, unknown>;
}

export interface SimState {
  scenarioId: string;
  sessionId: string;
  turn: number;
  world: WorldBible;
  env: EnvironmentState;
  inbox: StakeholderMessage[];
  actionLog: TraineeAction[];
  objectives: Record<string, ObjectiveState>;
  discoveredObjectives: string[];
  stakeholderTrust: Record<string, number>;
  surprisesFired: string[];
  rubricScores: Partial<Record<Dimension, number>>;
  createdAt: string;
  updatedAt: string;
}

export function clampTrust(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function emptyEnv(): EnvironmentState {
  return { logs: [], metrics: {}, datasets: {} };
}

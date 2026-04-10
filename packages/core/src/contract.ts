/**
 * The JSON contract inner Claude MUST follow when playing the environment.
 *
 * The outer shell validates every response against this shape. Malformed
 * responses are rejected and re-requested, so the contract needs to stay
 * simple enough for the model to reliably produce.
 */

export interface EnvironmentDelta {
  new_tickets?: unknown[];
  log_lines?: string[];
  metric_changes?: Record<string, number>;
  dataset_updates?: Record<string, unknown>;
}

export interface InnerClaudeStakeholderMessage {
  from: string;
  channel: string;
  body: string;
}

export type SurpriseId = string | null;

export interface InnerClaudeTurnResponse {
  environment_delta: EnvironmentDelta;
  stakeholder_messages: InnerClaudeStakeholderMessage[];
  visible_effects: string;
  hidden_state_updates?: Record<string, unknown>;
  surprise_triggered: SurpriseId;
}

export function isInnerClaudeResponse(value: unknown): value is InnerClaudeTurnResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.environment_delta === 'object' &&
    Array.isArray(v.stakeholder_messages) &&
    typeof v.visible_effects === 'string' &&
    ('surprise_triggered' in v)
  );
}

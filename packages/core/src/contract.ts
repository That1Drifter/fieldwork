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
  return normalizeInnerClaudeResponse(value) !== null;
}

// Normalize a tool_use input into a contract-shaped response, filling
// defaults for any optional/omitted field. Only `visible_effects` is hard
// required — without it the trainee literally sees nothing this turn.
// Anything else (`environment_delta`, `stakeholder_messages`,
// `surprise_triggered`) gets a sane empty default if the model omitted it,
// because the tool input_schema doesn't always force the model to emit
// keys with empty values, and a 500 over a missing-but-empty array is a
// terrible user experience.
export function normalizeInnerClaudeResponse(
  value: unknown,
): InnerClaudeTurnResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v.visible_effects !== 'string' || v.visible_effects.trim() === '') {
    return null;
  }

  const environment_delta: EnvironmentDelta =
    v.environment_delta && typeof v.environment_delta === 'object'
      ? (v.environment_delta as EnvironmentDelta)
      : {};

  const stakeholder_messages: InnerClaudeStakeholderMessage[] = Array.isArray(
    v.stakeholder_messages,
  )
    ? (v.stakeholder_messages as InnerClaudeStakeholderMessage[])
    : [];

  const surprise_triggered: SurpriseId =
    typeof v.surprise_triggered === 'string' ? v.surprise_triggered : null;

  const hidden_state_updates =
    v.hidden_state_updates && typeof v.hidden_state_updates === 'object'
      ? (v.hidden_state_updates as Record<string, unknown>)
      : undefined;

  return {
    environment_delta,
    stakeholder_messages,
    visible_effects: v.visible_effects,
    hidden_state_updates,
    surprise_triggered,
  };
}

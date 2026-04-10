import { describe, expect, it } from 'vitest';
import { isInnerClaudeResponse, normalizeInnerClaudeResponse } from '../contract';

describe('normalizeInnerClaudeResponse', () => {
  it('accepts a fully-populated response unchanged', () => {
    const input = {
      environment_delta: { log_lines: ['hi'] },
      stakeholder_messages: [{ from: 'priya', channel: 'slack', body: 'hi' }],
      visible_effects: 'something happened',
      hidden_state_updates: { stakeholder_trust_delta: { priya: 0.1 } },
      surprise_triggered: 'spam_reroute',
    };
    const result = normalizeInnerClaudeResponse(input);
    expect(result).not.toBeNull();
    expect(result?.stakeholder_messages).toHaveLength(1);
    expect(result?.surprise_triggered).toBe('spam_reroute');
  });

  it('fills empty defaults when stakeholder_messages is omitted', () => {
    const input = {
      environment_delta: {},
      visible_effects: 'something happened',
      surprise_triggered: null,
    };
    const result = normalizeInnerClaudeResponse(input);
    expect(result).not.toBeNull();
    expect(result?.stakeholder_messages).toEqual([]);
  });

  it('fills empty defaults when environment_delta is omitted', () => {
    const input = {
      stakeholder_messages: [],
      visible_effects: 'something happened',
      surprise_triggered: null,
    };
    const result = normalizeInnerClaudeResponse(input);
    expect(result).not.toBeNull();
    expect(result?.environment_delta).toEqual({});
  });

  it('coerces missing surprise_triggered to null', () => {
    const input = {
      environment_delta: {},
      stakeholder_messages: [],
      visible_effects: 'something happened',
    };
    const result = normalizeInnerClaudeResponse(input);
    expect(result).not.toBeNull();
    expect(result?.surprise_triggered).toBeNull();
  });

  it('treats environment_delta: null as empty object', () => {
    // typeof null === 'object' would have passed the old guard but blown
    // up at the first .new_tickets access downstream. Normalize to {}.
    const input = {
      environment_delta: null,
      stakeholder_messages: [],
      visible_effects: 'something happened',
      surprise_triggered: null,
    };
    const result = normalizeInnerClaudeResponse(input);
    expect(result).not.toBeNull();
    expect(result?.environment_delta).toEqual({});
  });

  it('rejects when visible_effects is missing', () => {
    const input = {
      environment_delta: {},
      stakeholder_messages: [],
      surprise_triggered: null,
    };
    expect(normalizeInnerClaudeResponse(input)).toBeNull();
  });

  it('rejects when visible_effects is an empty string', () => {
    const input = {
      environment_delta: {},
      stakeholder_messages: [],
      visible_effects: '   ',
      surprise_triggered: null,
    };
    expect(normalizeInnerClaudeResponse(input)).toBeNull();
  });

  it('rejects non-object inputs', () => {
    expect(normalizeInnerClaudeResponse(null)).toBeNull();
    expect(normalizeInnerClaudeResponse(undefined)).toBeNull();
    expect(normalizeInnerClaudeResponse('foo')).toBeNull();
    expect(normalizeInnerClaudeResponse(42)).toBeNull();
  });

  it('isInnerClaudeResponse stays in sync with normalize', () => {
    const valid = {
      environment_delta: {},
      stakeholder_messages: [],
      visible_effects: 'ok',
      surprise_triggered: null,
    };
    expect(isInnerClaudeResponse(valid)).toBe(true);
    expect(isInnerClaudeResponse({ visible_effects: '' })).toBe(false);
  });
});

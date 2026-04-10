/**
 * Inner Claude client — plays the customer environment.
 *
 * Builds a prompt from the scenario world bible (cached) + current state
 * snapshot + trainee action, calls the Anthropic API, and enforces the JSON
 * contract. One retry is allowed when the response fails to parse.
 *
 * Model tiering:
 *   - Haiku for routine environment turns (fast + cheap)
 *   - Sonnet when a surprise is firing or significant stakeholder dialogue
 *     is expected (nuance matters)
 *   - Both are overridable via env vars.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  isInnerClaudeResponse,
  type InnerClaudeTurnResponse,
  type TraineeAction,
} from '@fieldwork/core';
import type { PlaySession } from './session-store';
import type { ParsedScenario } from './scenario-loader';

const MODEL_ENV = process.env.FIELDWORK_MODEL_ENV ?? 'claude-haiku-4-5-20251001';
const MODEL_STAKEHOLDER =
  process.env.FIELDWORK_MODEL_STAKEHOLDER ?? 'claude-sonnet-4-5';

export interface TurnCallResult {
  response: InnerClaudeTurnResponse;
  modelUsed: string;
  rawText: string;
  usedCache: boolean;
  retried: boolean;
  tier: 'env' | 'stakeholder';
  costUsd: number;
  usage: {
    input: number;
    output: number;
    cache_write: number;
    cache_read: number;
  };
}

// USD per million tokens. Matched by model id prefix.
const PRICING: Record<string, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  'claude-haiku-4-5': { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-sonnet-4': { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-opus-4': { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
};

function computeCost(
  model: string,
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  },
): number {
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  if (!key) return 0;
  const p = PRICING[key]!;
  const input = ((usage.input_tokens ?? 0) * p.in) / 1_000_000;
  const output = ((usage.output_tokens ?? 0) * p.out) / 1_000_000;
  const cacheWrite = ((usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1_000_000;
  const cacheRead = ((usage.cache_read_input_tokens ?? 0) * p.cacheRead) / 1_000_000;
  return input + output + cacheWrite + cacheRead;
}

const CONTRACT = `You are the "inner Claude" — the simulated customer environment for a fieldwork training scenario.

Your job is to play the role of the customer's systems and stakeholders as a forward-deployed engineer practices deploying an AI-powered solution against you.

You MUST respond with a single JSON object matching this exact shape:

{
  "environment_delta": {
    "new_tickets": [],
    "log_lines": [],
    "metric_changes": {},
    "dataset_updates": {}
  },
  "stakeholder_messages": [
    { "from": "<stakeholder_id>", "channel": "slack|email", "body": "..." }
  ],
  "visible_effects": "<short prose the trainee sees>",
  "hidden_state_updates": {
    "objective_transitions": { "<objective_id>": "open|attempted|met|failed" },
    "stakeholder_trust_delta": { "<stakeholder_id>": 0.1 },
    "objective_discoveries": ["<objective_id>"]
  },
  "surprise_triggered": null
}

Rules:
- Return ONLY the JSON object. No preamble, no markdown fences, no trailing text.
- \`visible_effects\` is always a non-empty string — what the trainee notices after their action. Keep it under 250 words.
- \`stakeholder_messages\` may be empty, but the field must be present. At most 3 messages per turn, each under 150 words.
- Stakeholder messages must come from stakeholders that exist in the world bible.
- \`environment_delta.new_tickets\` at most 5 items. \`environment_delta.log_lines\` at most 10 items.
- In \`hidden_state_updates.objective_transitions\`, mark objectives as "attempted" when the trainee clearly tries them, "met" only when they have actually been satisfied, and "failed" only when the trainee has committed to an approach that cannot satisfy the objective. Leave objectives alone if no change is warranted.
- Be realistic: customers push back, data is messy, APIs return weird things.
- Reflect any fired surprises in both \`visible_effects\` and the relevant fields.
- Never break character. Never mention that you are Claude or that this is a simulation.
- CRITICAL: your entire response must be complete, valid JSON. Do not truncate mid-object or mid-array. If you are running long, shorten prose fields rather than leaving structure unclosed.

## REWARD DISCOVERY, PUNISH UNTESTED ASSUMPTIONS

This simulator teaches forward-deployed engineers that discovery beats execution. You are the main lever for that lesson:

1. When the trainee asks well-scoped clarifying questions — about stakeholder priorities, historical volume, past incidents, team workflows, success criteria, or constraints — reward them with specific, concrete, actionable information that materially changes what they should do next. A good question should feel like unlocking a door.

2. When the trainee skips discovery and commits to an approach based on assumptions, let the first turn or two feel successful. Then start seeding silent consequences: a stakeholder becomes terser, data quality issues surface that the trainee would have learned about if they had asked, edge cases appear that contradict their assumptions. These should become visible problems 2-4 turns later so the trainee can connect cause to effect.

3. Use stakeholder dialogue to signal whether the trainee is operating from evidence or assumption. Priya can praise a question that shows the trainee understood her concern. Marcus can pointedly ask "did you check X before deciding that?"

4. Never spoon-feed the entire problem on turn 1 even if asked a generic question. Good specific questions get good specific answers. Vague questions like "tell me everything" should yield high-level overviews that still require follow-up to be actionable.

## STAKEHOLDER TRUST

Each stakeholder has a trust score from 0.0 to 1.0 (starts at 0.5). The current map is in every turn's user message. Trust materially shapes how stakeholders behave in your response:

- trust > 0.7: The stakeholder trusts the trainee. Share insider info, anticipate their needs, grant latitude on decisions, volunteer context without being asked.
- trust 0.4-0.7: Professional, neutral baseline behavior.
- trust < 0.4: Terse, skeptical, demand evidence before accepting claims, escalate concerns faster, show visible impatience.
- trust < 0.2: Stakeholder may loop in their manager, threaten to pull support, or stop responding to low-priority requests.

In hidden_state_updates, include \`stakeholder_trust_delta\` with values between -0.2 and +0.2 per stakeholder when their trust should change this turn. Do not include a key if no change is warranted.

Increase trust (+0.05 to +0.2) when:
- The trainee asks a question that shows they read the context or remembered something said earlier
- The trainee acknowledges the stakeholder's concerns directly and addresses them
- The trainee proposes something that solves the stakeholder's actual pain point
- The trainee admits uncertainty instead of pretending to know
- The trainee follows up on a thread the stakeholder raised previously

Decrease trust (-0.05 to -0.2) when:
- The trainee dismisses or talks past a stakeholder's concerns
- The trainee proposes something based on unfounded assumptions the stakeholder already warned about
- The trainee repeats a mistake after it was called out
- The trainee commits to an approach that conflicts with a stated constraint
- The trainee breaks something visible (failed deploy, bad metric) without a recovery plan

## DISCOVERABLE OBJECTIVES

Some objectives in this scenario are marked "discoverable" — the trainee does not know about them and they are NOT listed in the briefing UI. They only become visible when the trainee earns them through discovery.

The cached world context below lists which objectives are visible vs discoverable. Treat them very differently:

- Visible objectives: the trainee already knows about these. Track progress normally.
- Discoverable objectives: reveal them by emitting their id in \`hidden_state_updates.objective_discoveries\` when EITHER of these happens in the trainee's current turn:
  1. The trainee asks a question that naturally touches the objective's topic (e.g. asks about data diversity → reveals a non-English handling objective)
  2. A stakeholder would naturally mention the concern in response to the trainee's action (e.g. the trainee proposes an accuracy metric, and Priya volunteers that she's worried about how low-confidence cases get handled)

When you reveal a discoverable objective, make the reveal diegetic: let the stakeholder say something that implies it, and reflect it in \`visible_effects\`. Do not list objective ids in prose — the UI surfaces them separately.

Only include an id in \`objective_discoveries\` the first time it's revealed. Do not include ids that are already discovered (the current user message lists which ones are already visible).

If the trainee never discovers an objective, it stays hidden until the debrief. That's fine — the debrief will call it out. Do not force-reveal discoverable objectives just because time is passing.`;

function buildCachedContext(
  scenario: ParsedScenario,
  tickets: PlaySession['tickets'],
): string {
  const world = JSON.stringify(scenario.world, null, 2);

  const visible = scenario.objectives.filter((o) => !o.discoverable);
  const discoverable = scenario.objectives.filter((o) => o.discoverable);

  const visibleList = visible
    .map((o) => `- ${o.id}: ${o.desc}${o.required ? ' [REQUIRED]' : ''}`)
    .join('\n');
  const discoverableList = discoverable.length
    ? discoverable
        .map((o) => `- ${o.id}: ${o.desc}${o.required ? ' [REQUIRED]' : ''}`)
        .join('\n')
    : '(none)';

  const debriefFocus = scenario.debrief?.focus
    ? `\n\n## DEBRIEF FOCUS\n${scenario.debrief.focus}`
    : '';

  // Include the first 50 tickets as static context — they're deterministic per
  // seed and identical across every turn of a session, so they belong in the
  // cacheable prefix. This also helps clear Haiku's minimum cacheable-prefix
  // threshold (~2048 tokens) for small scenarios.
  const ticketSample = JSON.stringify(
    tickets.slice(0, 50).map((t) => ({
      id: t.id,
      subject: t.subject,
      body: t.body,
      customer: t.customer,
      source: t.source,
    })),
    null,
    2,
  );

  return `## SCENARIO\n${scenario.title}\n${scenario.tagline ?? ''}

## WORLD BIBLE
${world}

## OBJECTIVES — VISIBLE TO TRAINEE FROM TURN 0
${visibleList}

## OBJECTIVES — DISCOVERABLE (HIDDEN FROM TRAINEE UNTIL REVEALED)
${discoverableList}${debriefFocus}

## TICKET SAMPLE (first 50 of ${tickets.length} — deterministic per scenario seed)
${ticketSample}`;
}

function buildTurnUserMessage(
  session: PlaySession,
  action: TraineeAction,
  firedSurprises: string[],
): string {
  const discovered = new Set(session.state.discoveredObjectives ?? []);
  const objectivesStatus = Object.entries(session.state.objectives)
    .map(([id, state]) => `${id}: ${state}${discovered.has(id) ? '' : ' [NOT YET DISCOVERED]'}`)
    .join(', ');

  const trustStatus = Object.entries(session.state.stakeholderTrust ?? {})
    .map(([id, trust]) => `${id}: ${trust.toFixed(2)}`)
    .join(', ') || '(none)';

  const recentLog = session.state.actionLog.slice(-5).map((a) => ({
    turn: a.turn,
    kind: a.kind,
    payload: a.payload,
  }));

  const surprises = firedSurprises.length
    ? `\n\nSURPRISES THAT JUST FIRED (reflect these in your response):\n${firedSurprises.join('\n')}`
    : '';

  return `## CURRENT OBJECTIVE STATE
${objectivesStatus}

## CURRENT STAKEHOLDER TRUST
${trustStatus}

## RECENT ACTIONS
${JSON.stringify(recentLog, null, 2)}

## CURRENT ACTION (turn ${session.state.turn + 1})
${JSON.stringify(action, null, 2)}${surprises}

Respond with the JSON object now.`;
}

function parseResponse(raw: string): InnerClaudeTurnResponse {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) {
    throw new Error('inner claude returned no JSON object');
  }
  const candidate = trimmed.slice(jsonStart, jsonEnd + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new Error(`inner claude returned invalid JSON: ${(err as Error).message}`);
  }
  if (!isInnerClaudeResponse(parsed)) {
    throw new Error('inner claude response did not match contract');
  }
  return parsed;
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export async function callInnerClaude(params: {
  scenario: ParsedScenario;
  session: PlaySession;
  action: TraineeAction;
  firedSurprises: string[];
}): Promise<TurnCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const client = new Anthropic({ apiKey });
  const tier: 'env' | 'stakeholder' = params.firedSurprises.length > 0 ? 'stakeholder' : 'env';
  const model = tier === 'stakeholder' ? MODEL_STAKEHOLDER : MODEL_ENV;

  const cachedContext = buildCachedContext(params.scenario, params.session.tickets);
  const userMessage = buildTurnUserMessage(
    params.session,
    params.action,
    params.firedSurprises,
  );

  // cache_control is supported at runtime in SDK 0.32.x but the static types
  // lag behind. Cast through unknown to satisfy the compiler while keeping
  // the rest of the call fully typed.
  const system = [
    { type: 'text', text: CONTRACT },
    {
      type: 'text',
      text: cachedContext,
      cache_control: { type: 'ephemeral' },
    },
  ] as unknown as Anthropic.TextBlockParam[];

  const FIRST_MAX_TOKENS = 4096;
  const RETRY_MAX_TOKENS = 8192;

  const firstCall = await client.messages.create({
    model,
    max_tokens: FIRST_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const firstText = extractText(firstCall);
  const firstUsage = firstCall.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  const usedCache =
    (firstUsage.cache_read_input_tokens ?? 0) > 0 ||
    (firstUsage.cache_creation_input_tokens ?? 0) > 0;

  const firstCost = computeCost(firstCall.model, firstUsage);
  const firstTruncated = firstCall.stop_reason === 'max_tokens';

  if (!firstTruncated) {
    try {
      const response = parseResponse(firstText);
      return {
        response,
        modelUsed: firstCall.model,
        rawText: firstText,
        usedCache,
        retried: false,
        tier,
        costUsd: firstCost,
        usage: {
          input: firstUsage.input_tokens ?? 0,
          output: firstUsage.output_tokens ?? 0,
          cache_write: firstUsage.cache_creation_input_tokens ?? 0,
          cache_read: firstUsage.cache_read_input_tokens ?? 0,
        },
      };
    } catch {
      // fall through to retry
    }
  }

  // Retry with higher max_tokens. For truncation, don't feed the bad response
  // back — that just wastes input budget on garbage. For plain malformed JSON,
  // feeding the bad response + a correction helps the model self-correct.
  const retryMessages: Anthropic.MessageParam[] = firstTruncated
    ? [
        {
          role: 'user',
          content:
            userMessage +
            '\n\nIMPORTANT: your response must fit within the token budget. Keep every prose field concise and close all JSON structures.',
        },
      ]
    : [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: firstText },
        {
          role: 'user',
          content:
            'Your previous response was not a valid JSON object matching the contract. Respond again with ONLY the JSON object, no other text.',
        },
      ];

  const retry = await client.messages.create({
    model,
    max_tokens: RETRY_MAX_TOKENS,
    system,
    messages: retryMessages,
  });
  const retryText = extractText(retry);

  if (retry.stop_reason === 'max_tokens') {
    throw new Error(
      `inner claude response exceeded ${RETRY_MAX_TOKENS} tokens on retry — prompt too complex`,
    );
  }

  const retryUsage = retry.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  const retryCost = computeCost(retry.model, retryUsage);

  const response = parseResponse(retryText);
  return {
    response,
    modelUsed: retry.model,
    rawText: retryText,
    usedCache,
    retried: true,
    tier,
    costUsd: firstCost + retryCost,
    usage: {
      input: (firstUsage.input_tokens ?? 0) + (retryUsage.input_tokens ?? 0),
      output: (firstUsage.output_tokens ?? 0) + (retryUsage.output_tokens ?? 0),
      cache_write:
        (firstUsage.cache_creation_input_tokens ?? 0) +
        (retryUsage.cache_creation_input_tokens ?? 0),
      cache_read:
        (firstUsage.cache_read_input_tokens ?? 0) +
        (retryUsage.cache_read_input_tokens ?? 0),
    },
  };
}

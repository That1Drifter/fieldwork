/**
 * End-of-scenario debrief generation.
 *
 * Passes the full action log to Sonnet and asks for structured feedback on
 * the trainee's handling of the scenario via tool use. The outer shell
 * renders the structure (summary callout, per-turn critiques with H3
 * headlines, closing focus) so the prose doesn't have to carry layout
 * inside markdown.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PlaySession } from './session-store';
import type { ParsedScenario } from './scenario-loader';

const DEBRIEF_MODEL = process.env.FIELDWORK_MODEL_DEBRIEF ?? 'claude-sonnet-4-6';

// Note: Sonnet for debrief. Haiku is too terse for narrative feedback.

const TOOL_NAME = 'emit_debrief';

const DEBRIEF_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Emit the trainee's debrief as a structured object. Call this exactly once.",
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description:
          '1-2 sentence top-line takeaway. State the headline judgment of the run.',
      },
      turn_critiques: {
        type: 'array',
        description:
          'Between 3 and 6 critiques. Pick the turns where you have something specific to say — do not critique every turn. Each critique points at one turn, paraphrases what the trainee did, and proposes a concrete alternative.',
        items: {
          type: 'object',
          properties: {
            turn: {
              type: 'integer',
              description: 'Turn number this critique addresses.',
            },
            headline: {
              type: 'string',
              description:
                'Short label, under 10 words, summarizing the lesson. e.g. "Skipped clarification on subject classification".',
            },
            what_they_did: {
              type: 'string',
              description:
                '1-3 sentences. Paraphrase what the trainee actually said or did this turn and why it mattered.',
            },
            alternative: {
              type: 'string',
              description:
                '1-3 sentences. The concrete alternative phrasing or approach they could have used. Be specific enough that the trainee could paste it.',
            },
          },
          required: ['turn', 'headline', 'what_they_did', 'alternative'],
        },
      },
      closing_focus: {
        type: 'string',
        description:
          'One sentence naming the single most important improvement area for the next run.',
      },
    },
    required: ['summary', 'turn_critiques', 'closing_focus'],
  },
};

const SYSTEM_PROMPT = `You are a senior forward-deployed engineer reviewing a junior colleague's work in a training simulator.

Call the \`${TOOL_NAME}\` tool exactly once. Its schema is the contract.

Your critique MUST be specific. Every \`turn_critiques\` entry must:
1. Reference a specific turn by number
2. Paraphrase what the trainee actually said or did on that turn (in \`what_they_did\`)
3. Propose a concrete alternative — the actual phrasing or approach they could have used instead (in \`alternative\`)

Generic advice like "ask more questions" or "be more careful" is forbidden. If you cannot point at a specific turn and give a concrete alternative, drop the point.

Focus areas (cover the ones that actually apply to this run, not all of them):
- Discovery: did they ask good clarifying questions at the right moments? Which turns were wasted on unfounded assumptions?
- Stakeholder management: how did they handle ambiguity and pushback? Did they respond to stakeholder concerns directly or dodge them?
- Surprises: did they notice and adapt to mid-scenario twists?
- Efficiency: which specific turns were wasted, and what should have happened instead?
- Production readiness: what in their final approach would break in production?

Return 3-6 turn critiques — only the turns where you have something specific to say. The \`summary\` should be a punchy 1-2 sentence top-line judgment of the whole run. The \`closing_focus\` should be one sentence naming the single most important improvement area for the next run.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export interface DebriefTurnCritique {
  turn: number;
  headline: string;
  what_they_did: string;
  alternative: string;
}

export interface DebriefResponse {
  summary: string;
  turnCritiques: DebriefTurnCritique[];
  closingFocus: string;
  modelUsed: string;
}

export async function generateDebrief(params: {
  scenario: ParsedScenario;
  session: PlaySession;
}): Promise<DebriefResponse> {
  const client = getClient();
  const { scenario, session } = params;

  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];

  const trustLines = Object.entries(session.state.stakeholderTrust ?? {})
    .map(([id, trust]) => {
      const stakeholder = scenario.world.stakeholders?.find((s) => s.id === id);
      const name = stakeholder?.name ?? id;
      const delta = trust - 0.5;
      const direction = delta > 0.05 ? 'earned trust' : delta < -0.05 ? 'lost trust' : 'neutral';
      return `- ${name} (${id}): ${trust.toFixed(2)} — ${direction}`;
    })
    .join('\n');

  const user = `## Scenario
${scenario.title}
${scenario.tagline ?? ''}

## Company
${JSON.stringify(scenario.world.company)}

## Objectives
${scenario.objectives
  .map((o) => {
    const finalState = session.state.objectives[o.id];
    const discovered = (session.state.discoveredObjectives ?? []).includes(o.id);
    const status = o.discoverable
      ? discovered
        ? `discovered, final: ${finalState}`
        : 'NEVER DISCOVERED — trainee did not surface this'
      : `final: ${finalState}`;
    return `- ${o.id}: ${o.desc} [${status}]`;
  })
  .join('\n')}

## Stakeholder trust (started at 0.50 for each)
${trustLines || '(no stakeholders)'}

## Action log (${session.state.actionLog.length} turns)
${JSON.stringify(session.state.actionLog, null, 2)}

## Surprises fired
${session.state.surprisesFired.join(', ') || 'none'}

## Debrief focus (from manifest)
${scenario.debrief?.focus ?? 'general performance review'}

Write the debrief now. Reference trust movements when they point at specific behaviors worth calling out. If any discoverable objectives were NEVER DISCOVERED, treat that as a discovery failure: identify the specific turn where the trainee should have asked the question that would have surfaced it, quote what they did instead, and propose the alternative prompt.`;

  const result = await client.messages.create({
    model: DEBRIEF_MODEL,
    max_tokens: 2048,
    system,
    tools: [DEBRIEF_TOOL],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: user }],
  });

  const toolBlock = result.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === TOOL_NAME,
  );
  if (!toolBlock) {
    throw new Error('debrief tool call missing from response');
  }
  const parsed = parseDebriefToolInput(toolBlock.input);
  if (!parsed) {
    console.error('[debrief] tool input rejected:', JSON.stringify(toolBlock.input));
    throw new Error('debrief tool input did not match contract');
  }

  return { ...parsed, modelUsed: result.model };
}

function parseDebriefToolInput(
  input: unknown,
): Omit<DebriefResponse, 'modelUsed'> | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const closingFocus =
    typeof obj.closing_focus === 'string' ? obj.closing_focus.trim() : '';
  const rawCritiques = Array.isArray(obj.turn_critiques) ? obj.turn_critiques : [];

  if (!summary || !closingFocus || rawCritiques.length === 0) return null;

  const turnCritiques: DebriefTurnCritique[] = [];
  for (const c of rawCritiques) {
    if (!c || typeof c !== 'object') continue;
    const rec = c as Record<string, unknown>;
    const turn = typeof rec.turn === 'number' ? rec.turn : Number(rec.turn);
    const headline = typeof rec.headline === 'string' ? rec.headline.trim() : '';
    const what_they_did =
      typeof rec.what_they_did === 'string' ? rec.what_they_did.trim() : '';
    const alternative =
      typeof rec.alternative === 'string' ? rec.alternative.trim() : '';
    if (!Number.isFinite(turn) || !headline || !what_they_did || !alternative) continue;
    turnCritiques.push({ turn, headline, what_they_did, alternative });
  }

  if (turnCritiques.length === 0) return null;
  return { summary, turnCritiques, closingFocus };
}

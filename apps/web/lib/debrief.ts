/**
 * End-of-scenario debrief generation.
 *
 * Passes the full action log to Sonnet and asks for narrative feedback on
 * the trainee's handling of the scenario. No Batch API yet (that's Phase 2).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PlaySession } from './session-store';
import type { ParsedScenario } from './scenario-loader';

const DEBRIEF_MODEL = process.env.FIELDWORK_MODEL_DEBRIEF ?? 'claude-sonnet-4-5';

// Note: Sonnet for debrief. Haiku is too terse for narrative feedback.

export interface DebriefResponse {
  narrative: string;
  modelUsed: string;
}

export async function generateDebrief(params: {
  scenario: ParsedScenario;
  session: PlaySession;
}): Promise<DebriefResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const client = new Anthropic({ apiKey });
  const { scenario, session } = params;

  const system = `You are a senior forward-deployed engineer reviewing a junior colleague's work in a training simulator.

Your critique MUST be specific. Every point you make must:
1. Reference a specific turn by number (e.g., "In turn 3...")
2. Quote or closely paraphrase what the trainee actually said or did on that turn
3. Propose a concrete alternative — the actual phrasing or approach they could have used instead

Generic advice like "ask more questions" or "be more careful" is forbidden. If you cannot point at a specific turn and give a concrete alternative, drop the point.

Focus areas (cover the ones that actually apply to this run, not all of them):
- Discovery: did they ask good clarifying questions at the right moments? Which turns were wasted on unfounded assumptions?
- Stakeholder management: how did they handle ambiguity and pushback? Did they respond to stakeholder concerns directly or dodge them?
- Surprises: did they notice and adapt to mid-scenario twists?
- Efficiency: which specific turns were wasted, and what should have happened instead?
- Production readiness: what in their final approach would break in production?

Return 4-6 paragraphs of prose — no markdown headings, no bullet lists. End with one sentence naming their single most important improvement area for the next run.`;

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
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const narrative = result.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return { narrative, modelUsed: result.model };
}

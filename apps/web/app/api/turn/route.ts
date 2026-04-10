import { NextResponse } from 'next/server';
import {
  evaluateSurprises,
  clampTrust,
  type SurpriseRule,
  type TraineeAction,
} from '@fieldwork/core';
import { scoreTurn } from '@fieldwork/rubric';
import { getSession, appendAction, updateSession } from '@/lib/session-store';
import { loadAndSeed } from '@/lib/scenario-loader';
import { callInnerClaude } from '@/lib/inner-claude';

interface TurnRequestBody {
  sessionId?: string;
  action?: {
    kind?: string;
    payload?: unknown;
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as TurnRequestBody;
  const sessionId = body.sessionId;
  const actionIn = body.action;

  if (!sessionId || !actionIn?.kind) {
    return NextResponse.json(
      { error: 'sessionId and action.kind are required' },
      { status: 400 },
    );
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const { scenario } = loadAndSeed(session.scenarioId);

  if (scenario.turn_budget && session.state.turn >= scenario.turn_budget) {
    return NextResponse.json(
      {
        error: `turn budget (${scenario.turn_budget}) exhausted — run the debrief`,
        budgetExhausted: true,
      },
      { status: 403 },
    );
  }

  const action: TraineeAction = {
    turn: session.state.turn + 1,
    kind: actionIn.kind,
    payload: actionIn.payload,
    timestamp: new Date().toISOString(),
  };

  const surpriseRules = (scenario.surprises ?? []) as SurpriseRule[];
  const firedBefore = evaluateSurprises(session.state, surpriseRules);

  try {
    const { response, modelUsed, usedCache, retried, tier, costUsd, usage } = await callInnerClaude({
      scenario,
      session,
      action,
      firedSurprises: firedBefore.map((s) => `${s.id}: ${s.detail}`),
    });

    appendAction(sessionId, action);

    const newInbox = [
      ...session.state.inbox,
      ...response.stakeholder_messages.map((m) => ({
        from: m.from,
        channel: m.channel,
        body: m.body,
        turn: session.state.turn,
      })),
    ];

    const newLogs = [
      ...session.state.env.logs,
      ...(response.environment_delta.log_lines ?? []),
    ];

    const mergedMetrics = {
      ...session.state.env.metrics,
      ...(response.environment_delta.metric_changes ?? {}),
    };

    const innerClaudeTransitions = extractObjectiveTransitions(
      response.hidden_state_updates,
      scenario,
    );
    const deterministicTransitions = scoreTurn({
      action,
      objectives: scenario.objectives,
    });
    const objectiveTransitions = {
      ...innerClaudeTransitions,
      ...deterministicTransitions,
    };
    const mergedObjectives = { ...session.state.objectives, ...objectiveTransitions };

    const trustDeltas = extractTrustDeltas(response.hidden_state_updates, scenario);
    const mergedTrust = { ...session.state.stakeholderTrust };
    for (const [id, delta] of Object.entries(trustDeltas)) {
      const prior = mergedTrust[id] ?? 0.5;
      mergedTrust[id] = clampTrust(prior + delta);
    }

    const newDiscoveries = extractObjectiveDiscoveries(
      response.hidden_state_updates,
      scenario,
      session.state.discoveredObjectives ?? [],
    );
    const mergedDiscovered = [
      ...(session.state.discoveredObjectives ?? []),
      ...newDiscoveries,
    ];

    const newCumulativeCost = session.cumulativeCostUsd + costUsd;

    updateSession(sessionId, {
      state: {
        ...session.state,
        inbox: newInbox,
        env: {
          ...session.state.env,
          logs: newLogs,
          metrics: mergedMetrics,
        },
        objectives: mergedObjectives,
        discoveredObjectives: mergedDiscovered,
        stakeholderTrust: mergedTrust,
        surprisesFired: [
          ...session.state.surprisesFired,
          ...firedBefore.map((s) => s.id),
        ],
      },
      lastResponseSummary: response.visible_effects,
      lastModelUsed: modelUsed,
      cumulativeCostUsd: newCumulativeCost,
    });

    const updated = getSession(sessionId)!;
    return NextResponse.json({
      state: updated.state,
      response,
      modelUsed,
      modelTier: tier,
      usedCache,
      retried,
      firedSurprises: firedBefore.map((s) => s.id),
      objectiveTransitions,
      deterministicTransitions,
      trustDeltas,
      newDiscoveries,
      turnCostUsd: costUsd,
      cumulativeCostUsd: newCumulativeCost,
      usage,
      turnBudget: scenario.turn_budget ?? null,
    });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

const VALID_OBJECTIVE_STATES = new Set(['open', 'attempted', 'met', 'failed']);

function extractObjectiveTransitions(
  updates: Record<string, unknown> | undefined,
  scenario: { objectives: { id: string }[] },
): Record<string, 'open' | 'attempted' | 'met' | 'failed'> {
  if (!updates || typeof updates !== 'object') return {};
  const raw = (updates as Record<string, unknown>).objective_transitions;
  if (!raw || typeof raw !== 'object') return {};

  const validIds = new Set(scenario.objectives.map((o) => o.id));
  const out: Record<string, 'open' | 'attempted' | 'met' | 'failed'> = {};
  for (const [id, state] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.has(id)) continue;
    if (typeof state !== 'string' || !VALID_OBJECTIVE_STATES.has(state)) continue;
    out[id] = state as 'open' | 'attempted' | 'met' | 'failed';
  }
  return out;
}

function extractObjectiveDiscoveries(
  updates: Record<string, unknown> | undefined,
  scenario: { objectives: { id: string; discoverable?: boolean }[] },
  alreadyDiscovered: string[],
): string[] {
  if (!updates || typeof updates !== 'object') return [];
  const raw = (updates as Record<string, unknown>).objective_discoveries;
  if (!Array.isArray(raw)) return [];

  const discoverable = new Set(
    scenario.objectives.filter((o) => o.discoverable).map((o) => o.id),
  );
  const already = new Set(alreadyDiscovered);

  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string') continue;
    if (!discoverable.has(id)) continue;
    if (already.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

const MAX_TRUST_DELTA = 0.2;

function extractTrustDeltas(
  updates: Record<string, unknown> | undefined,
  scenario: { world: { stakeholders?: { id: string }[] } },
): Record<string, number> {
  if (!updates || typeof updates !== 'object') return {};
  const raw = (updates as Record<string, unknown>).stakeholder_trust_delta;
  if (!raw || typeof raw !== 'object') return {};

  const validIds = new Set((scenario.world.stakeholders ?? []).map((s) => s.id));
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.has(id)) continue;
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    const clamped = Math.max(-MAX_TRUST_DELTA, Math.min(MAX_TRUST_DELTA, value));
    out[id] = clamped;
  }
  return out;
}

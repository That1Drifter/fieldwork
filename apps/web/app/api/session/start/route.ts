import { NextResponse } from 'next/server';
import { emptyEnv } from '@fieldwork/core';
import { createSession } from '@/lib/session-store';
import { loadAndSeed } from '@/lib/scenario-loader';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { scenarioId?: string };
  const scenarioId = body.scenarioId;
  if (!scenarioId) {
    return NextResponse.json({ error: 'scenarioId required' }, { status: 400 });
  }

  try {
    const { scenario, tickets } = loadAndSeed(scenarioId);
    const now = new Date().toISOString();

    const session = createSession({
      scenarioId,
      tickets,
      state: {
        scenarioId,
        sessionId: '',
        turn: 0,
        world: scenario.world,
        env: emptyEnv(),
        inbox: [],
        actionLog: [],
        objectives: Object.fromEntries(
          scenario.objectives.map((o) => [o.id, 'open'] as const),
        ),
        discoveredObjectives: scenario.objectives
          .filter((o) => !o.discoverable)
          .map((o) => o.id),
        stakeholderTrust: Object.fromEntries(
          (scenario.world.stakeholders ?? []).map((s) => [s.id, 0.5] as const),
        ),
        surprisesFired: [],
        rubricScores: {},
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      scenario,
      state: session.state,
      ticketCount: tickets.length,
      ticketsPreview: tickets.slice(0, 20),
      turnBudget: scenario.turn_budget ?? null,
      cumulativeCostUsd: session.cumulativeCostUsd,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 404 },
    );
  }
}

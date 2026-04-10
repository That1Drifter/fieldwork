import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-store';
import { loadAndSeed } from '@/lib/scenario-loader';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  let scenario;
  try {
    ({ scenario } = loadAndSeed(session.scenarioId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    scenario,
    state: session.state,
    ticketCount: session.tickets.length,
    ticketsPreview: session.tickets.slice(0, 20),
    turnBudget: scenario.turn_budget ?? null,
    cumulativeCostUsd: session.cumulativeCostUsd,
  });
}

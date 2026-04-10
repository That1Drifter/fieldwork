import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-store';
import { loadAndSeed } from '@/lib/scenario-loader';
import { generateDebrief } from '@/lib/debrief';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = body.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  if (session.state.actionLog.length === 0) {
    return NextResponse.json(
      { error: 'no actions taken yet — nothing to debrief' },
      { status: 400 },
    );
  }

  try {
    const { scenario } = loadAndSeed(session.scenarioId);
    const result = await generateDebrief({ scenario, session });
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

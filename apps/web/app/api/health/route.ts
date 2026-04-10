import { NextResponse } from 'next/server';

export function GET() {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  return NextResponse.json({
    ok: true,
    anthropic_key_configured: hasKey,
  });
}

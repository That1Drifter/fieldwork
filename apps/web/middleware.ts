import { NextResponse, type NextRequest } from 'next/server';

/**
 * HTTP Basic Auth middleware.
 *
 * Enabled when FIELDWORK_AUTH_PASS is set in the environment. Default-off so
 * local `pnpm dev` works with zero config; turn it on by putting the env vars
 * in `apps/web/.env.local` or the deploy target's `.env` file.
 *
 * Env vars:
 *   FIELDWORK_AUTH_USER — username (default: "fieldwork")
 *   FIELDWORK_AUTH_PASS — password; setting this activates auth
 *
 * /api/health is intentionally unprotected so load balancers, monitors, and
 * the deploy script's readiness check still work.
 */

const REALM = 'fieldwork';

function unauthorized(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

// Constant-time string comparison for Edge runtime (no node:crypto available).
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function middleware(request: NextRequest): NextResponse {
  const expectedPass = process.env.FIELDWORK_AUTH_PASS;
  if (!expectedPass) {
    return NextResponse.next();
  }
  const expectedUser = process.env.FIELDWORK_AUTH_USER ?? 'fieldwork';

  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('basic ')) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(':');
  if (sep < 0) return unauthorized();

  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  const userOk = constantTimeEqual(user, expectedUser);
  const passOk = constantTimeEqual(pass, expectedPass);

  if (!userOk || !passOk) return unauthorized();

  return NextResponse.next();
}

// Run on everything except Next internals, static assets, icons, and health.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|icon|api/health).*)'],
};

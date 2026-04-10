/**
 * Session store with JSON file persistence.
 *
 * All sessions live in a single JSON file under data/sessions.json,
 * loaded lazily on first access and rewritten atomically on every
 * mutation. Good enough for a self-hosted single-user tool; avoids a
 * native sqlite dep.
 *
 * Not safe for multi-process writers — fine because Next.js runs one
 * node process per deployment here.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SimState, TraineeAction } from '@fieldwork/core';
import type { Ticket } from '@fieldwork/core';

export interface PlaySession {
  id: string;
  scenarioId: string;
  state: SimState;
  tickets: Ticket[];
  lastResponseSummary?: string;
  lastModelUsed?: string;
  cumulativeCostUsd: number;
}

const DATA_DIR = process.env.FIELDWORK_DATA_DIR ?? join(process.cwd(), 'data');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

let sessions: Map<string, PlaySession> | null = null;

function ensureLoaded(): Map<string, PlaySession> {
  if (sessions) return sessions;
  sessions = new Map();
  try {
    if (existsSync(SESSIONS_FILE)) {
      const raw = readFileSync(SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, PlaySession>;
      for (const [id, session] of Object.entries(parsed)) {
        sessions.set(id, session);
      }
    }
  } catch (err) {
    console.warn(`[session-store] failed to load ${SESSIONS_FILE}:`, err);
  }
  return sessions;
}

function persist(): void {
  const map = ensureLoaded();
  mkdirSync(dirname(SESSIONS_FILE), { recursive: true });
  const obj: Record<string, PlaySession> = {};
  for (const [id, session] of map) obj[id] = session;
  const tmp = `${SESSIONS_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, SESSIONS_FILE);
}

export function createSession(params: {
  scenarioId: string;
  state: SimState;
  tickets: Ticket[];
}): PlaySession {
  const map = ensureLoaded();
  const id = randomUUID();
  const session: PlaySession = {
    id,
    scenarioId: params.scenarioId,
    state: { ...params.state, sessionId: id },
    tickets: params.tickets,
    cumulativeCostUsd: 0,
  };
  map.set(id, session);
  persist();
  return session;
}

export function getSession(id: string): PlaySession | undefined {
  return ensureLoaded().get(id);
}

export function updateSession(id: string, patch: Partial<PlaySession>): PlaySession {
  const map = ensureLoaded();
  const existing = map.get(id);
  if (!existing) throw new Error(`session not found: ${id}`);
  const updated = { ...existing, ...patch };
  map.set(id, updated);
  persist();
  return updated;
}

export function appendAction(id: string, action: TraineeAction): void {
  const map = ensureLoaded();
  const session = map.get(id);
  if (!session) throw new Error(`session not found: ${id}`);
  session.state.actionLog.push(action);
  session.state.turn += 1;
  session.state.updatedAt = new Date().toISOString();
  persist();
}

export function deleteSession(id: string): void {
  ensureLoaded().delete(id);
  persist();
}

export function listSessions(): PlaySession[] {
  return Array.from(ensureLoaded().values());
}

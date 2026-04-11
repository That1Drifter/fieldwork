'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  goals?: string[];
}

interface Objective {
  id: string;
  desc: string;
  required?: boolean;
}

interface Scenario {
  id: string;
  title: string;
  tagline?: string;
  world: {
    company: { name: string; industry: string; headcount?: number };
    tech_stack?: string[];
    stakeholders?: Stakeholder[];
  };
  objectives: Objective[];
}

interface Ticket {
  id: string;
  subject: string;
  body: string;
  customer: string;
  source: string;
  created_at: string;
  urgency?: string;
}

interface TurnResponse {
  environment_delta: {
    new_tickets?: unknown[];
    log_lines?: string[];
    metric_changes?: Record<string, number>;
  };
  stakeholder_messages: { from: string; channel: string; body: string }[];
  visible_effects: string;
  surprise_triggered: string | null;
}

interface SimState {
  turn: number;
  objectives: Record<string, string>;
  discoveredObjectives: string[];
  stakeholderTrust: Record<string, number>;
  inbox: { from: string; channel: string; body: string; turn: number }[];
  env: { logs: string[]; metrics: Record<string, number> };
  surprisesFired: string[];
  actionLog: { turn: number; kind: string; payload: unknown; timestamp: string }[];
}

interface StartResponse {
  sessionId: string;
  scenario: Scenario & { turn_budget?: number };
  state: SimState;
  ticketCount: number;
  ticketsPreview: Ticket[];
  turnBudget: number | null;
  cumulativeCostUsd: number;
  lastResponseSummary?: string | null;
}

interface TurnApiResponse {
  state: SimState;
  response: TurnResponse;
  modelUsed: string;
  modelTier: 'env' | 'stakeholder';
  usedCache: boolean;
  retried: boolean;
  firedSurprises: string[];
  objectiveTransitions: Record<string, string>;
  newDiscoveries: string[];
  turnCostUsd: number;
  cumulativeCostUsd: number;
  turnBudget: number | null;
}

interface TurnMeta {
  modelUsed: string;
  tier: string;
  usedCache: boolean;
  retried: boolean;
  firedSurprises: string[];
}

export function PlayClient({ scenarioId }: { scenarioId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [state, setState] = useState<SimState | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketCount, setTicketCount] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [lastEffects, setLastEffects] = useState<string>('');
  const [lastMeta, setLastMeta] = useState<TurnMeta | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<string | null>(null);
  const [turnBudget, setTurnBudget] = useState<number | null>(null);
  const [cumulativeCost, setCumulativeCost] = useState<number>(0);
  const [flashingObjectives, setFlashingObjectives] = useState<Set<string>>(new Set());

  const applySessionData = useCallback((data: StartResponse) => {
    setSessionId(data.sessionId);
    setScenario(data.scenario);
    setState(data.state);
    setTickets(data.ticketsPreview);
    setTicketCount(data.ticketCount);
    setTurnBudget(data.turnBudget);
    setCumulativeCost(data.cumulativeCostUsd ?? 0);
    setLastEffects(data.lastResponseSummary ?? '');
    setLastMeta(null);
  }, []);

  const startSession = useCallback(async () => {
    setError(null);
    setDebrief(null);
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      if (!res.ok) {
        setError(`session start failed: ${res.status}`);
        return;
      }
      applySessionData((await res.json()) as StartResponse);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [scenarioId, applySessionData]);

  const restoreSession = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      setDebrief(null);
      try {
        const res = await fetch(`/api/session/${id}`);
        if (res.status === 404) return false;
        if (!res.ok) {
          setError(`session restore failed: ${res.status}`);
          return false;
        }
        applySessionData((await res.json()) as StartResponse);
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      }
    },
    [applySessionData],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const existing = url.searchParams.get('session');
    if (existing) {
      restoreSession(existing).then((ok) => {
        if (!ok) startSession();
      });
    } else {
      startSession();
    }
  }, [restoreSession, startSession]);

  // Keep ?session=<id> in the URL in sync with the active sessionId so a
  // page reload (or shared link) restores the same session instead of
  // silently starting a new one.
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('session') === sessionId) return;
    url.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', url.toString());
  }, [sessionId]);

  const runTurn = async () => {
    if (!sessionId || !prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: { kind: 'prompt', payload: { text: prompt } },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `turn failed: ${res.status}`);
        return;
      }
      const turn = data as TurnApiResponse;
      setState(turn.state);
      setLastEffects(turn.response.visible_effects);
      setLastMeta({
        modelUsed: turn.modelUsed,
        tier: turn.modelTier,
        usedCache: turn.usedCache,
        retried: turn.retried,
        firedSurprises: turn.firedSurprises,
      });
      setCumulativeCost(turn.cumulativeCostUsd);
      if (turn.newDiscoveries && turn.newDiscoveries.length > 0) {
        setFlashingObjectives(new Set(turn.newDiscoveries));
        setTimeout(() => setFlashingObjectives(new Set()), 2500);
      }
      setPrompt('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runDebrief = async () => {
    if (!sessionId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `debrief failed: ${res.status}`);
        return;
      }
      setDebrief(data.narrative);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!scenario || !state) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-neutral-400" data-testid="loading">
          Loading scenario…
        </p>
        {error && <p className="mt-2 text-red-400">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link
            href="/"
            className="mb-1 inline-block text-sm text-neutral-500 transition-colors hover:text-neutral-300 focus-visible:text-neutral-300 focus-visible:outline-none"
            data-testid="back-to-scenarios"
          >
            ← all scenarios
          </Link>
          <h1 className="text-3xl font-semibold" data-testid="scenario-title">
            {scenario.title}
          </h1>
          <p className="text-base text-neutral-400">
            {scenario.world.company.name} ·{' '}
            <span data-testid="turn-counter">
              turn {state.turn}
              {turnBudget != null && ` / ${turnBudget}`}
            </span>
            {' · '}
            <span data-testid="cost-display">${cumulativeCost.toFixed(4)}</span>
          </p>
        </div>
        <button
          onClick={() => {
            if (
              state.turn > 0 &&
              !window.confirm(
                `Reset this session? You will lose turn ${state.turn} and any progress.`,
              )
            ) {
              return;
            }
            startSession();
          }}
          className="rounded border border-neutral-800 px-3 py-1 text-base text-neutral-400 transition-colors hover:border-red-900 hover:bg-red-950/30 hover:text-red-300 focus-visible:border-red-800 focus-visible:outline-none"
          data-testid="reset-button"
        >
          reset
        </button>
      </header>

      {turnBudget != null && state.turn >= turnBudget && !debrief && (
        <div className="mb-4 rounded border border-amber-900 bg-amber-950/40 p-3 text-base text-amber-300" data-testid="budget-exhausted">
          Turn budget exhausted ({turnBudget} turns used). Run the debrief to review your performance.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-900 bg-red-950/40 p-3 text-base text-red-300" data-testid="error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section
          className="rounded border border-neutral-800 bg-neutral-900 p-4"
          data-testid="briefing-panel"
        >
          <h2 className="mb-2 text-sm uppercase tracking-wider text-neutral-500">Briefing</h2>
          <p className="mb-3 text-base text-neutral-300">{scenario.tagline}</p>

          <div className="mb-3 text-sm text-neutral-400">
            <div className="font-medium text-neutral-300">Company</div>
            <div>{scenario.world.company.industry}</div>
            {scenario.world.company.headcount && <div>{scenario.world.company.headcount} people</div>}
          </div>

          {scenario.world.stakeholders && (
            <div className="mb-3 text-sm">
              <div className="mb-1 font-medium text-neutral-300">Stakeholders</div>
              <ul className="space-y-2 text-neutral-400" data-testid="stakeholders">
                {scenario.world.stakeholders.map((s) => {
                  const trust = state.stakeholderTrust?.[s.id] ?? 0.5;
                  const barColor =
                    trust > 0.7
                      ? 'bg-green-500'
                      : trust < 0.4
                        ? 'bg-red-500'
                        : 'bg-neutral-500';
                  return (
                    <li key={s.id} data-testid={`stakeholder-${s.id}`}>
                      <div>
                        <span className="text-neutral-300">{s.name}</span> — {s.role}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded bg-neutral-800">
                          <div
                            className={`h-full rounded ${barColor} transition-all duration-300`}
                            style={{ width: `${trust * 100}%` }}
                            data-testid={`trust-bar-${s.id}`}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-neutral-500" data-testid={`trust-value-${s.id}`}>
                          {trust.toFixed(2)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mb-2 text-sm">
            <div className="mb-1 font-medium text-neutral-300">Objectives</div>
            <ul className="space-y-1" data-testid="objectives-list">
              {scenario.objectives
                .filter((o) => (state.discoveredObjectives ?? []).includes(o.id))
                .map((o) => {
                  const flashing = flashingObjectives.has(o.id);
                  return (
                    <li
                      key={o.id}
                      data-testid={`objective-${o.id}`}
                      className={`text-neutral-400 transition-colors duration-1000 ${
                        flashing ? 'rounded bg-amber-900/40 px-1' : ''
                      }`}
                    >
                      <span
                        className={
                          state.objectives[o.id] === 'met'
                            ? 'text-green-400'
                            : state.objectives[o.id] === 'failed'
                              ? 'text-red-400'
                              : 'text-neutral-500'
                        }
                      >
                        [{state.objectives[o.id] ?? 'open'}]
                      </span>{' '}
                      {o.desc}
                    </li>
                  );
                })}
            </ul>
          </div>
        </section>

        <section
          className="rounded border border-neutral-800 bg-neutral-900 p-4"
          data-testid="work-area"
        >
          <h2 className="mb-2 text-sm uppercase tracking-wider text-neutral-500">Work area</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to do. E.g. “Query the ticket API for the past week and propose a classification taxonomy.”"
            className="h-40 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-base text-neutral-200"
            data-testid="prompt-input"
            disabled={loading}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={runTurn}
              disabled={
                loading ||
                !prompt.trim() ||
                (turnBudget != null && state.turn >= turnBudget)
              }
              className="rounded bg-neutral-100 px-4 py-1 text-base font-medium text-neutral-900 disabled:opacity-40"
              data-testid="run-button"
            >
              {loading ? 'running…' : 'run turn'}
            </button>
            <button
              onClick={runDebrief}
              disabled={loading || state.actionLog.length === 0}
              className="rounded border border-neutral-800 px-4 py-1 text-base text-neutral-300 disabled:opacity-40"
              data-testid="debrief-button"
            >
              debrief
            </button>
          </div>
          {lastEffects && (
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-950 p-3 text-base text-neutral-300" data-testid="visible-effects">
              {lastEffects}
              {lastMeta && (
                <div className="mt-2 text-sm uppercase tracking-wider text-neutral-600">
                  {lastMeta.modelUsed} · {lastMeta.tier}
                  {lastMeta.usedCache && ' · cached'}
                  {lastMeta.retried && ' · retried'}
                  {lastMeta.firedSurprises.length > 0 &&
                    ` · surprise: ${lastMeta.firedSurprises.join(', ')}`}
                </div>
              )}
            </div>
          )}
          {debrief && (
            <>
              <div className="mt-4 whitespace-pre-wrap rounded border border-blue-900 bg-blue-950/30 p-3 text-base text-blue-100" data-testid="debrief-output">
                {debrief}
              </div>
              <Link
                href="/"
                className="mt-3 inline-block rounded border border-blue-900 bg-blue-950/30 px-3 py-1.5 text-sm text-blue-200 transition-colors hover:border-blue-700 hover:bg-blue-900/40 focus-visible:border-blue-700 focus-visible:outline-none"
                data-testid="pick-another-scenario"
              >
                Pick another scenario →
              </Link>
            </>
          )}
        </section>

        <section
          className="rounded border border-neutral-800 bg-neutral-900 p-4"
          data-testid="environment-panel"
        >
          <h2 className="mb-2 text-sm uppercase tracking-wider text-neutral-500">
            Environment · {ticketCount} tickets
          </h2>
          <div className="mb-3">
            <div className="mb-1 text-sm font-medium text-neutral-300">Inbox</div>
            <ul className="space-y-1 text-sm" data-testid="inbox">
              {state.inbox.length === 0 && <li className="text-neutral-500">(empty)</li>}
              {state.inbox.slice(-5).map((m, i) => (
                <li key={i} className="text-neutral-400">
                  <span className="text-neutral-300">{m.from}</span>: {m.body}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-neutral-300">Tickets (first 20)</div>
            <ul className="fw-scroll max-h-80 space-y-1 overflow-y-auto pr-1 text-sm" data-testid="ticket-list">
              {tickets.map((t) => (
                <li key={t.id} className="border-b border-neutral-800 py-1 text-neutral-400">
                  <div className="text-neutral-300">{t.id} — {t.subject}</div>
                  <div className="truncate text-neutral-500">{t.customer || '(no customer)'}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded border border-neutral-800 bg-neutral-900" data-testid="action-log">
        <button
          onClick={() => setLogOpen((v) => !v)}
          className="flex w-full items-center justify-between p-3 text-left text-sm uppercase tracking-wider text-neutral-500 hover:bg-neutral-800/50"
        >
          <span>Action log ({state.actionLog.length})</span>
          <span>{logOpen ? '▾' : '▸'}</span>
        </button>
        {logOpen && (
          <ul className="divide-y divide-neutral-800 border-t border-neutral-800 text-sm">
            {state.actionLog.length === 0 && (
              <li className="p-3 text-neutral-500">no actions yet</li>
            )}
            {state.actionLog.map((a, i) => (
              <li key={i} className="p-3 text-neutral-400">
                <div className="text-neutral-500">
                  turn {a.turn} · {a.kind} · {new Date(a.timestamp).toLocaleTimeString()}
                </div>
                <pre className="mt-1 whitespace-pre-wrap text-neutral-300">
                  {JSON.stringify(a.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

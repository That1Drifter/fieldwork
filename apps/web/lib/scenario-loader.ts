/**
 * Load and parse a scenario manifest by id, with seed data attached.
 *
 * Thin wrapper around @fieldwork/scenarios that also materializes the
 * deterministic data generators declared in the manifest.
 */

import { loadScenario } from '@fieldwork/scenarios';
import { generateTickets, type Ticket } from '@fieldwork/core';
import type { ObjectiveRubricRule } from '@fieldwork/rubric';

export interface ParsedStakeholder {
  id: string;
  name: string;
  role: string;
  traits?: Record<string, number>;
  goals?: string[];
}

export interface ParsedObjective {
  id: string;
  desc: string;
  required?: boolean;
  discoverable?: boolean;
  rubric?: ObjectiveRubricRule[];
}

export interface ParsedScenario {
  id: string;
  title: string;
  tagline?: string;
  tier: number;
  turn_budget?: number;
  estimated_cost_usd?: number;
  world: {
    company: {
      name: string;
      industry: string;
      headcount?: number;
      maturity?: string;
    };
    tech_stack?: string[];
    stakeholders?: ParsedStakeholder[];
  };
  objectives: ParsedObjective[];
  surprises?: unknown[];
  rubric?: Record<string, string[]>;
  debrief?: { model?: string; batch?: boolean; focus?: string };
  data_generators?: Array<{
    type: string;
    count?: number;
    seed?: number;
    distribution?: Record<string, number>;
    noise?: Record<string, number>;
  }>;
}

export function loadAndSeed(id: string): { scenario: ParsedScenario; tickets: Ticket[] } {
  const scenario = loadScenario(id) as ParsedScenario;
  const tickets: Ticket[] = [];

  for (const gen of scenario.data_generators ?? []) {
    if (gen.type === 'tickets') {
      tickets.push(
        ...generateTickets({
          count: gen.count ?? 100,
          seed: gen.seed ?? 1,
          distribution: (gen.distribution ?? {}) as Record<string, number>,
          noise: gen.noise ?? {},
        }),
      );
    }
  }

  return { scenario, tickets };
}

import { describe, it, expect } from 'vitest';
import { generateTickets } from '../tickets';

const baseOpts = {
  count: 50,
  seed: 42,
  distribution: {
    billing: 0.3,
    technical: 0.35,
    account: 0.2,
    shipping: 0.1,
    spam: 0.05,
  },
  noise: { typos: 0.15, non_english: 0.05, duplicates: 0.08, missing_fields: 0.1 },
};

describe('generateTickets', () => {
  it('is deterministic for the same seed', () => {
    const a = generateTickets(baseOpts);
    const b = generateTickets(baseOpts);
    expect(a).toEqual(b);
  });

  it('differs across seeds', () => {
    const a = generateTickets({ ...baseOpts, seed: 1 });
    const b = generateTickets({ ...baseOpts, seed: 2 });
    expect(a[0]).not.toEqual(b[0]);
  });

  it('produces the requested count (± duplicates skew)', () => {
    const tickets = generateTickets(baseOpts);
    expect(tickets.length).toBeGreaterThanOrEqual(40);
    expect(tickets.length).toBeLessThanOrEqual(60);
  });

  it('assigns a category_truth to every ticket', () => {
    const tickets = generateTickets(baseOpts);
    for (const t of tickets) {
      expect(t.category_truth).toBeTruthy();
    }
  });

  it('honors zero-noise configuration', () => {
    const tickets = generateTickets({
      ...baseOpts,
      noise: {},
    });
    expect(tickets.length).toBe(baseOpts.count);
    for (const t of tickets) {
      expect(t.customer).toBeTruthy();
    }
  });
});

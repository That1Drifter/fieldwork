/**
 * Deterministic ticket generator.
 *
 * Produces realistic-looking support tickets from a seeded RNG, honoring
 * the distribution and noise settings from a scenario manifest. Used by the
 * support-triage scenario (and any future scenarios that want a seeded
 * ticket backlog without calling Claude).
 */

import { mulberry32, weightedPick, chance, pick, type Rng } from './rng';

export type TicketCategory =
  | 'billing'
  | 'technical'
  | 'account'
  | 'shipping'
  | 'spam';

export interface Ticket {
  id: string;
  source: string;
  created_at: string;
  subject: string;
  body: string;
  customer: string;
  category_truth: TicketCategory | null;
  urgency?: string;
}

export interface TicketGeneratorOptions {
  count: number;
  seed: number;
  distribution: Partial<Record<TicketCategory, number>>;
  noise: {
    typos?: number;
    non_english?: number;
    duplicates?: number;
    missing_fields?: number;
  };
}

const TEMPLATES: Record<TicketCategory, { subject: string[]; body: string[] }> = {
  billing: {
    subject: [
      'Invoice #{n} charges',
      'Double charge on {month}',
      'Refund request',
      'Subscription billing question',
      'Duplicate invoice received',
    ],
    body: [
      'I was charged twice for order {n}. Please investigate and refund.',
      'Your last invoice lists a line item I do not recognize — can you explain?',
      'I need to update my billing address before the next cycle.',
      'Cancel my auto-renewal, I am moving to a different provider.',
    ],
  },
  technical: {
    subject: [
      'App crashes on startup',
      'Tracking link broken',
      'Cannot log in',
      'Page load errors',
      'API returning 500',
    ],
    body: [
      'Your mobile app crashes every time I open the shipments tab. Pixel 7, latest version.',
      'The tracking link in email #{n} returns a 404. Order was placed last week.',
      'Keeps saying my password is wrong but the reset email never arrives.',
      'Our integration is getting 500s from the /orders endpoint since yesterday morning.',
    ],
  },
  account: {
    subject: [
      'Delete my account',
      'Change email on file',
      'Add a user to my team',
      'Permissions question',
      'GDPR data export request',
    ],
    body: [
      'Please delete all my data — I am no longer using the service.',
      'I need to transfer admin rights to a colleague, how do I do that?',
      'Our team lead left, we need to reset the root account.',
      'Can you export everything on file about me under GDPR?',
    ],
  },
  shipping: {
    subject: [
      'Package marked delivered but not received',
      'Wrong address on order #{n}',
      'Damaged shipment',
      'Delivery delayed',
      'Missing items from shipment',
    ],
    body: [
      'Order #{n} shows delivered but we never got it. Can you check with the carrier?',
      'The shipment arrived with crushed boxes. Several items are damaged beyond use.',
      'Order was supposed to arrive yesterday. Tracker has not updated in three days.',
      'Can you reroute order #{n} to a new address? We moved.',
    ],
  },
  spam: {
    subject: [
      'URGENT: verify your account',
      'You won a prize',
      'Cheap meds available',
      'Hi dear',
      'LOAN OFFER limited time',
    ],
    body: [
      'Click here to claim your reward https://totally-not-phishing.example',
      'Best price meds no prescription needed contact now',
      'Hi dear I am prince and need help transferring funds',
      'Congratulations you have been selected act now',
    ],
  },
};

const CUSTOMERS = [
  'alice@acme.co',
  'bob.lin@globex.com',
  'priya.shah@initech.io',
  'm.obi@umbrella.corp',
  'sam@startup.xyz',
  'taro@keiretsu.jp',
  'lee@hanguk.kr',
  'carla@cooperativa.es',
];

const NON_ENGLISH_SUBJECTS = [
  'Problema con mi pedido',
  'Demande de remboursement',
  'Probleme mit Lieferung',
  '配送の問題について',
  'Queixa sobre cobrança',
];

const NON_ENGLISH_BODIES = [
  'Hola, tengo un problema con el pedido y necesito ayuda.',
  'Bonjour, je voudrais un remboursement pour ma dernière commande.',
  'Guten Tag, meine Sendung ist nicht angekommen.',
  'こんにちは、配送に問題があります。',
  'Olá, estou tendo problemas com a cobrança deste mês.',
];

function applyTypos(text: string, rng: Rng): string {
  if (text.length < 5) return text;
  const i = Math.floor(rng() * (text.length - 2)) + 1;
  return text.slice(0, i) + text.slice(i + 1, i + 2) + text.slice(i, i + 1) + text.slice(i + 2);
}

function fill(template: string, rng: Rng): string {
  return template
    .replace(/\{n\}/g, () => String(Math.floor(rng() * 9000) + 1000))
    .replace(/\{month\}/g, () =>
      pick(rng, ['January', 'February', 'March', 'April', 'May', 'June']),
    );
}

export function generateTickets(opts: TicketGeneratorOptions): Ticket[] {
  const rng = mulberry32(opts.seed);
  const tickets: Ticket[] = [];

  const distribution = { ...opts.distribution } as Record<TicketCategory, number>;

  for (let i = 0; i < opts.count; i++) {
    const category = weightedPick(rng, distribution);
    const templates = TEMPLATES[category];
    let subject = fill(pick(rng, templates.subject), rng);
    let body = fill(pick(rng, templates.body), rng);

    if (chance(rng, opts.noise.non_english ?? 0)) {
      subject = pick(rng, NON_ENGLISH_SUBJECTS);
      body = pick(rng, NON_ENGLISH_BODIES);
    }
    if (chance(rng, opts.noise.typos ?? 0)) {
      subject = applyTypos(subject, rng);
      body = applyTypos(body, rng);
    }

    const createdAt = new Date(
      Date.UTC(2026, 0, 1) + Math.floor(rng() * 30 * 86400 * 1000),
    ).toISOString();

    const customer = chance(rng, opts.noise.missing_fields ?? 0)
      ? ''
      : pick(rng, CUSTOMERS);

    tickets.push({
      id: `t-${String(i + 1).padStart(4, '0')}`,
      source: 'zendesk',
      created_at: createdAt,
      subject,
      body,
      customer,
      category_truth: category,
    });

    if (chance(rng, opts.noise.duplicates ?? 0) && tickets.length < opts.count) {
      const dup = { ...tickets[tickets.length - 1]! };
      dup.id = `t-${String(tickets.length + 1).padStart(4, '0')}`;
      tickets.push(dup);
      i++;
    }
  }

  return tickets;
}

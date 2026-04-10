import Link from 'next/link';
import { listScenarios, loadScenario } from '@fieldwork/scenarios';

interface ScenarioMeta {
  id: string;
  title: string;
  tagline?: string;
  estimated_duration_minutes?: number;
  turn_budget?: number;
}

export default function Home() {
  const scenarios = listScenarios()
    .map((s): ScenarioMeta => {
      try {
        const m = loadScenario(s.id) as Partial<ScenarioMeta> & { id: string };
        return {
          id: s.id,
          title: m.title ?? s.id,
          tagline: m.tagline,
          estimated_duration_minutes: m.estimated_duration_minutes,
          turn_budget: m.turn_budget,
        };
      } catch {
        return { id: s.id, title: s.id };
      }
    });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl font-semibold tracking-tight">fieldwork</h1>
      <p className="mt-2 text-lg text-neutral-400">
        Practice forward-deployed engineering against simulated customer environments.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-medium uppercase tracking-wider text-neutral-500">
          Scenarios
        </h2>
        <ul className="space-y-3">
          {scenarios.map((s) => (
            <li key={s.id}>
              <Link
                href={`/play/${s.id}`}
                className="group block rounded border border-neutral-800 bg-neutral-900 px-5 py-4 transition-colors hover:border-neutral-600 hover:bg-neutral-900/60 focus-visible:border-neutral-500 focus-visible:outline-none"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-lg font-medium text-neutral-100">
                    {s.title}
                  </h3>
                  <span className="font-mono text-xs text-neutral-600 group-hover:text-neutral-500">
                    {s.id}
                  </span>
                </div>
                {s.tagline && (
                  <p className="mt-1 text-sm text-neutral-400">{s.tagline}</p>
                )}
                {(s.turn_budget != null || s.estimated_duration_minutes != null) && (
                  <div className="mt-3 flex gap-4 text-xs text-neutral-500">
                    {s.turn_budget != null && (
                      <span>
                        <span className="text-neutral-600">turns</span> {s.turn_budget}
                      </span>
                    )}
                    {s.estimated_duration_minutes != null && (
                      <span>
                        <span className="text-neutral-600">~</span>
                        {s.estimated_duration_minutes} min
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 text-sm text-neutral-600">
        Independent personal project. Not affiliated with Anthropic.
      </footer>
    </main>
  );
}

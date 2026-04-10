# Contributing to fieldwork

Thanks for your interest. Scenarios are the main contribution surface — the
engine, CLI, and UI are maintained as a small personal project, but the catalog
is meant to grow with the community.

## Development setup

```bash
git clone https://github.com/<you>/fieldwork
cd fieldwork
pnpm install
pnpm test
pnpm --filter @fieldwork/web dev
```

You'll need Node 20+ and pnpm 9+.

## Adding a scenario

1. Create a directory under `packages/scenarios/<your-scenario-id>/`
2. Add a `manifest.yaml` — see
   [`support-triage/manifest.yaml`](packages/scenarios/support-triage/manifest.yaml)
   for the reference format
3. Add a `README.md` explaining the scenario premise and what it's teaching
4. Run `pnpm --filter @fieldwork/scenarios validate` to check the schema
5. Open a PR

Scenario IDs must match `^[a-z0-9][a-z0-9-]*$` (lowercase, hyphen-separated).

## Scenario quality bar

Before submitting, make sure your scenario:

- **Has a clear trainee objective** — not "vibes," something that can be scored
- **Is realistic** — based on real FDE-style situations, not abstract puzzles
- **Has at least one surprise** — something the trainee has to notice or adapt to
- **Runs under ~$2 in API costs** for a typical session
- **Passes schema validation**

## Code contributions

- Run `pnpm test` and `pnpm typecheck` before opening a PR
- Match the existing code style — no comments explaining _what_, only _why_
- Keep PRs focused; split unrelated changes

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

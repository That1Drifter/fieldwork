# Getting Started

## Prerequisites

- Node 20 or newer
- pnpm 9 or newer (`npm install -g pnpm`)
- An Anthropic API key — get one at https://console.anthropic.com/

## Install

```bash
git clone https://github.com/<you>/fieldwork
cd fieldwork
pnpm install
```

## Configure

```bash
cp .env.example .env
# open .env and paste your ANTHROPIC_API_KEY
```

## Run the web app

```bash
pnpm --filter @fieldwork/web dev
```

Open http://localhost:3000.

## Run the CLI

```bash
pnpm --filter @fieldwork/cli exec fieldwork validate packages/scenarios/support-triage/manifest.yaml
```

## Run the tests

```bash
pnpm test
```

## What's playable today

- All six scenarios in the catalog (Support Ticket Classifier, Internal Doc Q&A,
  Data Pipeline Automation, Multi-Step Workflow Agent, Legacy System Migration,
  Production Incident Response) are authored, schema-valid, and loadable through
  the web app. Support Ticket Classifier and Internal Doc Q&A are verified
  end-to-end against a live API; the other four are authored but not yet exercised
  on live API.
- Full turn loop through inner Claude with JSON contract validation + retry
- Prompt caching and Haiku/Sonnet model tiering
- Stakeholder dialogue with trust meter (0-1 per stakeholder)
- Discoverable objectives (hidden until the trainee surfaces them)
- Per-turn objective state transitions: inner Claude proposes + deterministic
  manifest `rubric` rules (`action_kind` / `payload_contains` / `payload_regex`)
  override when they match
- Surprise engine with `turn_count`, `objective_state`, `action_pattern`, and
  `random` triggers
- Turn budget + cumulative USD cost display
- Collapsible action log viewer
- End-of-scenario debrief with turn-specific, alternative-prompt critiques
- JSON file session persistence (survives server restart)
- `fieldwork validate` CLI wired to the scenario schema

See [TODO.md](../TODO.md) for what's left to build.

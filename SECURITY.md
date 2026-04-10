# Security Policy

## Reporting a vulnerability

fieldwork is a self-hosted tool that handles Anthropic API keys via local
`.env` files. If you find a vulnerability — especially anything that could
leak API keys, persist prompt injection, or execute arbitrary code on a user's
machine — please report it privately before opening a public issue.

Open a [GitHub Security Advisory](../../security/advisories/new) on this repo,
or email the maintainer.

## Scope

- The engine, CLI, and web app in this repo
- Scenarios in `packages/scenarios/`
- CI workflows in `.github/workflows/`

## Not in scope

- Issues in the Anthropic API itself (report to Anthropic)
- Issues in third-party dependencies (report upstream and let us know)

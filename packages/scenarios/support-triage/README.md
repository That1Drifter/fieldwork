# Support Ticket Classifier

**Tier 1 — Foundational**

Deploy a Claude-based triage system over Northwind Logistics' messy support
ticket backlog. Practice prompt engineering, classification taxonomy design,
and edge case handling.

## What you're walking into

Northwind is a 1,200-person series-B freight startup. Their support queue is
clogged with mis-categorized tickets, and Priya (Head of Support) wants you to
get agents focused on real work. Marcus (EM, Platform) has to sign off on
anything you ship.

## Objectives

- Define a classification taxonomy covering >=95% of traffic
- Reach >=85% accuracy on a held-out test set
- Bonus: handle non-English tickets and surface low-confidence calls

## What to watch for

- Duplicate tickets and missing fields in the seed data
- Stakeholder expectations that don't match each other
- A schema surprise around turn 10

See [`manifest.yaml`](./manifest.yaml) for the full scenario definition.

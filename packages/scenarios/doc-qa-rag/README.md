# Internal Doc Q&A (RAG)

**Tier 1 — Foundational**

Stand up a retrieval-augmented Q&A system over Helix Biotherapeutics' tangled
internal knowledge base — wiki pages, HR policies, slack exports, runbooks, and
a pile of PDFs. Practice chunking strategy, retrieval quality, hallucination
mitigation, source attribution, and ambiguous-query handling.

## What you're walking into

Helix is an 850-person pre-IPO biotech. Scientists waste hours hunting for
answers across Confluence, Notion, and five years of slack archives. Rhea
(Head of Knowledge & Internal Tools) wants broad coverage shipped fast so
people stop DMing her. Daniel (Director of InfoSec & Compliance) cares about
exactly two things: every answer cites its source, and nothing GxP-controlled
leaks to unauthorized readers. You won't make both of them happy at once.

## Objectives

- Define a chunking and embedding strategy fit for a mixed wiki/PDF/slack corpus
- Reach >=80% helpfulness on a held-out 30-question eval set
- Keep restricted and GxP-marked docs isolated from unauthorized answers
- Bonus (discoverable): source attribution on every answer, graceful handling
  of ambiguous queries

## What to watch for

- ~18% stale docs and ~9% contradictions sitting in the corpus
- Restricted-marking metadata that's easy to miss during ingestion
- A hallucinated citation surfacing in front of Daniel during a demo
- Contradictory wiki pages Rhea will ask about around turn 8

See [`manifest.yaml`](./manifest.yaml) for the full scenario definition.

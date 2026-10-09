# Aven

> AI-assisted cashless health-insurance pre-authorization platform with deterministic evidence grounding and human-in-the-loop decisioning.

Aven is a portfolio and learning project built around a fictional health insurer, **Meridian Health Assurance**. It demonstrates modern agentic AI, Retrieval-Augmented Generation (RAG), and full-stack system design applied to cashless health-insurance pre-authorizations.

---

## The Problem & The Solution

In typical cashless hospitalization workflows, a hospital desk submits an initial pre-authorization request with medical admission notes and diagnostic estimates. Insurer staff often review the case hours later, only then noticing a missing mandatory document, illegible handwriting, or unverified policy waiting period. This causes stressful delays during hospital admission.

**Aven** introduces an early-validation and evidence-grounded review pipeline:
1. **Early Packet Analysis:** Immediately inspects submitted forms and documents against structured checklists to identify missing required documents before human reviewers pick up the ticket.
2. **Deterministic Evidence Grounding:** Connects every extracted clinical fact, waiting-period calculation, and clause evaluation directly to page-level citations and policy versions.
3. **Reviewer Decision Workspace:** Provides insurer medical adjudicators with clear side-by-side evidence references, transparent rule traces, and full authority over claim outcomes.

---

## Non-Negotiable Product Safeguards

Aven is governed by strict safety principles defined in [`AVEN_PRD.md`](./AVEN_PRD.md):

1. **AI Never Decides:** AI models extract, retrieve, verify, and draft. Only authenticated insurer reviewers approve, partially approve, or deny pre-authorizations.
2. **No Automatic Denial on Non-Response:** When a hospital does not reply to document clarifications, Aven issues reminders and escalates to staff—it never denies a claim automatically.
3. **Immutable Target Deadlines:** Pre-authorization regulatory turnaround deadlines are anchored to initial packet receipt. Retries, clarifications, and re-analyses never reset the target clock.
4. **Dated Evidence Required:** A current diagnosis is never treated as proof of prior knowledge, non-disclosure, or pre-existing condition fraud without dated documentary evidence and human confirmation.
5. **Full Evidence Lineage:** Findings retain all supporting document IDs, page references, clause versions, and calculation inputs—never isolated LLM summaries.
6. **Strict Service Authority:** Express is the sole application-write authority. FastAPI and LangGraph return candidate analysis findings only.
7. **Synthetic Data Only:** Real patient records and confidential insurer documents are strictly excluded. The platform operates exclusively on synthetic demo data.

---

## Technology Stack & Architecture

- **Frontend:** Next.js (App Router), TypeScript, modern component architecture
- **Core API & Write Authority:** Express.js, TypeScript, PostgreSQL via Prisma ORM
- **AI Service & Workflow:** FastAPI, Python, LangChain, and LangGraph
- **Vector Search & Embeddings:** PostgreSQL with `pgvector`
- **Object Storage:** S3-compatible private object storage
- **Asynchronous Processing:** PostgreSQL-backed queue with leases and attempt fencing

### Monorepo Structure

```text
aven/
├── apps/
│   ├── web/           # Next.js web application (Hospital & Reviewer portals)
│   ├── api/           # Express TypeScript core API & database write authority
│   └── ai/            # FastAPI Python AI analysis service (LangChain / LangGraph)
├── packages/
│   └── contracts/     # Shared TypeScript schemas, types, and DTOs
├── infra/             # Docker Compose configurations for local PostgreSQL & storage
└── docs/              # Architecture guides, local setup, and stage walkthroughs
    └── walkthroughs/  # Chronological per-stage build walkthroughs
```

---

## Implementation Roadmap

Aven is constructed through a disciplined 200-stage implementation roadmap defined in [`AVEN_STAGES.md`](./AVEN_STAGES.md). Each stage implements a focused, atomic unit of functionality accompanied by an explanatory walkthrough in `docs/walkthroughs/`.

Refer to [`docs/walkthroughs/`](./docs/walkthroughs/) for detailed documentation of each completed phase and stage.

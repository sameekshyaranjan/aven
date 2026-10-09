# Aven

> AI-assisted cashless health-insurance pre-authorization platform with deterministic evidence grounding and human-in-the-loop decisioning.

Aven is a portfolio and learning project built around a fictional health insurer, **Meridian Health Assurance**. It demonstrates modern agentic AI, Retrieval-Augmented Generation (RAG), and production-minded full-stack engineering applied to real-world cashless health-insurance pre-authorization workflows — using **synthetic data only**.

---

## The Problem

In a typical cashless hospitalization, a hospital submits a pre-authorization request to the insurer with admission notes and diagnostic estimates. Insurer staff review the case hours — sometimes days — later, and only then discover a missing mandatory document, an illegible field, or an unresolved policy waiting period. By then, the patient is already admitted and waiting.

**Aven addresses this by running an early-validation and AI-assisted review pipeline immediately after submission**, so routine gaps are caught before a human reviewer even opens the case.

---

## What Aven Does

1. **Early Packet Validation** — Checks submitted forms and documents against a versioned, structured checklist immediately after intake. Identifies missing required evidence before staff review begins.

2. **AI-Assisted Extraction** — Classifies uploaded documents (doctor's note, investigation report, hospital estimate) and extracts structured clinical facts with page-level evidence citations.

3. **Policy Retrieval (RAG)** — Retrieves the exact policy clauses applicable to the patient's plan version, addon combination, and admission date using semantic search over a fictional policy corpus.

4. **Deterministic Rule Execution** — Calculates waiting periods, coverage limits, copay, and addon precedence using typed application code — never LLM arithmetic.

5. **Reviewer Decision Workspace** — Presents insurer staff with all extracted facts, evidence citations, policy clause references, and rule traces in one structured workspace. Every approval, partial approval, or refusal is a human decision.

6. **Document-Request Loop** — Supports structured communication between the insurer and hospital: request → hospital response → re-analysis → reviewer decision.

---

## What Aven Does NOT Do

- Make autonomous approval or denial decisions
- Connect to real insurers, hospitals, IRDAI, or payment networks
- Process real patient data (synthetic identities only)
- Treat a current diagnosis as proof of a pre-existing condition
- Request final bills or discharge summaries during initial pre-auth

---

## Non-Negotiable Safety Principles

| Principle | Implementation |
|-----------|---------------|
| **AI Never Decides** | Only authenticated insurer reviewers may approve, partially approve, or refuse. AI extracts and drafts only. |
| **No Auto-Denial** | An overdue hospital response triggers reminders and staff escalation — never automatic denial. |
| **Immutable Deadlines** | The original receipt timestamp is set once at submission. Retries, re-analyses, and clarifications never reset it. |
| **Evidence Before Conclusions** | Every finding retains document ID, page, quote, clause version, and calculation inputs. No isolated LLM summaries. |
| **Dated Evidence Required** | A current diagnosis is never used as proof of prior knowledge without dated documentary evidence and human confirmation. |
| **Sole Write Authority** | Express (`apps/api`) is the only service that writes to PostgreSQL. The Python AI service returns candidate findings only. |
| **Synthetic Data Only** | All identities, hospitals, policies, and claims are fictional. Real patient data never enters code, seeds, or logs. |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Core API | Express.js, TypeScript, Zod validation, structured JSON logging |
| Database | PostgreSQL 16 with `pgvector` extension, Prisma ORM |
| AI Service | FastAPI, Python, LangGraph, LangChain |
| LLM Provider | Google Gemini (structured generation, multimodal) |
| Vector Search | PostgreSQL `pgvector` — embeddings stored alongside relational data |
| Object Storage | S3-compatible (local: MinIO-compatible), for medical document storage |
| Job Queue | PostgreSQL-backed queue with `SKIP LOCKED`, lease expiry, and attempt fencing |
| Monorepo | npm workspaces |
| Local Infrastructure | Docker Compose |

---

## Architecture

```
Browser (Hospital Desk / Insurer Reviewer / Patient)
         │
         ▼
┌─────────────────────────────┐
│   Next.js  (apps/web)       │  Role-based portals
│   Hospital  │  Reviewer     │  Never touches DB directly
└──────┬──────────────────────┘
       │  REST API
       ▼
┌─────────────────────────────┐
│   Express API  (apps/api)   │  ◄── SOLE WRITE AUTHORITY
│   Auth · Claims · Docs      │
│   State Machine · Rules     │
└──────┬──────────────────────┘
       │              │
       ▼              ▼
┌────────────┐  ┌───────────────┐
│ PostgreSQL │  │ Object Storage│
│ + pgvector │  │ (documents)   │
└────────────┘  └───────────────┘
       ▲
       │  async job queue
       ▼
┌─────────────────────────────┐
│   FastAPI  (apps/ai)        │  Advisory only — no DB writes
│   LangGraph workflow        │
│   Gemini · RAG · Rules      │
└─────────────────────────────┘
```

---

## Repository Structure

```
aven/
├── apps/
│   ├── web/              # Next.js — Hospital & Reviewer portals
│   ├── api/              # Express — Core API and database write authority
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema (single source of truth)
│   │   │   ├── migrations/       # Versioned SQL migration history
│   │   │   └── seed.ts           # Idempotent demo data seed
│   │   └── src/
│   │       ├── config/           # Zod environment validation
│   │       ├── db/               # Prisma client singleton + lifecycle
│   │       ├── errors/           # Typed AppError hierarchy
│   │       ├── middleware/        # Request ID, logging, error handler
│   │       └── utils/            # Response envelope, logger
│   └── ai/               # FastAPI — Python AI analysis service
├── packages/
│   └── contracts/        # Shared TypeScript schemas and response types
├── infra/
│   └── docker-compose.yml  # Local PostgreSQL with pgvector
└── fixtures/
    └── synthetic/          # Synthetic demo documents (no real patient data)
```

---

## Local Setup

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Python 3.11+](https://www.python.org/) (for AI service)

### 1. Clone and install

```bash
git clone https://github.com/sameekshyaranjan/aven.git
cd aven
npm install
```

### 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and set:
#   JWT_SECRET  →  any random string of 32+ characters
```

### 3. Start the database

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 4. Run database migrations

```bash
cd apps/api
npx prisma migrate deploy
```

### 5. Seed demo data

```bash
npx tsx prisma/seed.ts
```

### 6. Start the API

```bash
npm run dev
```

The API will be available at **http://localhost:4000**.
Health check: **http://localhost:4000/health**

---

## Demo Accounts

All identities are completely fictional.

| Name | Email | Role | Organization |
|------|-------|------|-------------|
| Priya Sharma | admin@meridian-demo.aven | Admin | Meridian Health Assurance |
| Arjun Mehta | reviewer.arjun@meridian-demo.aven | Insurer Reviewer | Meridian Health Assurance |
| Kavya Nair | reviewer.kavya@meridian-demo.aven | Insurer Reviewer | Meridian Health Assurance |
| Rohan Desai | desk@citycare-demo.aven | Hospital Desk | City Care Hospital |
| Sneha Kulkarni | desk@metrogeneral-demo.aven | Hospital Desk | Metro General Hospital |
| Arun Verma | patient.arun@demo.aven | Patient | — |

---

## Implementation Progress

Aven is built through a disciplined stage-by-stage implementation roadmap. Each stage is a focused, atomic unit of functionality.

### ✅ Phase 1 — Repository & Architecture (Stages 001–010)
npm workspaces monorepo · strict `.gitignore` · code quality tooling (ESLint, Prettier, EditorConfig) · Docker Compose with `pgvector/pgvector:pg16` · Python FastAPI skeleton · local environment conventions

### ✅ Phase 2 — Express & PostgreSQL Foundation (Stages 011–020)
Express application factory · Helmet + CORS · `/health` endpoint · Zod fail-fast config validation · Request IDs (`X-Request-Id`) · nanosecond timing · privacy-preserving structured JSON logger (no request/response body logging) · Standard `{ data, meta, error }` API response envelope · Typed `AppError` hierarchy · centralized error middleware · Prisma ORM initialization · `pgvector` extension · fail-fast database lifecycle · `Hospital` + `User` + `UserRole` models · first database migration · idempotent demo seed

### 🔨 Phase 3 — Authentication & Authorization (Stages 021–030)
*In progress — shared contracts, demo login, JWT auth middleware, role guards, hospital row scoping*

### Upcoming Phases
- **Phase 4** — Policy models and versioned rules
- **Phase 5** — Claim intake and state machine
- **Phase 6** — Document storage and object storage integration
- **Phase 7** — Next.js hospital portal
- **Phase 8** — Reviewer workspace
- **Phase 9** — FastAPI AI service foundation
- **Phase 10** — Document extraction pipeline
- **Phase 11** — Policy RAG with pgvector
- **Phase 12** — Deterministic policy rule engine
- **Phase 13** — LangGraph orchestration
- **Phases 14–18** — Evidence validation, human-in-the-loop review, investigation assistant, letters, audit timeline

---

## Key Design Decisions

**Why PostgreSQL instead of MongoDB?**
Pre-authorization workflows require strict relational integrity: a claim must always link to a valid member, a valid policy version, and a valid hospital. Versioned migrations, foreign key constraints, and ACID transactions make PostgreSQL the right fit. `pgvector` keeps embeddings in the same database as relational data, avoiding a separate vector store.

**Why a separate AI service?**
LangGraph workflows are Python-native and benefit from Python's AI/ML ecosystem. Keeping the AI service separate enforces the architectural boundary: Express owns all writes and decisions; FastAPI returns candidate analysis results only. This boundary is non-negotiable.

**Why Prisma?**
Prisma provides type-safe database access, versioned migration history, and a schema that serves as a single source of truth for both the database structure and TypeScript types. Every schema change is a reviewable SQL file before it touches the database.

**Why no auto-generation for seed UUIDs?**
Fixed synthetic UUIDs (`a1000000-...` for organizations, `b1000000-...` for users) ensure every environment — local, CI, staging — gets identical primary keys. This keeps JWT test fixtures, frontend constants, and future seeds stable across database resets.

---

## License

[MIT](./LICENSE)

---

> **Demo disclaimer:** Aven is a portfolio project using entirely synthetic data. It is not affiliated with any real insurer, hospital, TPA, or regulatory body. No real patient data is processed.

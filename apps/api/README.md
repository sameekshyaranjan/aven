# apps/api

## Service Ownership & Responsibilities
- **Framework:** Express.js, TypeScript, Prisma ORM.
- **Role in Aven:** Core application backend, write authority, and business rule orchestration.
- **Architectural Boundary:**
  - Holds sole write authority over the primary PostgreSQL database.
  - Enforces role-based authorization and row-level hospital claim isolation.
  - Dispatches analysis jobs to the AI service (`apps/ai`) with attempt fencing, lease tokens, and claim revisions.
  - Receives AI candidate results, runs deterministic validation, and stores findings.
  - Manages asynchronous job queues, hospital notification escalations, and audit logging.
  - Handles immutable pre-authorization turnaround deadlines and financial authorization records.

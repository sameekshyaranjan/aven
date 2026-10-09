# apps/web

## Service Ownership & Responsibilities
- **Framework:** Next.js (App Router), TypeScript, React, Tailwind CSS / Vanilla CSS.
- **Role in Aven:** Client-facing web portal for hospital desks, insurer staff (reviewers and admins), and patient claim status tracking.
- **Architectural Boundary:**
  - Consumes the Express API (`apps/api`) as its primary backend and data source.
  - Implements role-based UI guards (hospital claims view, reviewer workspace, patient safe status).
  - Never accesses the database (`PostgreSQL`) directly.
  - Never calls the AI service (`apps/ai`) directly; all document uploads and AI triggers pass through the Express API.

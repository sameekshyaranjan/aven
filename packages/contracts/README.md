# packages/contracts

## Package Ownership & Responsibilities
- **Framework:** TypeScript, Zod, shared DTO types.
- **Role in Aven:** Shared API contracts, validation schemas, and common domain models.
- **Architectural Boundary:**
  - Shared between `apps/web` (Next.js frontend) and `apps/api` (Express backend).
  - Defines request and response envelopes (`{ data, meta, error }`), pre-authorization form schemas, claim status enums, document types, and finding data transfer objects (DTOs).
  - Ensures type-safety across client-server boundaries, preventing API drift and serialization bugs.

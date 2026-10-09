# infra

## Infrastructure Ownership & Responsibilities
- **Framework:** Docker Compose, PostgreSQL with `pgvector`, MinIO (S3-compatible object storage).
- **Role in Aven:** Local infrastructure setup, database bootstrapping, and containerized development services.
- **Architectural Boundary:**
  - Manages standalone database and object storage containers independently of application processes.
  - Houses compose files, seed provisioning scripts, and local networking configuration.
  - Ensures reliable local development mirroring cloud persistence topologies.

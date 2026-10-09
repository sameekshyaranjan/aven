# apps/ai — AI Advisory Service

## Service Ownership & Responsibilities
- **Framework:** FastAPI, Python 3.11+, LangChain, LangGraph, Pydantic.
- **Role in Aven:** Document processing, structured fact extraction, semantic clause retrieval (`pgvector`), and candidate pre-authorization analysis workflows.
- **Architectural Boundary:**
  - Stateless AI candidate generator; acts strictly as an advisory engine.
  - Ingests pre-authorization packets (forms, medical records) passed from `apps/api`.
  - Runs OCR, classifies documents, extracts clinical facts with page citations, and executes LangGraph analysis workflows.
  - Returns typed analysis candidates and rule traces to `apps/api`.
  - **Non-negotiable Safeguard:** Never writes directly to the primary PostgreSQL database, never mutates claim statuses, never commits monetary approvals, and never issues final claim decisions.

---

## Local Development & Virtual Environment Setup

### 1. Create a Python Virtual Environment
From the repository root or the `apps/ai` directory:

```powershell
# In PowerShell (Windows)
cd apps/ai
python -m venv .venv
```

### 2. Activate the Virtual Environment

```powershell
# In PowerShell (Windows)
.\.venv\Scripts\Activate.ps1

# In Bash / macOS / Linux
source .venv/bin/activate
```

### 3. Install Dependencies

You can install dependencies using either `pip` or editable package installation:

```powershell
# Standard installation
pip install -r requirements.txt

# Or editable install via pyproject.toml
pip install -e ".[dev]"
```

### 4. Configure Environment
Copy the `.env.example` file:

```powershell
Copy-Item ".env.example" ".env"
```

### 5. Run the FastAPI Development Server

```powershell
uvicorn main:app --reload --port 8000
```

- **API Documentation (Swagger UI):** `http://localhost:8000/docs`
- **Health Check Route:** `http://localhost:8000/health`

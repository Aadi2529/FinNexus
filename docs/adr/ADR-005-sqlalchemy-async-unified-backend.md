# ADR-005: Single Unified FastAPI Async Backend with AsyncPG and Psycopg Fallbacks

## Status
`ACCEPTED` (Implemented & Verified)

## Context
FinNexus features distinct functional domains: Identity Governance (Auth), Relational Workflows (CRM), Heavy I/O Document Manipulation (Toolkit), and Underwriting Logic (Insurance). 

Separating these domains into separate microservices would introduce distributed tracing complexity, multiple database instances, network serialization overhead, and difficult local developer onboarding. However, a single backend must handle both high-concurrency non-blocking database queries and synchronous or asynchronous CPU-bound document transformations without blocking the event loop.

## Decision
1. Implement a single FastAPI application with modular routers grouped under `app/api/` (`auth.py`, `crm.py`, `toolkit.py`, `insurance.py`, `health.py`).
2. Use **SQLAlchemy 2.0 Async** with `asyncpg` as the primary high-performance asynchronous PostgreSQL driver.
3. Configure `psycopg` (v3) as the synchronous driver for Alembic database migrations.
4. Use in-memory SQLite with `aiosqlite` for automated testing to achieve fast, isolated test execution without external infrastructure dependencies.
5. CPU-bound document operations (PyMuPDF/Pillow) run asynchronously or within thread pools to prevent blocking ASGI worker request processing.

## Consequences
### Positive
- Single database schema migration history managed via Alembic.
- Easy local onboarding (single command `python -m uvicorn app.main:app --port 8000`).
- Test suite runs in under 90 seconds using ephemeral in-memory SQLite sessions.
- High connection pooling efficiency.

### Negative
- CPU-intensive document processing operations can impact API responsiveness if not scaled horizontally under high concurrent load.

## Evidence
- [`backend/app/main.py`](../../backend/app/main.py): Single FastAPI app with lifespan hooks and router mounts.
- [`backend/app/db/session.py`](../../backend/app/db/session.py): Async engine and sessionmaker configuration.
- [`backend/alembic/env.py`](../../backend/alembic/env.py): Database migration environment.
- [`backend/tests/conftest.py`](../../backend/tests/conftest.py): In-memory SQLite async test fixture.

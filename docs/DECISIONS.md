# Architecture Decision Records (ADRs) — FinanceFlow

This document captures key architectural and technical decisions made during the design and development of FinanceFlow, structured according to the standard ADR format: Context, Decision, Rationale, and Consequences.

---

## ADR-001: Modular Monolith Architecture over Microservices

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Senior Software Architect

### Context
FinanceFlow is an industry-grade finance operations platform being developed within an intensive 14-day delivery cycle for a fourth-year capstone field project. The application encompasses identity, CRM, document vault, financial calculation engines, analytics, and audit logging.

### Decision
We select a **Modular Monolith** architecture pattern. Both backend (`app/modules/*`) and frontend (`src/pages/*`) will enforce clean domain boundaries within a unified repository and deployment package, avoiding distributed services.

### Rationale
- Distributed microservices introduce substantial operational tax (network serialization, eventual consistency, distributed tracing, orchestration tooling like Kubernetes, multi-repo CI) without delivering tangible benefits for an MVP.
- A modular monolith preserves ACID database transactions across critical customer and loan state mutations.
- Refactoring domain boundaries is dramatically faster in a single codebase.

### Consequences
- **Positive:** Single deployment target, trivial local debugging, zero distributed transaction overhead, fast developer onboarding.
- **Negative:** Requires rigorous internal discipline to prevent cross-module spaghetti imports.

---

## ADR-002: Frontend Framework & Language (React.js + JavaScript ES Modules)

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** React Engineer, Architect

### Context
The user explicitly specified the frontend stack: React.js, JavaScript (strict ES Modules; no TypeScript), Vite, React Router, and Tailwind CSS.

### Decision
We adopt **React 18+ with JavaScript (ES Modules)** bundled via **Vite**, adhering strictly to the constraint to not introduce TypeScript.

### Rationale
- Directly honors user requirements and constraints.
- Vite offers sub-second Hot Module Replacement (HMR) and optimized Rollup-based production builds.
- Standard modern ES modules (`import`/`export`, destructuring, optional chaining, nullish coalescing) provide high expressive power and rapid development velocity.

### Consequences
- **Positive:** Extremely rapid iteration speed, zero transpilation typing overhead, lightweight build steps.
- **Negative:** Runtime prop validation and component prop contracts must be verified through thorough unit tests and component documentation.

---

## ADR-003: Backend Framework (FastAPI + Pydantic v2 + SQLAlchemy 2.0)

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Backend Engineer, Architect

### Context
The platform requires an asynchronous, high-performance Python backend capable of enforcing strict request schema validation, generating automatic OpenAPI specifications, and managing relational persistence.

### Decision
We select **FastAPI** coupled with **Pydantic v2** and **SQLAlchemy 2.x** (modern 2.0 declarative style with async engine support).

### Rationale
- FastAPI natively generates interactive Swagger/OpenAPI documentation (`/docs`), which is essential for project demonstrations and API contract validation.
- Pydantic v2 provides Rust-backed high-speed validation for all request and response payloads.
- SQLAlchemy 2.0 enforces clean separation between queries, models, and transactions, eliminating legacy 1.x session antipatterns.

### Consequences
- **Positive:** Type-hinted asynchronous controllers, auto-generated documentation, high concurrency performance, strict payload sanitization.
- **Negative:** Requires strict adherence to SQLAlchemy 2.0 select syntax (`select(Model).where(...)`) rather than legacy query methods.

---

## ADR-004: Styling & Design System (Tailwind CSS with Curated Financial Palette)

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** UI/UX Architect

### Context
A finance operations platform must look authoritative, clean, and premium. Generic or default UI looks amateurish and harms project evaluation.

### Decision
Use **Tailwind CSS** configured with a customized design token palette:
- Neutrals: Slate tones (`slate-900` background accents, `slate-800` cards, `slate-100` high-contrast text).
- Primary Brand: Deep Indigo (`indigo-600` to `indigo-700`).
- Semantic Financial Colors: Emerald (`emerald-500` for profits, approvals, verified status), Amber (`amber-500` for pending tasks, warnings), Rose (`rose-500` for rejections, liabilities, overdue tasks).

### Rationale
- Avoids large, heavy component libraries while maintaining full design system flexibility.
- High developer ergonomics with utility classes for responsive layouts and animations.

### Consequences
- **Positive:** Zero CSS runtime overhead, fully custom cohesive design language, responsive out of the box.
- **Negative:** Class name verbosity in JSX, mitigated by extracting reusable component primitives.

---

## ADR-005: Relational Persistence & Migration Governance (PostgreSQL + Alembic)

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Database Engineer

### Context
Financial operations mandate strict ACID compliance, referential integrity, and verifiable, reproducible database schema migrations.

### Decision
Use **PostgreSQL 16+** as the database engine and **Alembic** as the sole schema migration mechanism. Calling `Base.metadata.create_all()` in production or CI environments is strictly prohibited.

### Rationale
- PostgreSQL is the gold standard for financial data, offering JSONB support for audit deltas, strict foreign key constraints, and robust indexing.
- Alembic migration scripts allow tracking, upgrading, and rolling back schema alterations cleanly across all developer workstations and staging instances.

### Consequences
- **Positive:** 100% reproducible schemas, zero unrecorded database mutations, safe reversible rollbacks.
- **Negative:** Developers must write or inspect migration scripts for every model change.

---

## ADR-006: Comprehensive Quality Assurance Strategy (Pytest, RTL, Playwright)

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** QA Engineer

### Context
The project must guarantee reliable operation across all levels: mathematical formulas, API endpoints, database queries, and browser user flows.

### Decision
Implement a three-layer automated testing strategy:
1. Pytest for backend unit math, schema validation, and API integration.
2. React Testing Library for frontend component isolation and hook testing.
3. Playwright for end-to-end browser smoke and regression testing.

### Rationale
- Financial calculations (EMI, amortization, SIP) require zero margin of error; unit tests guarantee numerical precision.
- E2E tests verify that authentication, CORS, token handling, and multi-step forms work seamlessly in real browser environments.

### Consequences
- **Positive:** High confidence in platform stability; verified test metrics for project evaluation.
- **Negative:** Slightly increased execution time in CI pipelines.

---

## ADR-007: Deferral of AI Document Processing until Core Operations Platform is Proven

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Senior Software Architect

### Context
The product scope mentions future AI document extraction and classification. However, AI models require stable underlying storage, access control, and metadata schemas.

### Decision
Explicitly defer all AI/OCR document features until Phases 1 through 7 (core platform, CRM, document vault, calculation engine, audit logging) are fully implemented and verified with tests.

### Rationale
- Integrating OCR or computer-vision models prematurely risks derailing the project timeline if foundational security and storage layers are unstable.
- A college capstone project receives highest marks when the core system is rock-solid and enterprise-ready before advanced features are added.

### Consequences
- **Positive:** Guarantees timely delivery of the core financial operations system.
- **Negative:** AI features will be evaluated as post-MVP enhancements.

---

## ADR-008: In-Memory Token Blacklist & Session Revocation via Redis

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Backend Engineer, Security Engineer

### Context
Stateless JWT tokens cannot be revoked prior to their natural expiration time without a centralized tracking mechanism. For a financial application, immediate logout and session termination are mandatory security controls.

### Decision
Use **Redis** as a high-speed, volatile cache to blacklist revoked JWT token IDs (`jti`) and manage rate-limiting counters.

### Rationale
- Checking PostgreSQL on every authenticated API call would introduce unnecessary database query overhead.
- Redis provides sub-millisecond in-memory lookups and automatic key expiration (`TTL`) matching the 15-minute token lifetime.

### Consequences
- **Positive:** Instantaneous token revocation on logout with zero degradation of database throughput.
- **Negative:** Requires Redis service to be running alongside the backend. Local dev will provide a graceful fallback to an in-memory dictionary if Redis is offline during local offline unit testing.

---

## ADR-009: Composite Primary Key on UserRole Entity

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Database Engineer, Senior Software Architect

### Context
In RBAC architectures, a user can have multiple roles. Without an enforced constraint, concurrent requests or administrative actions could result in duplicate user-role records, corrupting token payload generation and permission queries.

### Decision
Model `user_roles` using a composite primary key consisting of `(user_id, role_id)`.

### Rationale
- Enforces uniqueness at the physical database storage layer without requiring a synthetic surrogate UUID key.
- Eliminates overhead of maintaining redundant surrogate indexes.
- Supported seamlessly across PostgreSQL and SQLite test engines.

### Consequences
- **Positive:** Zero possibility of duplicate role mappings for a user.
- **Negative:** Composite key joins must be used in raw queries, handled automatically by SQLAlchemy ORM relationships.

---

## ADR-010: Restrictive Deletion Policies on Author and Actor Foreign Keys

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Database Engineer, Security Engineer

### Context
In financial platforms, notes, audit trails, and tasks represent legal and operational history. If a staff user account is removed, standard cascading deletes would silently destroy customer interaction notes, task assignments, and audit trails.

### Decision
1. For `customer_notes.author_id` and `tasks.assigned_to_id`, enforce `ON DELETE RESTRICT`. A staff account cannot be physically deleted while referenced by active interaction notes or operational tasks.
2. For `audit_logs.actor_id` and `documents.verified_by_id`, enforce `ON DELETE SET NULL`. The audit log and document verification record are permanently preserved even if the staff user is archived or purged.

### Rationale
- Complies with financial compliance rules regarding immutable operational history.
- Prevents silent data loss.

### Consequences
- **Positive:** Guaranteed preservation of compliance audit logs and customer interaction history.
- **Negative:** User accounts must be soft-deleted or deactivated (`is_active = False`) rather than deleted by hard CASCADE.

---

## ADR-011: Database-Level Check Constraints for Numerical Financial Soundness

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Database Engineer, QA Engineer

### Context
Application-layer validation (via Pydantic) can protect against API-level malformed payloads, but direct database access, data migrations, or scripts could introduce invalid financial data (e.g. negative monthly incomes or impossible CIBIL bureau scores).

### Decision
Embed explicit database check constraints on financial and document tables:
- `chk_financial_profiles_monthly_income_positive`: `monthly_income >= 0`
- `chk_financial_profiles_monthly_obligations_positive`: `monthly_obligations >= 0`
- `chk_financial_profiles_cibil_score_range`: `cibil_score IS NULL OR (cibil_score >= 300 AND cibil_score <= 900)`
- `chk_documents_file_size_positive`: `file_size_bytes > 0`

### Rationale
- Defense-in-depth: guarantees financial invariants at the persistence layer.
- Enforced on all database writes, regardless of whether they originate from API controllers, migrations, or batch jobs.

### Consequences
- **Positive:** Uncompromised data integrity.
- **Negative:** Database errors will be raised if invalid data is attempted; requires service layer to catch and wrap `IntegrityError`.


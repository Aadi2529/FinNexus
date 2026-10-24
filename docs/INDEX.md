# FinNexus Enterprise Software Documentation Index

Welcome to the central technical documentation library for **FinNexus**, the unified financial operations platform.

---

## 1. Complete Documentation Library

| # | Document | Primary Scope | Target Audience |
|---|---|---|---|
| **01** | [`01-project-overview.md`](./01-project-overview.md) | Project purpose, problem statement, target personas, functional requirements (FR), non-functional requirements (NFR), and scope boundaries. | Product Managers, All Developers |
| **02** | [`02-architecture.md`](./02-architecture.md) | High-Level Design (HLD), monorepo topology, micro-frontend SPAs, FastAPI backend, request lifecycle, and deployment architecture. | Architects, Senior Engineers |
| **03** | [`03-folder-structure.md`](./03-folder-structure.md) | Repository tree, directory roles, file inventory, entry points, and "Where to Make a Change" guide. | New Developers, Contributors |
| **04** | [`04-functions-reference.md`](./04-functions-reference.md) | Technical reference of critical functions, classes, signatures, parameters, database mutations, and test mappings. | Full-Stack & Backend Developers |
| **05** | [`05-feature-flows.md`](./05-feature-flows.md) | End-to-end technical flows for SSO, Customer 360, Work Order lifecycle, checklist drag-and-drop reordering, and document auto-cropping. | Frontend & Backend Engineers |
| **06** | [`06-database-schema.md`](./06-database-schema.md) | Database design, 16 tables, columns, constraints, foreign key cascades, check constraints, Alembic migrations, and ER diagrams. | Database Architects, Backend Engineers |
| **07** | [`07-api-reference.md`](./07-api-reference.md) | Complete REST API specification for `/auth`, `/crm`, `/clients`, `/work-orders`, `/toolkit`, `/insurance`, and `/health` endpoints. | Frontend Engineers, API Consumers |
| **08** | [`08-auth-rbac-security.md`](./08-auth-rbac-security.md) | Dual-token authentication, Redis JTI blacklisting, RBAC matrix, resource isolation, password hashing, and security testing. | Security Engineers, Tech Leads |
| **09** | [`09-testing.md`](./09-testing.md) | In-memory SQLite testing strategy, test suites inventory, verified execution results, and test gap analysis. | QA Engineers, All Developers |
| **10** | [`10-setup-troubleshooting.md`](./10-setup-troubleshooting.md) | Environment configuration (`.env`), step-by-step setup, Docker Compose, concurrent development startup, and verified solutions. | DevOps, All Developers |
| **11** | [`11-developer-guide.md`](./11-developer-guide.md) | Developer onboarding guide, code navigation, feature implementation workflows, and pull request checklist. | New Team Members |
| **12** | [`12-glossary.md`](./12-glossary.md) | Indian financial terminology (Aadhaar, PAN, CIBIL, FOIR, MFU, CAN), operational terms, and technical definitions. | All Stakeholders |

---

## 2. Specialized Documentation Directories

### 2.1 Architecture & Workflow Diagrams
- **Location**: [`docs/diagrams/`](./diagrams/)
- Contains standalone, editable [Mermaid](https://mermaid.js.org/) diagrams:
  - [`01-system-context-architecture.mmd`](./diagrams/01-system-context-architecture.mmd): Monorepo topology and component relationships.
  - [`02-authentication-sso-flow.mmd`](./diagrams/02-authentication-sso-flow.mmd): Dual-token issuance, rotation, and revocation.
  - [`03-work-order-lifecycle.mmd`](./diagrams/03-work-order-lifecycle.mmd): State machine, checklist gates, and supervisor overrides.
  - [`04-database-entity-relationship.mmd`](./diagrams/04-database-entity-relationship.mmd): Complete 16-table ER diagram.
  - [`05-document-processing-pipeline.mmd`](./diagrams/05-document-processing-pipeline.mmd): High-speed identity card auto-crop pipeline.
  - Explanatory guide: [`docs/diagrams/README.md`](./diagrams/README.md).

### 2.2 Architecture Decision Records (ADR)
- **Location**: [`docs/adr/`](./adr/)
- Documents verified architectural choices following the Nygard template:
  - [`ADR-001`](./adr/ADR-001-monorepo-multi-spa-architecture.md): Monorepo structure with 4 independent SPAs and shared backend.
  - [`ADR-002`](./adr/ADR-002-dual-token-auth-redis-blacklist.md): Dual-token auth with SHA-256 refresh tokens and Redis JTI revocation.
  - [`ADR-003`](./adr/ADR-003-json-checklist-template-storage.md): JSON column storage with position normalization for category templates.
  - [`ADR-004`](./adr/ADR-004-fixed-ratio-card-cropping.md): Fixed geometric aspect-ratio cropping for identity cards.
  - [`ADR-005`](./adr/ADR-005-sqlalchemy-async-unified-backend.md): Single unified FastAPI async backend with asyncpg.
  - ADR Index & guide: [`docs/adr/README.md`](./adr/README.md).

---

## 3. Quick Reference for Developers

- **Start all frontend apps**: `npm run dev` in repository root.
- **Start backend server**: `uvicorn app.main:app --port 8000 --reload` in `backend/`.
- **Run automated test suite**: `pytest backend/tests/test_category_checklist_reordering.py backend/tests/test_crm_rbac.py` in `backend/`.
- **Compile production build**: `npm run build:crm` in repository root.
- **API Documentation**: Open `http://localhost:8000/docs` while backend is running.

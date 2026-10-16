# Changelog — FinanceFlow

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.0] - 2026-10-15 — CRM Module Complete Backend + Frontend Integration

### Added
- **Database Schema Extensions & Alembic Migration `7d1ebff65b16` (`backend/`):**
  - Added `reference_source`, `is_archived`, `archived_at`, `created_by_id`, and `created_by` relationship to `Customer` model.
  - Resolved multiple-foreign-key ambiguity in `User.assigned_customers` using explicit `foreign_keys`.
  - Added Alembic migration revision `7d1ebff65b16_add_client_archival_and_manager_role.py` with offline SQL generation support.
- **Canonical 4-Role RBAC & Super Admin Invariant Defense:**
  - Standardized active roles to `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`, deprecating legacy loan officer/underwriter roles from active assignment.
  - Implemented `assert_not_last_super_admin` in `backend/app/core/dependencies.py` to prevent deactivating, demoting, or removing the last active Super Admin account.
- **Client Archival, Restore & Audit Trail:**
  - Added `POST /api/v1/clients/{id}/archive` and `POST /api/v1/clients/{id}/restore` with `AuditLog` records.
  - Added `GET /api/v1/clients/{id}/history` and `GET /api/v1/clients/{id}/work-orders`.
  - Added `GET /api/v1/clients/summary` calculating real dynamic metrics from PostgreSQL without fabricated stats.
  - Added strictly 10-digit Indian mobile validation with `+91` normalization.
- **Work Orders & Task Pipeline:**
  - Added debounced client autocomplete suggestions `GET /api/v1/clients/search`.
  - Added transactional inline client registration with duplicate client reuse on PAN/email.
  - Added `POST /api/v1/work-orders/{id}/assignments` and `GET /api/v1/users/eligible-assignees`.
  - Added derived progress percentage calculation on checklist items.
- **Frontend Polish & Integration:**
  - Connected 4 dynamic summary cards in `ClientsPage.jsx`.
  - Added Active vs Archived filter toggle and client history timeline modal.
  - Integrated client autocomplete search and inline registration in `WorkOrderFormPage.jsx`.
  - Updated Settings RBAC matrix to canonical 4 roles.
- **Automated Integration Test Suite (`backend/tests/test_crm_module_integration.py`):**
  - 7 comprehensive tests covering mobile normalization, direct endpoints, archival, duplicate client reuse, assignment RBAC, progress derivation, and Super Admin invariant defense.

---

## [0.7.0] - 2026-10-15 — CRM Client Management & Unified SSO Authentication

### Added
- **CRM Client Management System (`backend/app/api/crm.py`, `backend/app/schemas/crm.py`, `crm/src/pages/ClientsPage.jsx`):**
  - Full client CRUD lifecycle integrated with PostgreSQL through SQLAlchemy.
  - Multi-field search querying first name, last name, concatenated full name, phone number, email, and PAN.
  - Server-side pagination with both structured envelope response (`items`, `pagination`) and backward-compatible flat list with pagination headers (`X-Total-Count`, `X-Total-Pages`, `X-Current-Page`, `X-Page-Size`).
  - Active work orders count linkage aggregating live orders (`PENDING`, `IN_PROGRESS`, `REVIEW`) per client directly from the database without fabricated statistics.
  - Client creation (`POST /crm/clients`) with strict frontend and backend validation for phone (+91 / E.164), email format, and unique PAN.
  - Client update (`PUT /crm/clients/{id}`) supporting contact modifications, pipeline status changes, and duplicate conflict avoidance against own records.
  - Safe client deletion (`DELETE /crm/clients/{id}`) with dependency-aware retention checks: blocks deletion (HTTP 400) if associated `WorkOrder` records or active `Task` records exist; allows deletion only for unencumbered clients by Admins/Super Admins.
  - Client-level CSV data export of real authorized client records.
- **Unified Cross-Subdomain SSO & Route Protection (`dashboard/`, `crm/`, `toolkit/`, `insurance-engine/`):**
  - Centralized login on `dashboard` (`/login`) with strict open-redirect protection via domain/port allowlist (`localhost:5173-5176`, `127.0.0.1`, `*.financeflow.com`).
  - Cross-module SSO token handoff via sanitized query parameters (`sso_token`, `refresh_token`), automatically ingested by target application route guards into localStorage and cleansed from the browser address bar.
  - Automated `ProtectedRoute` components in all four frontends redirecting unauthenticated users to `${APP_URLS.dashboard}/login?redirect=<target_url>` with loading states and role-based access denial views.
  - Cross-module single logout clearing stored sessions across all apps and revoking refresh tokens on backend.
  - Fixed API response unwrapping in `crm/src/services/api.js`, `toolkit/src/services/api.js`, and `insurance-engine/src/services/api.js` ensuring `res.ok` and data envelopes align across all frontend calculations and tables.
- **Automated Verification Test Suite (`backend/tests/test_crm_clients.py`):**
  - 15 comprehensive automated test scenarios verifying client creation, persistence, updating, conflict checks, work order dependency retention blocking, unencumbered deletion, employee deletion prevention (HTTP 403), unauthenticated access blocking (HTTP 401), search and pagination, active work order count accuracy, and work order preservation post-update.

---

## [0.6.0] - 2026-10-15 — CRM Phase 2: RBAC & Work Order Permission Hardening

### Added
- **Automated Security & RBAC Test Suite (`backend/tests/test_crm_rbac.py`):**
  - 15 comprehensive automated test scenarios verifying:
    1. Unauthenticated requests blocked across all protected CRM endpoints (HTTP 401).
    2. Super Admin system-wide authority over all work orders and operations.
    3. Admin management capabilities (queue view, attribute update, history access).
    4. Employee work order creation with automatic author attribution.
    5. Employee edit rejection on work orders after creation (HTTP 403).
    6. Employee delete and archive rejection (HTTP 403).
    7. Employee reassignment rejection (HTTP 403).
    8. Employee milestone execution and progress recalculation.
    9. Cross-employee access denial preventing IDOR and unauthorized snooping (HTTP 403).
    10. Privilege escalation defense preventing employees from modifying roles or creating Admins, and enforcing Super Admin-only creation of Admin accounts (HTTP 403).
    11. Unauthorized completion override rejection for non-supervisors (HTTP 403).
    12. Authorized supervisor override enforcement with mandatory non-empty justification and append-only audit trail logging.
    13. Cross-user notification and global task history protection (HTTP 403).
    14. Field allowlist enforcement blocking unauthorized structural modifications (HTTP 403).
    15. Scoped employee dashboard metrics and organizational admin metrics regression.

### Changed
- **CRM Frontend Permission-Aware Hardening (`crm/src/`):**
  - `DashboardPage.jsx`: Integrated `useAuth`, guarded supervisor completion override against unauthorized employee bypass, and restricted `CANCELLED` status option exclusively to administrators.
  - `SettingsPage.jsx`: Aligned Role-Based Capabilities matrix to reflect Super Admin, Admin, Loan Officer, Underwriter, and Employee capabilities accurately, dynamically displaying active primary role.
  - `TopHeader.jsx`: Enhanced user profile menu and button to dynamically display `primaryRole` (`SUPER_ADMIN`, `ADMIN`, `EMPLOYEE`).
  - `test_migrations.py`: Updated revision discovery test to verify both initial schema baseline (`fad623e5f3cb`) and current work order head (`6c0faee54a05`).

---

## [0.5.0] - 2026-10-15 — CRM Module: Enterprise Work Order & Employee Task Management System

### Added
- **Codebase Audit & Architecture Strategy:**
  - Audited monorepo, ports, and schema documented in [`docs/CRM_CODEBASE_AUDIT.md`](./CRM_CODEBASE_AUDIT.md).
  - Detailed module specification in [`docs/implementation/CRM_WORK_ORDER_MODULE.md`](./implementation/CRM_WORK_ORDER_MODULE.md).
- **Relational Database Models (`backend/app/db/models/crm.py`):**
  - `WorkCategory`: Catalog of operational categories with JSON checklist templates, default priority, and deletion protection.
  - `WorkOrder`: Core work order entity with sequential reference formatting (`WO-YYYY-NNNN`), priority, status, progress percentage, and timestamps.
  - `WorkOrderChecklistItem`: Granular action milestones with individual status (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`), completed timestamps, completing user reference, and notes.
  - `WorkOrderHistory`: Append-only audit trail logging all lifecycle events, status changes, and reassignment records.
  - `CrmNotification`: In-app notification alerts for task assignments, reassignments, and deadline notifications.
- **Alembic Database Migration:**
  - Generated and executed migration [`20261014_1840_6c0faee54a05_add_crm_work_order_module.py`](../backend/alembic/versions/20261014_1840_6c0faee54a05_add_crm_work_order_module.py) applying clean upgrades to PostgreSQL 18.
- **Pydantic v2 API Schemas (`backend/app/schemas/crm.py`):**
  - Schemas for work orders, checklist milestones, audit history, categories, team workload summaries, and executive dashboard metrics.
- **FastAPI Endpoints (`backend/app/api/crm.py`):**
  - `GET /crm/dashboard`: Executive metrics aggregation (active workload, priority actions, critical delays, resolved today, client counts).
  - `GET /crm/work-orders`: Paginated search, category/priority/assignee filtering, and employee `my_tasks` filtering.
  - `POST /crm/work-orders`: Multi-section creation with automatic checklist generation from category template.
  - `GET /crm/work-orders/{id}`: 360 detail view with checklist pipeline and chronological audit history.
  - `PUT /crm/work-orders/{id}`: Update metadata, reassign specialists with automatic notification dispatch.
  - `PATCH /crm/work-orders/{id}/status`: Status transition with **Completion Guard** (blocks incomplete orders unless an explicit override reason is provided).
  - `DELETE /crm/work-orders/{id}`: Archive with audit logging.
  - `POST /crm/work-orders/{id}/checklist`: Add checklist items with automatic progress percentage recalibration.
  - `PATCH /crm/work-orders/{id}/checklist/{item_id}`: Milestone completion toggle with progress recalculation.
  - `GET /crm/team`: Employee roster with active and completed workload metrics.
  - `GET /crm/notifications`: User notifications with single and bulk mark-as-read endpoints.
  - `GET /crm/categories`: Catalog CRUD with reference deletion protection.
- **Presentation Layer & UI Redesign (`crm/src/`):**
  - Navy, slate, and teal design system with accessible contrast, typography, and responsive grid layouts.
  - Collapsible enterprise sidebar (`Sidebar.jsx`) with live unread badge, active route indicators, and quick creation action.
  - Enhanced top header (`TopHeader.jsx`) with dynamic breadcrumbs, global search, notifications popover, cross-app switcher, and profile dropdown.
  - 10 functional views in `crm/src/pages/`:
    - `DashboardPage.jsx`: Executive KPI cards, category breakdown, urgent queue, and expandable recent orders table.
    - `WorkOrdersPage.jsx`: Filter tabs (All, Active, Urgent, Review, Completed, Overdue), search, category/priority/assignee filters, sort, and safe CSV export.
    - `MyTasksPage.jsx`: Employee workbench with embedded interactive checklist milestones.
    - `WorkOrderFormPage.jsx`: Sectioned creation and editing form with dynamic category template loader.
    - `WorkOrderDetailPage.jsx`: 360 view with interactive checklist pipeline, note editing, and audit history.
    - `TaskHistoryPage.jsx`: Searchable system-wide compliance audit trail.
    - `ClientsPage.jsx`: Client directory with CIBIL score ratings and quick order creation.
    - `TeamPage.jsx`: Staff roster with workload capacity indicators.
    - `CategoriesPage.jsx`: Category and checklist template builder.
    - `NotificationsPage.jsx`: In-app alert center with unread filtering.
    - `SettingsPage.jsx`: Operational SLA defaults, RBAC matrix, and platform diagnostics.
- **Automated Tests:**
  - 6 new automated tests in [`backend/tests/test_crm_work_orders.py`](../backend/tests/test_crm_work_orders.py) with 100% pass rate.
  - Production frontend build `npm run build:crm` verified in 3.25s.

---

## [0.4.0] - 2026-10-14 — Unified Enterprise Platform (Shared Auth, Dashboard, CRM, Toolkit, Insurance)

### Added
- **Shared Authentication & RBAC Governance:**
  - Dual-token JWT architecture (15-min access token + 7-day refresh token) signed with `HS256`.
  - Argon2id password hashing (`time_cost=3`, `memory_cost=64MB`) with constant-time verification.
  - One-time refresh token rotation with replay detection.
  - Dual-tier token blacklist store (Redis with resilient in-memory fallback).
  - FastAPI server-side RBAC dependencies (`get_current_user`, `require_roles`).
  - Auth endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/register`.
- **Enterprise Frontend Architecture:**
  - Two-panel responsive login experience (`LoginPage.jsx`) matching enterprise design reference with demo accounts prefill.
  - Unified authenticated shell (`AppShell.jsx`, `TopNavigation.jsx`) with dynamic local-time greeting, notifications popover, and profile dropdown.
  - Protected route guard (`ProtectedRoute.jsx`) with automatic redirect to `/login` and role validation.
- **Central Dashboard Hub (`DashboardPage.jsx`):**
  - Live operational metrics strip (Active Clients, Pending Tasks, Active Policies, FastAPI Connectivity).
  - Three distinct primary application cards navigating directly to CRM, Toolkit, and Insurance.
- **FinanceFlow CRM Module (`CRMPage.jsx`):**
  - Search, status filtering, and pagination.
  - Customer 360 Drawer with CIBIL score ratings, monthly income/obligations, timeline notes, and follow-up tasks.
  - New Customer modal connected to `POST /api/v1/crm/customers`.
- **FinanceFlow Toolkit Module (`ToolkitPage.jsx`):**
  - Reducing balance loan EMI calculator with Python Decimal precision and 12-month amortization schedule.
  - Systematic Investment Plan (SIP) compound wealth planner with year-by-year projections.
  - Statutory Indian PAN syntax validator and entity classifier.
  - Cryptographic document vault with magic-byte MIME validation (PDF, PNG, JPEG) and SHA-256 integrity hash.
- **Insurance Engine Module (`InsurancePage.jsx`):**
  - Product catalog (Term Life, Comprehensive Health, Motor Vehicle, Commercial Property).
  - Interactive risk-adjusted quotation calculator with age, smoker (+35%), and medical (+25%) loadings.
  - Policy management table with expiration tracking and 1-year renewal actions.
- **Automated Test Suite:**
  - 17 new end-to-end tests in [`backend/tests/test_enterprise_platform.py`](file:///D:/project/backend/tests/test_enterprise_platform.py) bringing test suite to 36 passed, 1 skipped.

---

## [0.3.0] - 2026-10-14 — Phase 2: Database Schema, SQLAlchemy 2.x Models & Alembic Baseline Migrations

### Added
- **SQLAlchemy 2.x Declarative Models (`backend/app/db/models/`):**
  - `User`, `Role`, `UserRole`, `RefreshToken` in [`backend/app/db/models/auth.py`](file:///d:/project/backend/app/db/models/auth.py).
  - `Customer`, `FinancialProfile`, `CustomerNote`, `Task` in [`backend/app/db/models/crm.py`](file:///d:/project/backend/app/db/models/crm.py).
  - `Document` in [`backend/app/db/models/documents.py`](file:///d:/project/backend/app/db/models/documents.py).
  - `AuditLog` in [`backend/app/db/models/audit.py`](file:///d:/project/backend/app/db/models/audit.py).
  - Central model registry in [`backend/app/db/models/__init__.py`](file:///d:/project/backend/app/db/models/__init__.py).
- **Data Integrity & Security Constraints:**
  - `user_roles` composite primary key prevents duplicate role assignments.
  - `financial_profiles` check constraints enforce non-negative income/obligations and CIBIL range (300-900).
  - `documents` check constraint enforces positive file byte counts.
  - Deletion safeguards: `ON DELETE RESTRICT` for note authors and task assignees; `ON DELETE SET NULL` for audit logs and document verifiers.
- **Alembic Baseline Migration:**
  - Migration script [`backend/alembic/versions/20261014_1633_fad623e5f3cb_initial_schema.py`](file:///d:/project/backend/alembic/versions/20261014_1633_fad623e5f3cb_initial_schema.py).
  - Tested and verified offline SQL generation (`alembic upgrade --sql base:head` and `alembic downgrade --sql head:base`) covering all 10 tables, 17 indexes, and 4 check constraints.
- **Automated Test Suites:**
  - [`backend/tests/test_database_models.py`](file:///d:/project/backend/tests/test_database_models.py) (8 unit tests covering metadata, column types, constraints, and relationships).
  - [`backend/tests/test_migrations.py`](file:///d:/project/backend/tests/test_migrations.py) (3 tests covering revision discovery, offline SQL generation, and disposable PostgreSQL integration).
  - Test suite status: 18 passed, 1 skipped (live PostgreSQL host auth).


## [0.2.0] - 2026-10-14 — Phase 1: Backend, Frontend, Database Infrastructure and CI Foundation

### Added
- **FastAPI Backend Application:**
  - Application factory in `backend/app/main.py` with explicit CORS origins, lifespan handlers, and OpenAPI metadata.
  - Configuration loader in `backend/app/core/config.py` using Pydantic Settings and `.env.example`.
  - SQLAlchemy 2.x async engine, sessionmaker, and non-destructive connection health probe in `backend/app/db/session.py`.
  - Redis asynchronous client and ping probe in `backend/app/core/redis.py`.
  - API router consolidation in `backend/app/api/router.py` mounted at `/api/v1`.
  - Root endpoint (`GET /`), liveness probe (`GET /api/v1/health/live`), readiness probe (`GET /api/v1/health/ready`), and comprehensive health endpoint (`GET /api/v1/health`) in `backend/app/api/health.py`.
  - Automated Pytest test suite in `backend/tests/test_health.py` covering root, liveness, mocked readiness (healthy, DB failure, Redis failure), and CORS headers (8/8 tests passed).
  - Code quality configuration in `backend/pyproject.toml` targeting Ruff (100% clean check and format).
  - Database migration configuration in `backend/alembic.ini` and `backend/alembic/env.py` wired to `Base.metadata`.
- **React + Vite Frontend Application:**
  - Modern React 18+ application scaffolded in `frontend/` using JavaScript ES Modules (no TypeScript).
  - Responsive financial SaaS shell in `frontend/src/layouts/AppLayout.jsx` with mobile drawer and live API status pill.
  - Interactive workspace dashboard in `frontend/src/pages/WorkspacePage.jsx` displaying real-time ASGI liveness, PostgreSQL readiness, and Redis readiness probes with zero fabricated metrics.
  - Reusable HTTP client in `frontend/src/services/api.js` with error normalization and offline handling.
  - Router integration in `frontend/src/App.jsx` with placeholders for Customers, Documents, and Finance Toolkit.
  - Tailored Tailwind CSS design system in `frontend/tailwind.config.js` and `frontend/src/index.css`.
  - Production Vite bundle verified (`npm run build` succeeds cleanly in ~2 seconds).
- **Infrastructure & Containerization:**
  - `docker-compose.yml` orchestrating PostgreSQL 16 Alpine, Redis 7 Alpine, FastAPI backend, and React frontend with health checks.
  - Development Dockerfiles: `backend/Dockerfile.backend` (Python 3.12-slim) and `frontend/Dockerfile.frontend` (Node 20-alpine).
  - GitHub Actions CI workflow in `.github/workflows/ci.yml` running Python 3.12 Ruff checks, Pytest, and Node 20 frontend builds.

---

## [0.1.0] - 2026-10-14 — Phase 0: Project Initialization


### Added
- Comprehensive engineering documentation system under `docs/`:
  - `PROJECT_OVERVIEW.md`: Mission, business context, user personas, and executive scope boundaries.
  - `REQUIREMENTS.md`: Detailed functional (FR-01 to FR-08) and non-functional (NFR-01 to NFR-07) specifications.
  - `ARCHITECTURE.md`: Modular monolith design, tier boundaries, and system diagrams.
  - `IMPLEMENTATION_PLAN.md`: 14-day phased MVP roadmap with formal completion gates.
  - `DATABASE_DESIGN.md`: PostgreSQL schema specification, ER diagram, index strategy, and Alembic protocol.
  - `API_DESIGN.md`: RESTful conventions, unified response envelopes, and complete endpoint catalog.
  - `SECURITY_STANDARDS.md`: Dual-token JWT auth, Redis revocation, RBAC matrix, and file security policies.
  - `TESTING_STRATEGY.md`: Test pyramid, Pytest, React Testing Library, and Playwright specifications.
  - `DECISIONS.md`: Initial Architecture Decision Records (ADR-001 through ADR-007).
  - `DEVELOPMENT_STATUS.md`: Active tracking matrix, risk register, and verified environment capabilities.
  - `docs/implementation/PHASE_0_INITIALIZATION.md`: Exhaustive phase execution record.
- Root project files:
  - `README.md`: Central documentation hub, tech stack summary, and quick navigation.
  - `.gitignore`: Industry-standard ignore rules for Python, Node, Vite, test coverage, and environment files.
- Git repository initialization and baseline tracking.

### Verified
- Host development environment: Python 3.14.8, Node v24.21.0, npm 11.19.0, Git 2.56.0.
- Workspace verified clean prior to scaffolding.

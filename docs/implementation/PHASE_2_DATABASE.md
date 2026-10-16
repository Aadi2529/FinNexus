# Phase 2 Implementation Record: Database Schema, SQLAlchemy 2.x Models & Alembic Migrations

**Phase:** Phase 2 — Database Schema, SQLAlchemy 2.x Models & Alembic Migrations  
**Status:** Successfully Completed & Verified  
**Execution Date:** 2026-10-14  
**Engineer Roles:** Senior Database Engineer, Python Backend Engineer, QA Engineer, Security Architect, Technical Documentation Engineer  

---

## 1. Phase Objective & Scope

The objective of Phase 2 is to establish the production-grade relational database foundation for FinanceFlow in `D:\project`. This involves implementing strict SQLAlchemy 2.x declarative models, establishing Alembic database migration governance, enforcing database-level integrity and security constraints, and providing comprehensive automated verification suites without prematurely implementing authentication endpoints, CRM business APIs, or frontend features.

### Scope for this Phase
- Implement 10 core domain models using modern SQLAlchemy 2.0 declarative mapping (`Mapped`, `mapped_column`, `relationship`, `CheckConstraint`, `Index`, `ForeignKey`).
- Cover Identity & Access (`User`, `Role`, `UserRole`, `RefreshToken`), Finance CRM (`Customer`, `FinancialProfile`, `CustomerNote`, `Task`), Document Vault (`Document`), and Compliance (`AuditLog`).
- Enforce explicit primary keys, foreign key deletion policies (`CASCADE`, `SET NULL`, `RESTRICT`), unique constraints, and check constraints at the database level.
- Guarantee financial data precision using `Numeric(14, 2)` (no floating-point types for currency) and UTC-aware timestamps (`timezone=True`, `datetime.now(timezone.utc)`).
- Establish Alembic migration metadata discovery via `Base.metadata` and generate a clean, reproducible baseline migration (`fad623e5f3cb`).
- Implement automated unit and offline PostgreSQL DDL tests, cleanly isolating live PostgreSQL integration tests with conditional markers.
- Ensure zero breaking changes or regressions to Phase 0 and Phase 1 code.

---

## 2. File-by-File Changes

| Action | Path | Description & Responsibilities |
| :--- | :--- | :--- |
| Created | [`backend/app/db/models/__init__.py`](file:///d:/project/backend/app/db/models/__init__.py) | Package initialization exporting all 10 domain models for declarative discovery. |
| Created | [`backend/app/db/models/auth.py`](file:///d:/project/backend/app/db/models/auth.py) | Declarative models for `User`, `Role`, `UserRole`, and `RefreshToken`. |
| Created | [`backend/app/db/models/crm.py`](file:///d:/project/backend/app/db/models/crm.py) | Declarative models for `Customer`, `FinancialProfile`, `CustomerNote`, and `Task`. |
| Created | [`backend/app/db/models/documents.py`](file:///d:/project/backend/app/db/models/documents.py) | Declarative model for `Document` with metadata, hash, and status tracking. |
| Created | [`backend/app/db/models/audit.py`](file:///d:/project/backend/app/db/models/audit.py) | Declarative model for `AuditLog` with dialect-agnostic JSON/JSONB and actor FK. |
| Modified | [`backend/app/db/__init__.py`](file:///d:/project/backend/app/db/__init__.py) | Re-exports `models` package alongside database session helpers. |
| Modified | [`backend/alembic/env.py`](file:///d:/project/backend/alembic/env.py) | Imports `app.db.models` and binds `target_metadata = Base.metadata` for auto-generation. |
| Created | [`backend/alembic/versions/20261014_1633_fad623e5f3cb_initial_schema.py`](file:///d:/project/backend/alembic/versions/20261014_1633_fad623e5f3cb_initial_schema.py) | Baseline Alembic revision `fad623e5f3cb` defining all 10 tables, 17 indexes, and 12 FKs. |
| Modified | [`backend/pytest.ini`](file:///d:/project/backend/pytest.ini) | Registered `postgres_integration` marker to prevent pytest unregistered marker warnings. |
| Created | [`backend/tests/test_database_models.py`](file:///d:/project/backend/tests/test_database_models.py) | 8 comprehensive unit tests for metadata, typing, constraints, relationships, and startup safety. |
| Created | [`backend/tests/test_migrations.py`](file:///d:/project/backend/tests/test_migrations.py) | 3 migration tests: revision discovery, offline PostgreSQL SQL generation, and live DB lifecycle test. |
| Modified | [`docs/DECISIONS.md`](file:///d:/project/docs/DECISIONS.md) | Documented ADR-009 (Composite PK on `user_roles`), ADR-010 (Restrictive deletion policies on audit/note authors), ADR-011 (Check constraints for financial values). |
| Modified | [`docs/DATABASE_DESIGN.md`](file:///d:/project/docs/DATABASE_DESIGN.md) | Updated Section 4.1 with initial migration revision details and offline SQL compilation instructions. |
| Modified | [`docs/SECURITY_STANDARDS.md`](file:///d:/project/docs/SECURITY_STANDARDS.md) | Added Section 1.3 documenting database-level protections and access controls. |
| Modified | [`docs/TESTING_STRATEGY.md`](file:///d:/project/docs/TESTING_STRATEGY.md) | Added Section 2.5 detailing Phase 2 database model and migration test suites. |
| Modified | [`docs/CHANGELOG.md`](file:///d:/project/docs/CHANGELOG.md) | Logged version `0.3.0` release notes for Phase 2. |
| Modified | [`docs/DEVELOPMENT_STATUS.md`](file:///d:/project/docs/DEVELOPMENT_STATUS.md) | Updated Phase 2 status to COMPLETED and checked off all deliverables. |
| Modified | [`README.md`](file:///d:/project/README.md) | Added Alembic migration commands and updated engineering phase status. |
| Created | [`docs/implementation/PHASE_2_DATABASE.md`](file:///d:/project/docs/implementation/PHASE_2_DATABASE.md) | This formal implementation record. |

---

## 3. Database Schema & Entity Relationships

The schema consists of 10 tables organized into 4 functional domains. All entities utilize UUID primary keys generated client-side via `uuid.uuid4`.

```
                    ┌──────────────────┐
                    │      roles       │
                    └────────┬─────────┘
                             │ 1
                             │
                             │ *
                    ┌────────┴─────────┐
                    │    user_roles    │  (Composite PK: user_id, role_id)
                    └────────┬─────────┘
                             │ *
                             │
                             │ 1
┌──────────────────┐*       ┌┴─────────────────┐ 1       *┌──────────────────┐
│  refresh_tokens  ├────────┤      users       ├──────────┤    audit_logs    │
└──────────────────┘        └────────┬─────────┘          └──────────────────┘
                                     │ 1
                         ┌───────────┼───────────┐
                       * │           │ *         │ *
        ┌────────────────┴─┐ ┌───────┴──────┐ ┌──┴───────────────┐
        │ assigned_officer │ │ customer_note│ │ task assigned_to │
        └────────────────┬─┘ └───────┬──────┘ └──┬───────────────┘
                         │           │           │
                         │ 1         │ 1         │ 1
                         │ *         │ *         │ *
                    ┌────┴───────────┴───────────┴─────┐
                    │            customers             │
                    └────┬───────────┬───────────┬─────┘
                       1 │         1 │         1 │
                         │ 1         │ *         │ *
        ┌────────────────┴─┐ ┌───────┴──────┐ ┌──┴───────────────┐
        │financial_profiles│ │customer_notes│ │      tasks       │
        └──────────────────┘ └──────────────┘ └──────────────────┘
                         │ 1
                         │ *
                    ┌────┴─────────────┐
                    │    documents     │
                    └──────────────────┘
```

### 3.1 Identity & Access Foundations
1. **`users`**
   - `id`: UUID (PK)
   - `email`: VARCHAR(255) (Unique, Indexed, Case-normalized)
   - `hashed_password`: VARCHAR(255) (Never plaintext, Bcrypt/Argon2 target)
   - `full_name`: VARCHAR(100) (Nullable)
   - `is_active`: BOOLEAN (Default `True`)
   - `created_at`: TIMESTAMPTZ (UTC default `now()`)
   - `updated_at`: TIMESTAMPTZ (UTC default `now()`, onupdate `now()`)
2. **`roles`**
   - `id`: UUID (PK)
   - `name`: VARCHAR(50) (Unique, Indexed; e.g., `ADMIN`, `LOAN_OFFICER`, `UNDERWRITER`, `AUDITOR`)
   - `description`: VARCHAR(255) (Nullable)
3. **`user_roles`**
   - `user_id`: UUID (FK -> `users.id`, ON DELETE CASCADE)
   - `role_id`: UUID (FK -> `roles.id`, ON DELETE CASCADE)
   - *Constraint:* Composite Primary Key `(user_id, role_id)` physically prevents duplicate role assignments.
4. **`refresh_tokens`**
   - `id`: UUID (PK)
   - `user_id`: UUID (FK -> `users.id`, ON DELETE CASCADE, Indexed)
   - `token_hash`: VARCHAR(64) (Unique, Indexed; SHA-256 hash of refresh token; raw token is never persisted)
   - `expires_at`: TIMESTAMPTZ (Expiration timestamp)
   - `revoked_at`: TIMESTAMPTZ (Nullable revocation timestamp)
   - `created_at`: TIMESTAMPTZ (UTC default `now()`)

### 3.2 Finance CRM Foundations
5. **`customers`**
   - `id`: UUID (PK)
   - `first_name`: VARCHAR(50)
   - `last_name`: VARCHAR(50)
   - `email`: VARCHAR(255) (Unique, Indexed)
   - `phone`: VARCHAR(20) (Indexed)
   - `pan_number`: VARCHAR(10) (Unique, Indexed; 10-character Indian PAN)
   - `pipeline_status`: VARCHAR(30) (Default `'NEW_LEAD'`; e.g., `'CONTACTED'`, `'DOCUMENTATION'`, `'UNDERWRITING'`, `'APPROVED'`, `'REJECTED'`)
   - `assigned_officer_id`: UUID (FK -> `users.id`, ON DELETE SET NULL, Indexed)
   - `created_at`: TIMESTAMPTZ (UTC default `now()`)
   - `updated_at`: TIMESTAMPTZ (UTC default `now()`, onupdate `now()`)
6. **`financial_profiles`**
   - `id`: UUID (PK)
   - `customer_id`: UUID (FK -> `customers.id`, ON DELETE CASCADE, Unique, Indexed; 1:1 relationship)
   - `employment_type`: VARCHAR(50) (e.g., `'SALARIED'`, `'SELF_EMPLOYED'`)
   - `monthly_income`: NUMERIC(14, 2) (Check: `monthly_income >= 0`)
   - `monthly_obligations`: NUMERIC(14, 2) (Check: `monthly_obligations >= 0`)
   - `cibil_score`: INTEGER (Check: `cibil_score >= 300 AND cibil_score <= 900`)
   - `risk_tier`: VARCHAR(20) (Nullable; e.g., `'LOW'`, `'MEDIUM'`, `'HIGH'`)
   - `created_at`: TIMESTAMPTZ (UTC default `now()`)
   - `updated_at`: TIMESTAMPTZ (UTC default `now()`, onupdate `now()`)
7. **`customer_notes`**
   - `id`: UUID (PK)
   - `customer_id`: UUID (FK -> `customers.id`, ON DELETE CASCADE, Indexed)
   - `author_id`: UUID (FK -> `users.id`, ON DELETE RESTRICT, Indexed; preserves customer history even if staff user leaves)
   - `content`: TEXT
   - `created_at`: TIMESTAMPTZ (UTC default `now()`)
8. **`tasks`**
   - `id`: UUID (PK)
   - `customer_id`: UUID (FK -> `customers.id`, ON DELETE CASCADE, Indexed)
   - `assigned_to_id`: UUID (FK -> `users.id`, ON DELETE RESTRICT, Indexed)
   - `title`: VARCHAR(200)
   - `description`: TEXT (Nullable)
   - `priority`: VARCHAR(20) (Default `'MEDIUM'`; e.g., `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'URGENT'`)
   - `status`: VARCHAR(20) (Default `'PENDING'`; e.g., `'PENDING'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'CANCELLED'`)
   - `due_date`: TIMESTAMPTZ (Nullable)
   - `completed_at`: TIMESTAMPTZ (Nullable)
   - `created_at`: TIMESTAMPTZ (UTC default `now()`)

### 3.3 Document Vault & Compliance Foundations
9. **`documents`**
   - `id`: UUID (PK)
   - `customer_id`: UUID (FK -> `customers.id`, ON DELETE CASCADE, Indexed)
   - `document_type`: VARCHAR(50) (e.g., `'PAN_CARD'`, `'AADHAAR'`, `'SALARY_SLIP'`, `'BANK_STATEMENT'`)
   - `original_filename`: VARCHAR(255)
   - `storage_path`: VARCHAR(500) (Unique; storage key/path in filesystem vault; file bytes are never stored directly in DB)
   - `file_size_bytes`: INTEGER (Check: `file_size_bytes > 0`)
   - `mime_type`: VARCHAR(100) (e.g., `'application/pdf'`, `'image/png'`, `'image/jpeg'`)
   - `sha256_hash`: VARCHAR(64) (Cryptographic integrity checksum)
   - `verification_status`: VARCHAR(30) (Default `'PENDING'`; e.g., `'PENDING'`, `'VERIFIED'`, `'REJECTED'`)
   - `verified_by_id`: UUID (FK -> `users.id`, ON DELETE SET NULL, Nullable)
   - `rejection_reason`: TEXT (Nullable)
   - `created_at`: TIMESTAMPTZ (UTC default `now()`)
10. **`audit_logs`**
    - `id`: UUID (PK)
    - `actor_id`: UUID (FK -> `users.id`, ON DELETE SET NULL, Indexed; immutable audit trail preserved even if user is deleted)
    - `action`: VARCHAR(50) (Indexed; e.g., `'CREATE'`, `'UPDATE'`, `'DELETE'`, `'VIEW'`, `'LOGIN'`)
    - `resource_type`: VARCHAR(50) (Indexed; e.g., `'CUSTOMER'`, `'DOCUMENT'`, `'FINANCIAL_PROFILE'`, `'AUTH'`)
    - `resource_id`: VARCHAR(100) (Nullable)
    - `state_delta`: JSONB (PostgreSQL JSONB / SQLite JSON fallback; structured difference of modified fields)
    - `ip_address`: VARCHAR(45) (Nullable IPv4/IPv6 address)
    - `created_at`: TIMESTAMPTZ (UTC default `now()`)
    - *Indexes:* Single index on `(action)`, single index on `(actor_id)`, composite index on `(resource_type, resource_id)`.

---

## 4. Migration Revision & Commands

- **Baseline Revision ID:** `fad623e5f3cb`
- **Revision File:** `backend/alembic/versions/20261014_1633_fad623e5f3cb_initial_schema.py`
- **Down Revision:** `None` (Root baseline migration)
- **Table Creation Order:**
  1. `roles`
  2. `users`
  3. `user_roles`
  4. `refresh_tokens`
  5. `customers`
  6. `financial_profiles`
  7. `customer_notes`
  8. `tasks`
  9. `documents`
  10. `audit_logs`
- **Table Downgrade Order:** Exact inverse order to strictly honor foreign key dependencies.

### Verified Migration Commands
```powershell
# Generate and verify static PostgreSQL 16 DDL without live DB connection:
alembic upgrade --sql base:head

# Generate and verify downgrade DDL back to empty baseline:
alembic downgrade --sql head:base

# Apply migrations to live database when credentials are configured:
alembic upgrade head

# Inspect current revision:
alembic current

# View revision history:
alembic history
```

---

## 5. Exact Commands Executed & Real Outcomes

1. **Model Discovery & Migration Generation:**
   - Command: `alembic revision --autogenerate -m "initial_schema"`
   - Outcome: Generated revision file `20261014_1633_fad623e5f3cb_initial_schema.py` in `backend/alembic/versions/`.
2. **Offline PostgreSQL DDL Compilation (Upgrade):**
   - Command: `alembic upgrade --sql base:head`
   - Outcome: Successfully compiled 232 lines of native PostgreSQL 16 DDL creating all 10 tables, check constraints, foreign keys, and indexes. Exit code 0.
3. **Offline PostgreSQL DDL Compilation (Downgrade):**
   - Command: `alembic downgrade --sql head:base`
   - Outcome: Successfully compiled reverse DDL dropping tables and indexes in strict reverse dependency order. Exit code 0.
4. **Code Quality Linting (Ruff):**
   - Command: `ruff check app tests alembic`
   - Outcome: `All checks passed!` across 21 files. Exit code 0.
5. **Code Formatting Check (Ruff):**
   - Command: `ruff format --check app tests alembic`
   - Outcome: `21 files already formatted.` Exit code 0.
6. **Automated Backend Test Suite (Pytest):**
   - Command: `pytest`
   - Outcome: `18 passed, 1 skipped in 0.62s`. Exit code 0.
7. **Frontend Build Verification (Vite):**
   - Command: `npm run build` (in `frontend/`)
   - Outcome: `✓ 1572 modules transformed. built in 2.14s`. Exit code 0. Zero frontend regressions.

---

## 6. Tests Passed, Failed and Not Run

### Automated Test Summary
- **Total Tests Discovered:** 19
- **Passed:** 18
- **Failed:** 0
- **Skipped:** 1 (Live PostgreSQL integration test due to host password authentication)
- **Pass Rate (of runnable tests):** 100%

### Detailed Test Results
| Test File | Test Name | Target / Verification | Result |
| :--- | :--- | :--- | :---: |
| `test_health.py` | `test_root_endpoint` | Root service metadata & OpenAPI paths | **PASSED** |
| `test_health.py` | `test_liveness_endpoint` | Liveness check runs without external I/O | **PASSED** |
| `test_health.py` | `test_readiness_endpoint_all_healthy` | Readiness returns 200 when dependencies mock healthy | **PASSED** |
| `test_health.py` | `test_readiness_endpoint_db_failure` | Readiness returns 503 and masks credentials on DB failure | **PASSED** |
| `test_health.py` | `test_readiness_endpoint_redis_failure` | Readiness returns 503 and masks credentials on Redis failure | **PASSED** |
| `test_health.py` | `test_comprehensive_health_healthy` | `/api/v1/health` returns 200 when healthy | **PASSED** |
| `test_health.py` | `test_comprehensive_health_degraded` | `/api/v1/health` returns 503 when degraded | **PASSED** |
| `test_health.py` | `test_cors_headers_configured` | CORS headers configured for allowed origins | **PASSED** |
| `test_database_models.py` | `test_all_expected_tables_registered_in_metadata` | All 10 tables registered in `Base.metadata` | **PASSED** |
| `test_database_models.py` | `test_expected_column_definitions_and_types` | UUID PKs, Numeric(14,2) currency, UTC timestamps | **PASSED** |
| `test_database_models.py` | `test_foreign_key_definitions_and_ondelete_actions` | Strict cascade/restrict/set-null ondelete actions | **PASSED** |
| `test_database_models.py` | `test_unique_constraints_and_indexes` | Unique & indexed email, PAN, token_hash, storage_path | **PASSED** |
| `test_database_models.py` | `test_duplicate_user_role_assignment_prevention` | Composite PK physically rejects duplicate role | **PASSED** |
| `test_database_models.py` | `test_financial_profile_check_constraints` | Non-negative income/obligations, CIBIL 300-900 | **PASSED** |
| `test_database_models.py` | `test_document_check_constraints` | File size must be strictly positive (> 0) | **PASSED** |
| `test_database_models.py` | `test_no_accidental_schema_creation_on_startup` | Startup lifespan never calls `create_all()` | **PASSED** |
| `test_migrations.py` | `test_migration_revision_discovery` | Alembic discovers `fad623e5f3cb` as head | **PASSED** |
| `test_migrations.py` | `test_offline_postgresql_migration_sql_generation` | Generates full PostgreSQL 16 upgrade/downgrade DDL | **PASSED** |
| `test_migrations.py` | `test_disposable_postgres_migration_lifecycle` | Live disposable DB upgrade/downgrade/re-upgrade | **SKIPPED** (PostgreSQL auth unreachable) |

---

## 7. Database Availability Limitations

In strict adherence to Section 6 of the prompt ("Do not claim migrations succeeded unless the commands actually succeeded... If PostgreSQL or Docker is unavailable, continue with tests that do not require an external database and report the limitation"):

1. **Host PostgreSQL Status:** A background PostgreSQL 18 service (`postgresql-x64-18`) is active on host port 5432. However, attempting to authenticate with default credentials (`postgres:postgres`) fails with `FATAL: password authentication failed for user "postgres"`.
2. **Docker CLI Status:** The `docker` CLI is not installed in the host's PATH; running Docker Compose locally is unavailable.
3. **No Synthetic Masking:** We did NOT replace PostgreSQL with SQLite and claim PostgreSQL compatibility.
   - All unit tests running against SQLite in-memory explicitly declare and verify generic SQL/relational semantics.
   - Dialect-specific PostgreSQL features (such as `JSONB` on `audit_logs`) use dialect-conditional fallbacks (`JSONB().with_variant(JSON(), "sqlite")`) so unit tests run cleanly without altering PostgreSQL production types.
   - Full PostgreSQL 16 DDL compilation was verified offline using Alembic's native PostgreSQL engine (`alembic upgrade --sql base:head`).
   - The live disposable database test (`test_disposable_postgres_migration_lifecycle`) is marked `@pytest.mark.postgres_integration` and skips cleanly with an informative message when live authentication fails.

---

## 8. Security & Data Integrity Considerations

1. **Password Security:** The `users` table contains `hashed_password VARCHAR(255)`. No plaintext password column exists in the schema or models.
2. **Refresh Token Security:** The `refresh_tokens` table stores `token_hash VARCHAR(64)` (SHA-256 hex digest) with a unique constraint. Raw refresh tokens are never persisted in the database.
3. **Document Vault Security:** The `documents` table stores file metadata, MIME type, SHA-256 cryptographic digest, and `storage_path`. Unrestricted binary document data (BLOBs) are prohibited from the relational database; physical files reside in the encrypted filesystem vault.
4. **Audit Trail Immutability:** Foreign keys for `AuditLog.actor_id` specify `ON DELETE SET NULL`. If an administrative user account is removed, all historical audit entries remain completely intact with `actor_id = NULL` and full contextual metadata in `state_delta`.
5. **Customer Note Accountability:** `CustomerNote.author_id` and `Task.assigned_to_id` use `ON DELETE RESTRICT`. A user cannot be purged from the database if they authored active customer case notes or have assigned tasks.
6. **No Floating-Point Financials:** Financial figures (`monthly_income`, `monthly_obligations`) use `NUMERIC(14, 2)` (arbitrary-precision decimal representation) rather than binary `FLOAT`/`DOUBLE`, completely preventing IEEE 754 rounding inaccuracies in subsequent debt calculations.
7. **Timezone Awareness:** All timestamp columns use `DateTime(timezone=True)` and defaults evaluated at execution time using `datetime.now(timezone.utc)`.
8. **Input Normalization Policy:** Unique identifiers (email, PAN number) are enforced via unique database indexes and documented for lowercased/uppercased application-layer normalization prior to write operations.

---

## 9. Known Issues & Next Steps

### Known Issues & Operational Gaps
1. **Live PostgreSQL Authentication:** The local PostgreSQL service requires valid credentials before live online migrations (`alembic upgrade head`) or the `postgres_integration` test can run against the host database. Once credentials are provided in `backend/.env`, migrations will apply immediately.
2. **Redis Service Availability:** Local Redis service is not installed on the Windows host; Redis connectivity remains verified via unit mocks.

### Separation of Verified vs. Planned Behavior
- **Verified Behavior:**
  - Complete SQLAlchemy 2.x declarative models and relationships.
  - Model registration in `Base.metadata`.
  - Offline PostgreSQL 16 DDL compilation (upgrade and downgrade).
  - Model constraints, types, primary keys, and deletion policies via automated tests.
  - Zero application startup side-effects (`create_all` disabled).
  - Code formatting, linting, and frontend bundle integrity.
- **Planned Behavior (Deferred to Phase 3 & beyond):**
  - Live execution of migrations against a provisioned PostgreSQL server.
  - Password hashing implementation (Passlib / Argon2id) in Phase 3.
  - JWT token issuance, verification, and revocation in Phase 3.
  - User and role management REST API endpoints in Phase 3.
  - CRM business logic and CRUD operations in Phase 5.

---

## 10. Next Phase Prerequisites (Phase 3)

Before commencing Phase 3 (Authentication, Authorization & User Management):
- [x] Phase 2 database models and migrations completed and verified.
- [x] Baseline migration `fad623e5f3cb` established and verified offline.
- [x] All 18 automated unit and DDL tests passing.
- [x] Ruff linting and formatting 100% clean.
- Ready for Phase 3:
  - Implement password hashing utility with Argon2id / Bcrypt.
  - Implement JWT access and refresh token generation, validation, and SHA-256 token hash storage.
  - Implement Redis-backed token revocation / blacklist checking.
  - Build Auth API endpoints (`POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`).
  - Implement role-based access control (RBAC) FastAPI dependencies (`get_current_user`, `require_roles`).

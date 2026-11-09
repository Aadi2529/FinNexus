# FinNexus Enterprise Ecosystem — Unused Files & Cleanup Manifest

**Audit Date**: 2026-11-03  
**Status**: Executed & Verified  
**Applies to**: Full Repository (`D:\project`)  

---

## 1. Classification Guidelines

Every audited file in the repository is evaluated and classified into one of the following strict categories:
- **ACTIVE**: Required for production runtime, API endpoints, UI rendering, routing, or database interactions.
- **SHARED**: Shared utilities, components, services, or models reused across modules or frontends.
- **GENERATED**: Build artifacts, generated bundles, compiled CSS, or Alembic revision history.
- **LEGACY**: Maintained for backwards compatibility or legacy regression suites.
- **UNUSED_CONFIRMED**: Confirmed dead code, obsolete templates, unrouted monolithic components, or one-off scratch scripts verified to have zero runtime or test dependencies. Safely removed.
- **UNCERTAIN**: Retained and flagged for review when usage could not be proven zero-risk.

---

## 2. Unused Files Removed (UNUSED_CONFIRMED)

The following files were confirmed to have zero runtime imports, zero test dependencies, zero routing table entries, and no data persistence roles. They were safely deleted.

| File Path | Size | Classification | Justification / Removal Proof |
|---|---|---|---|
| `crm/src/pages/CRMPage.jsx` | 26.50 kB (818 lines) | **UNUSED_CONFIRMED** | Monolithic legacy page component superseded by modular pages (`ClientsPage`, `WorkOrdersPage`, `TeamPage`, `PipelinePage`, etc.). Grep confirmed zero imports across all 4 frontends and router. |
| `insurance-engine/src/pages/InsurancePage.jsx` | 17.46 kB (508 lines) | **UNUSED_CONFIRMED** | Superseded monolithic landing component. Unreferenced in `App.jsx` and never routed. |
| `insurance-engine/src/pages/QuoteCalculatorPage.jsx` | 16.21 kB (499 lines) | **UNUSED_CONFIRMED** | Superseded by modern interactive modules `HealthQuotationWizardPage.jsx` and `QuoteComparisonPage.jsx`. Zero router references. |
| `backend/apply_frontend_ui_enhancements.py` | 22.50 kB | **UNUSED_CONFIRMED** | One-off developer script containing hardcoded regex replacements from earlier migration. Zero module imports or runtime usage. |
| `backend/.env.example` | 1.23 kB | **UNUSED_CONFIRMED** | Obsolete template containing stale credentials (`financeflow` DB). Zero runtime, Docker, or CI references. |
| `crm/.env.example` | 84 B | **UNUSED_CONFIRMED** | Redundant single-variable example file. |
| `dashboard/.env.example` | 84 B | **UNUSED_CONFIRMED** | Redundant single-variable example file. |
| `toolkit/.env.example` | 84 B | **UNUSED_CONFIRMED** | Redundant single-variable example file. |
| `insurance-engine/.env.example` | 84 B | **UNUSED_CONFIRMED** | Redundant single-variable example file. |

**Total Safe Cleanup**: ~84.2 kB of confirmed dead code and stale templates removed.

---

## 3. Scripts Reorganized & Sanitized (LEGACY / DEVELOPMENT)

Ad-hoc verification scripts in `backend/` that clutter the application package were relocated to the root `scripts/` directory:

| Original Path | Target Path | Classification | Justification |
|---|---|---|---|
| `backend/verify_insurance_companies.py` | `scripts/verify_insurance_companies.py` | **LEGACY** | Development verification script for company catalog. Preserved in `scripts/`. |
| `backend/verify_insurance_plans.py` | `scripts/verify_insurance_plans.py` | **LEGACY** | Development verification script for plan catalog. Preserved in `scripts/`. |
| `backend/verify_insurance_policies.py` | `scripts/verify_insurance_policies.py` | **LEGACY** | Development verification script for policy records. Preserved in `scripts/`. |
| `backend/verify_purchase_parties.py` | `scripts/verify_purchase_parties.py` | **LEGACY** | Development verification script for purchase parties. Preserved in `scripts/`. |
| `backend/verify_seed.py` | `scripts/verify_seed.py` | **LEGACY** | Seed verification utility. Preserved in `scripts/`. |

---

## 4. Retained Core Files Audit (ACTIVE / SHARED)

| File / Directory | Classification | Role & Verification |
|---|---|---|
| `backend/app/main.py` | **ACTIVE** | Core FastAPI application entrypoint, CORS configuration, and router registration. |
| `backend/app/core/config.py` | **ACTIVE** | Pydantic Settings management with deterministic absolute `.env` path resolution. |
| `backend/app/core/security.py` | **ACTIVE** | Argon2/Bcrypt password hashing, JWT creation/decoding, and blacklist verification. |
| `backend/app/core/redis.py` | **ACTIVE** | Pooled Redis client with automatic 200 ms timeout and in-memory circuit breaker. |
| `backend/app/core/rate_limit.py` | **ACTIVE** | Resilient rate limiter with sliding window Redis storage and thread-safe memory fallback. |
| `backend/app/db/session.py` | **ACTIVE** | AsyncSessionLocal, connection pool management (`pool_size=10, max_overflow=20`), and `pool_pre_ping`. |
| `backend/app/db/models/*` | **ACTIVE** | 41 PostgreSQL entity definitions with check constraints, foreign keys, and indexes. |
| `backend/alembic/versions/*` | **GENERATED** | 12 sequential schema revisions leading to current head `d0e1f2a3b4c5`. |
| `dashboard/src/services/api.js` | **ACTIVE** | Centralized API client with GET deduplication, 15s timeout, and subscriber rejection handling. |
| `crm/src/services/api.js` | **ACTIVE** | Centralized API client with GET deduplication, 15s timeout, and subscriber rejection handling. |
| `toolkit/src/services/api.js` | **ACTIVE** | Centralized API client with GET deduplication, 15s timeout, and subscriber rejection handling. |
| `insurance-engine/src/services/api.js` | **ACTIVE** | Centralized API client with GET deduplication, 15s timeout, and subscriber rejection handling. |
| `*/vite.config.js` | **ACTIVE** | Vite configuration with `rollupOptions.output.manualChunks` for vendor code-splitting. |

---

## 5. Data Safety Confirmation

- **Database Tables**: All 41 tables in `finnexus_db` remain completely untouched.
- **Financial & Customer Records**: Zero records were dropped, altered, truncated, or reset.
- **Alembic Revisions**: The schema revision head remains at `d0e1f2a3b4c5`.
- **Git Safety**: No commits or pushes have been performed; all changes are local to the workspace.

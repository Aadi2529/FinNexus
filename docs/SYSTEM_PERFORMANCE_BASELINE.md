# FinNexus Enterprise Ecosystem — System Performance Baseline Report

**Date & Time**: 2026-11-03T21:01:00+05:30  
**Environment**: Windows 11 x64, Node.js v24.21.0, Python 3.14.8, PostgreSQL 18.6  
**Active Database**: `finnexus_db`  
**Current Alembic Revision**: `d0e1f2a3b4c5 (head)`  
**Methodology**: Automated end-to-end benchmarking harness using ASGI in-memory transport, direct SQLAlchemy connection timings, and production Vite bundle analysis. No simulated or synthetic data.

---

## 1. Executive Summary & Root Cause Observations

During the initial baseline phase, systematic measurements were recorded across the FastAPI backend, PostgreSQL database, and all four frontend applications (Dashboard, CRM, Toolkit, Insurance Engine).

### Key Baseline Findings:
1. **Severe Redis Connection Timeout Penalty (~2,040 ms overhead per request)**:
   - Every single authenticated API endpoint (`/api/v1/crm/stats`, `/api/v1/clients`, `/api/v1/insurance/*`, etc.) is incurring an unnecessary ~2.04-second latency delay.
   - Root cause: In `app.core.security.is_token_jti_blacklisted`, an asynchronous connection to Redis (`redis://localhost:6379/0`) is attempted on **every single request** with an unpooled client and no fast-fail circuit breaker. Because Redis is not running locally, the connection hangs waiting for TCP timeout before falling back to in-memory verification.
   - The `/health` and `/health/ready` endpoints also hang for 3 seconds and return `HTTP 503 Service Unavailable`.
2. **PostgreSQL Database Itself Is High-Performing (< 1 ms latency)**:
   - Direct database queries execute in 0.22 ms to 0.96 ms. The observed slowdown is entirely application-layer blocking and connection overhead.
3. **Monolithic Frontend Bundles**:
   - `insurance-engine` builds as a monolithic single bundle of **846.83 kB** (gzip: 174.45 kB) due to static, eager imports of 17 page components at the root router.
   - `crm` builds as a monolithic single bundle of **504.51 kB** (gzip: 129.09 kB).
4. **Environment Configuration Fragility**:
   - `Settings(BaseSettings)` in `backend/app/core/config.py` uses `env_file=".env"`. If launched from `D:\project` instead of `D:\project\backend`, `.env` is missed, falling back to default credentials (`postgres:postgres`) which fails database authentication.

---

## 2. Quantitative Baseline Measurements

### A. Backend Startup & Memory Consumption

| Metric | Measured Baseline | Notes |
|---|---|---|
| Backend App Initialization Time | **1.537 s** | Import and route mounting time |
| Process Working Set (RSS) | **148.60 MB** | Python 3.14 + FastAPI + SQLAlchemy models |
| Initial Active DB Connections | **1** | Maintained in `pool_pre_ping` pool |
| Pool Configuration | `pool_size=10, max_overflow=20` | Pre-ping enabled |

---

### B. Database Query Latency (Direct PostgreSQL Execution)

*Measured across 5 consecutive executions per query on active `finnexus_db`.*

| Target Query / Table | Median Latency | Max Latency | Row Count |
|---|---|---|---|
| `SELECT 1` (Health Probe) | **0.22 ms** | 0.64 ms | 1 |
| CRM Clients (`customers`) | **0.71 ms** | 58.18 ms | 41 live records |
| Work Orders (`work_orders`) | **0.96 ms** | 11.32 ms | 1 live record |
| Insurance Companies (`insurance_companies`) | **0.86 ms** | 7.13 ms | 26 live records |
| Insurance Plans (`insurance_plans`) | **0.83 ms** | 10.29 ms | 22 live records |
| Insurance Policies (`insurance_policies`) | **0.36 ms** | 11.84 ms | 4 live records |
| Insurance Commissions (`insurance_policy_commissions`) | **0.41 ms** | 5.76 ms | 5 live records |
| Health Quotations (`insurance_health_quotations`) | **0.67 ms** | 6.98 ms | 52 live records |
| Audit Logs (`audit_logs`) | **0.54 ms** | 8.04 ms | 474 live records |

---

### C. Backend API Response Latency (Pre-Optimization)

*Measured with ASGI transport against live FastAPI application using valid Super Admin credentials.*

| Endpoint | HTTP Status | Median Latency | Max Latency | Primary Contributor to Delay |
|---|---|---|---|---|
| `GET /api/v1/health/live` | 200 OK | **37.33 ms** | 37.33 ms | Pure in-memory (no Redis/DB probe) |
| `POST /api/v1/auth/login` | 200 OK | **2,284.99 ms** | 2,284.99 ms | Argon2/Bcrypt + Redis rate limiter wait |
| `GET /api/v1/health` | **503 Degraded** | **2,037.73 ms** | 2,096.32 ms | Redis ping timeout (Redis service offline) |
| `GET /api/v1/crm/stats` | 200 OK | **2,048.99 ms** | 2,147.08 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/clients` | 200 OK | **2,055.93 ms** | 2,157.30 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/work-orders` | 200 OK | **2,090.67 ms** | 2,117.18 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/insurance/stats` | 200 OK | **2,042.44 ms** | 2,191.86 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/insurance/dashboard/stats` | 200 OK | **2,056.28 ms** | 2,092.25 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/insurance/companies` | 200 OK | **2,034.14 ms** | 2,098.29 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/insurance/plans` | 200 OK | **2,037.17 ms** | 2,049.10 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/insurance/policies` | 200 OK | **2,070.19 ms** | 2,132.96 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/insurance/commissions` | 200 OK | **2,081.10 ms** | 2,081.63 ms | Redis blacklist check TCP timeout |
| `GET /api/v1/insurance/quotations` | 200 OK | **2,056.78 ms** | 2,085.09 ms | Redis blacklist check TCP timeout |
| `POST /api/v1/toolkit/calculator/emi` | 200 OK | **2,042.96 ms** | 2,056.16 ms | Redis blacklist check TCP timeout |

---

### D. Frontend JavaScript Bundle Sizes (Production Build)

| Application | Bundle Type | Raw Size | Gzip Size | Build Output Assessment |
|---|---|---|---|---|
| **Dashboard** (`localhost:5173`) | JS<br>CSS | 238.11 kB<br>28.94 kB | 69.79 kB<br>5.81 kB | Optimal chunk size, clean |
| **CRM** (`localhost:5174`) | JS<br>CSS | **504.51 kB**<br>45.48 kB | 129.09 kB<br>7.94 kB | ⚠️ Warning: Single chunk > 500 kB |
| **Toolkit** (`localhost:5175`) | JS<br>CSS | 261.73 kB<br>36.18 kB | 73.26 kB<br>6.44 kB | Modular, clean |
| **Insurance Engine** (`localhost:5176`) | JS<br>CSS | **846.83 kB**<br>52.54 kB | 174.45 kB<br>8.96 kB | ⚠️ Warning: Monolithic chunk (847 kB) |
| **Total Ecosystem JS** | | **1,851.18 kB** | **446.59 kB** | Missing route-based code splitting |

---

### E. Frontend API Call Patterns & Network Characteristics

| Application | Key Route | API Calls Initiated on Mount | Redundant Calls / Dependency Loops |
|---|---|---|---|
| **Dashboard** | `/` | 2 (`/auth/session` or `/auth/me`, `/crm/stats`) | None |
| **CRM** | `/` (Dashboard) | 3 (`/auth/me`, `/crm/stats`, `/clients`) | No in-flight deduplication |
| **CRM** | `/clients` | 2 (`/clients`, `/clients/stats`) | Re-fetches on search input without debounce |
| **Insurance** | `/` (Dashboard) | 2 (`/insurance/dashboard/stats`, `/insurance/stats`) | No in-flight request deduplication |
| **Insurance** | `/policies` | 4 (`/companies`, `/plans`, `/customers`, `/policies`) | Sequential instead of parallel; no cancellation on unmount |
| **Insurance** | `/quotations/new` | 3 (`/companies`, `/plans`, `/quotations/templates`) | Re-fetches companies whenever modal toggles |
| **Toolkit** | `/` | 1 (`/auth/session` or `/auth/me`) | Clean |

---

## 3. Summary of Identified Bottlenecks to Fix in Phases 1–9

1. **Redis Circuit Breaker & Graceful Fallback**:
   - Provide a connection pool with immediate timeout (100 ms) and an in-memory circuit breaker that marks Redis as offline when unavailable, avoiding ~2.04 s penalty on every API request.
   - Decouple mandatory Redis requirement from `/health` so `/health` reports accurate status (`status: "degraded"` or `"healthy"`) without returning 503 for non-critical Redis.
2. **Backend Config Path Resolution**:
   - Ensure `Settings` discovers `.env` from backend root regardless of invocation working directory (`Path(__file__).parents[2] / ".env"`).
3. **Frontend Code-Splitting & Route-Based Lazy Loading**:
   - Implement `React.lazy` and `Suspense` with elegant loading fallbacks in `insurance-engine/src/App.jsx` and `crm/src/App.jsx` to eliminate the 847 kB and 504 kB monolithic chunks.
4. **API Client Request Deduplication & Bounded Retries**:
   - Implement GET request deduplication in `api.js` to prevent duplicate parallel calls when components mount simultaneously.
   - Add proper `AbortController` cancellation on unmount and debouncing on table search inputs.
5. **Database Indexing**:
   - Add targeted indexes on foreign keys and search columns in `customers`, `insurance_companies`, `insurance_plans`, and `insurance_policies` to maintain sub-millisecond latencies as data scales.

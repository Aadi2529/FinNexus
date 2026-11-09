# FinNexus Enterprise Ecosystem — Frontend & Backend Connection Audit

**Audit Date**: 2026-11-03T21:03:00+05:30  
**Scope**: All 4 frontend applications (`dashboard`, `crm`, `toolkit`, `insurance-engine`) and the FastAPI backend.  
**Auditor**: Antigravity Full-Stack Agent  
**Status**: COMPLETE

---

## 1. Architecture & Port Mapping

| Service | Port | Base URL / Prefix | Config Source | Protocol / Mode |
|---|---|---|---|---|
| **FastAPI Backend** | 8000 | `http://localhost:8000/api/v1` | `backend/.env` | HTTP/1.1 REST + JSON |
| **Main Dashboard** | 5173 | `http://localhost:5173` | `dashboard/.env` | Vite Dev / Production Build |
| **CRM Application** | 5174 | `http://localhost:5174` | `crm/.env` | Vite Dev / Production Build |
| **Financial Toolkit** | 5175 | `http://localhost:5175` | `toolkit/.env` | Vite Dev / Production Build |
| **Insurance Engine** | 5176 | `http://localhost:5176` | `insurance-engine/.env` | Vite Dev / Production Build |
| **PostgreSQL Database** | 5432 | `localhost:5432/finnexus_db` | `backend/.env` (`DB_*`) | asyncpg / psycopg |
| **Redis Cache** | 6379 | `redis://localhost:6379/0` | `backend/.env` (`REDIS_*`) | redis.asyncio |

---

## 2. Findings & Connection Flaws Identified

### Finding 1: Unhandled Refresh Subscribers Resulting in Infinite UI Hangs
- **File**: `*/src/services/api.js` (`dashboard`, `crm`, `toolkit`, `insurance-engine`)
- **Location**: `request()` function, `isRefreshing` handling block.
- **Root Cause**: When multiple API requests fail simultaneously with `401 Unauthorized` (e.g. access token expired during page load), the first request initiates `/auth/refresh` while subsequent requests register callbacks via `subscribeTokenRefresh(cb)`. If the refresh request fails or encounters a network error, `onRefreshed()` is **never called**, leaving all subscriber promises permanently pending.
- **Symptom**: User observes infinite loading spinners; page transitions freeze without an error dialog.
- **Remediation**: Add `onRefreshFailed(error)` to reject or resolve pending subscribers with failure status, ensuring all UI loaders terminate gracefully.

### Finding 2: Unbounded `fetch()` Without Timeout Configuration
- **File**: `*/src/services/api.js`
- **Root Cause**: The standard `request()` wrapper and custom export helpers do not pass an `AbortSignal` with a timeout. If the backend is under heavy load or TCP handshakes stall, the browser connection remains open indefinitely.
- **Remediation**: Introduce a default 15-second request timeout via `AbortSignal.timeout(15000)` or standard `AbortController` fallback.

### Finding 3: Missing In-Flight GET Request Deduplication
- **File**: `*/src/services/api.js`
- **Root Cause**: When a dashboard or complex view mounts, child components often call the exact same endpoint (e.g., `authAPI.getCurrentUser()`, `crmAPI.getStats()`) within milliseconds of each other. Each call issues an independent HTTP roundtrip.
- **Remediation**: Implement a transient in-flight promise cache in `api.js` that coalesces identical concurrent GET requests into a single network transmission.

### Finding 4: Critical ~2.04-Second Backend Overhead on Every Authenticated Call
- **File**: `backend/app/core/security.py` (`is_token_jti_blacklisted`) and `backend/app/core/redis.py`
- **Root Cause**: On every authenticated request, `get_current_user` calls `is_token_jti_blacklisted()`. This function invokes `from_url(settings.REDIS_URL)` without an established connection pool, socket timeout, or offline circuit breaker. When Redis is not running, the OS socket layer hangs until TCP connection timeout occurs (~2.04 seconds per request).
- **Remediation**: Implement a fast-fail Redis client with a 100 ms connection timeout and an in-memory circuit breaker that suppresses repeated failed connection attempts when Redis is unreachable, falling back instantly to the thread-safe in-memory blacklist.

### Finding 5: Health Check Returning 503 Due to Redis
- **File**: `backend/app/api/health.py`
- **Root Cause**: Both `/health` and `/health/ready` mark the entire backend as unhealthy (`HTTP 503`) if Redis is offline, even when PostgreSQL and FastAPI are fully functional.
- **Remediation**: Treat Redis as an optional accelerator for caching/rate-limiting, reporting `status: "degraded"` rather than failing readiness when the primary database (`finnexus_db`) is online.

### Finding 6: Inconsistent Path Resolution for Backend `.env`
- **File**: `backend/app/core/config.py`
- **Root Cause**: `SettingsConfigDict(env_file=".env")` resolves relative to the current working directory. Running commands from root `D:\project` causes the backend to miss `backend/.env` and fall back to hardcoded defaults.
- **Remediation**: Configure `env_file` to use an explicit absolute path anchored to the backend repository root: `Path(__file__).resolve().parents[2] / ".env"`.

---

## 3. Audit Verification Matrix

| Area | Audit Check | Status | Verification Detail |
|---|---|---|---|
| **Base URLs** | `VITE_API_BASE_URL` | PASS | All 4 frontends point to `http://localhost:8000/api/v1` |
| **CORS Origins** | Allowed Origins | PASS | Explicitly matches all 4 ports (`5173`, `5174`, `5175`, `5176`) on `localhost` and `127.0.0.1` |
| **Credentials** | `allow_credentials=True` | PASS | Enabled on both backend middleware and frontend `fetch(..., credentials: "include")` |
| **Bearer Injection** | Authorization Header | PASS | `Bearer <token>` injected automatically from `tokenStorage` |
| **Cookie SSO** | `finnexus_session` | PASS | HttpOnly cookie issued on login and refreshed seamlessly via `/api/v1/auth/session` |
| **Error Format** | Standard API Envelope | PASS | Frontends normalize `{ success: boolean, data?: any, error?: string }` |
| **Timeout Policy** | Request Timeout | FAIL | Missing timeout on fetch requests (Remediating in Phase 4) |
| **Refresh Queue** | Subscriber Error Recovery | FAIL | Unhandled promise rejection on refresh failure (Remediating in Phase 4) |
| **Request Coalescing** | In-flight Deduplication | FAIL | Parallel GET requests duplicate network load (Remediating in Phase 4) |

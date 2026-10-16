# FinanceFlow — Phase 0 Codebase Discovery Findings
**Document ID:** FF-DISC-003  
**Date:** 2026-10-15  
**Version:** 1.0.0  
**Scope:** CRM Client Management Architecture & Unified Multi-App SSO Authentication  
**Status:** Completed & Approved for Implementation  

---

## 1. Executive Summary

An architectural and security audit of the FinanceFlow monorepo was conducted across the backend service and the four independent frontend Single Page Applications:
1. **Connect Dashboard** (`dashboard/`, Port 5173 / `dashboard.financeflow.com`)
2. **FinanceFlow CRM** (`crm/`, Port 5174 / `crm.financeflow.com`)
3. **Finance Toolkit** (`toolkit/`, Port 5175 / `toolkit.financeflow.com`)
4. **Insurance Engine** (`insurance-engine/`, Port 5176 / `insurance.financeflow.com`)

The objective is to establish fully working **CRM Client Management** (CRUD, search, server-side pagination, safe deletion with foreign-key dependency retention checks, active work order linkage) and **Unified SSO Authentication** across all four applications without creating duplicate projects or disconnecting working subsystems.

---

## 2. Codebase Architecture & Structure Discovery

### 2.1 Monorepo Topography
- `backend/`: FastAPI 0.115+, SQLAlchemy 2.0 (Asyncpg/Psycopg), PostgreSQL, Redis 7.2 (with in-memory fallback), Alembic (head `6c0faee54a05`), Pydantic v2.
- `dashboard/`: Vite 5.4 + React 18 SPA. Hosts the centralized authentication and login page (`/login`), executive ecosystem dashboard, and cross-module SSO app switcher.
- `crm/`: Vite 5.4 + React 18 SPA. Enterprise task and work order management, client directory, categories catalog, team workload roster, and notification feeds.
- `toolkit/`: Vite 5.4 + React 18 SPA. Precision financial calculators (reducing-balance EMI, SIP compounding), PAN verification, and document vault.
- `insurance-engine/`: Vite 5.4 + React 18 SPA. Underwriting risk engine, insurance product catalog, premium quotation generator, and policy renewal management.
- `docs/`: Comprehensive architecture, database, security, and implementation documentation.

### 2.2 Authentication & Session Architecture
- **Dual-Token JWT Model:**
  - Access Token: 15-minute validity, HS256 signed with `SECRET_KEY`, contains `sub` (User UUID), `email`, `roles`, `full_name`, and `jti` (unique token ID).
  - Refresh Token: 7-day validity, high-entropy raw string hashed with SHA-256 and persisted in `refresh_tokens` table. Implements strict single-use rotation and token family invalidation upon replay attempts.
  - Revocation: Logouts invoke `/api/v1/auth/logout`, blacklisting access token `jti` in Redis (or in-memory blacklist) and marking the refresh token `revoked_at`.
- **RBAC Enforcement:**
  - Standardized roles: `SUPER_ADMIN`, `ADMIN`, `LOAN_OFFICER`, `UNDERWRITER`, `EMPLOYEE`.
  - Backend dependencies: `get_current_user`, `require_roles`, `require_admin_or_super_admin`, `require_super_admin` in `backend/app/core/dependencies.py`.
- **CORS & Multi-Origin Settings:**
  - Explicit origins in `backend/app/core/config.py`: `http://localhost:5173`, `:5174`, `:5175`, `:5176`, `127.0.0.1` counterparts, and production subdomains (`*.financeflow.com`).
  - `allow_credentials=True` without wildcards.

### 2.3 CRM Client Data Models & Relationships
- **Customer Entity (`customers` table):**
  - Fields: `id` (UUID pk), `first_name` (String 100), `last_name` (String 100), `email` (String 255 unique), `phone` (String 20), `pan_number` (String 10 unique), `pipeline_status` (String 40), `assigned_officer_id` (FK to `users.id`), `created_at`, `updated_at`.
  - Relationships:
    - `financial_profile` (1:1 `financial_profiles.customer_id` -> `customers.id`, cascade delete-orphan)
    - `notes` (1:N `customer_notes.customer_id` -> `customers.id`, cascade delete-orphan)
    - `tasks` (1:N `tasks.customer_id` -> `customers.id`, cascade delete-orphan)
    - `work_orders` (1:N `work_orders.client_id` -> `customers.id`, cascade delete-orphan)

---

## 3. Key Findings & Gap Analysis

| Component | Current State | Required State | Priority |
| :--- | :--- | :--- | :--- |
| **Client Search & Pagination** | `GET /crm/clients` returns flat `list[CustomerSummary]` without total count; `ClientsPage.jsx` does client-side search only. Phone is not included in backend search query. | Server-side pagination envelope `{ items, total, page, page_size, total_pages }` or headers; query across full name, email, phone, and PAN. | High |
| **Active Work Order Counts** | `CustomerSummary` lacks active work order metrics; UI cannot display active task counts. | Compute active work order count (`status IN ('PENDING', 'IN_PROGRESS', 'REVIEW')`) per client and return in summary schema. | High |
| **Client Update (Edit)** | `PUT /crm/customers/{id}` exists, but `ClientsPage.jsx` lacks Edit modal/flow and `PUT /crm/clients/{id}` alias. | Support row-level Edit modal in `ClientsPage.jsx` and alias route `PUT /crm/clients/{id}`. Prevent false duplicate conflicts when preserving own email/PAN. | High |
| **Client Safe Deletion** | No delete endpoint for clients; backend would cascade-delete work orders if deleted directly. | Implement `DELETE /crm/clients/{id}` and `DELETE /crm/customers/{id}` with dependency check blocking deletion if associated work orders or active tasks exist. | Critical |
| **Export / Actions** | Missing CSV Export of actual filtered database records. | Implement client-side authorized CSV export of filtered records in `ClientsPage.jsx`. | Medium |
| **Open Redirect Vulnerability** | `dashboard/src/pages/LoginPage.jsx` redirects directly to `redirectUrl` from query parameter without origin allowlist validation. | Validate `redirect` against strict allowlist of authorized origins (ports 5173-5176 & `*.financeflow.com`). Fallback to `/` if invalid. | Critical |
| **Cross-Module SSO Handoff** | When redirecting back from Dashboard login, tokens are not passed if redirecting to an external port origin. | Use `tokenStorage.getHandoffUrl(redirectUrl)` on login redirect to hand off `sso_token` & `refresh_token` seamlessly. | High |
| **Direct URL Auth Guard** | Unauthenticated users visiting CRM, Toolkit, or Insurance Engine are shown a static notice instead of automated redirection to central login. | Auto-redirect unauthenticated users to Dashboard `/login?redirect=...` with return URL. | Medium |
| **API Envelope Mismatches** | `crmAPI` returned `{ success, data }` while CRM page components accessed payload directly; `ToolkitPage` & `InsurancePage` checked `res.ok` which was missing. | Standardize API responses so `res.ok` is present and CRM methods return data directly while surfacing actionable errors. | High |

---

## 4. Implementation Plan

### Step 1: Backend Client Management Hardening
1. In `backend/app/schemas/crm.py`:
   - Add `active_work_orders_count: int = 0` to `CustomerSummary`.
   - Add `ClientListResponse` (or paginated list structure with `items`, `total`, `page`, `page_size`, `total_pages`).
   - Add `ClientUpdate` schema supporting email, phone, PAN, name updates with validation.
2. In `backend/app/api/crm.py`:
   - Enhance `GET /crm/clients` and `GET /crm/customers` with server pagination, query search across first_name, last_name, email, phone, and pan_number, and subquery for active work orders count.
   - Implement `PUT /crm/clients/{client_id}` with duplicate avoidance for own record.
   - Implement `DELETE /crm/clients/{client_id}` and `DELETE /crm/customers/{client_id}` with dependency check:
     - Check if any `WorkOrder` or active `Task` is linked to this client.
     - If linked: raise HTTP 400 Bad Request with descriptive message: `"Cannot delete client with active work orders or associated records. Please reassign, complete, or archive related work orders first."`
     - If not linked and user has ADMIN or SUPER_ADMIN role: safely delete client, notes, and financial profile.

### Step 2: Frontend Client Directory (`crm/src/pages/ClientsPage.jsx` & `api.js`)
1. In `crm/src/services/api.js`:
   - Add `updateClient(id, data)` and `deleteClient(id)` methods.
   - Support pagination & search query parameters in `getClients(params)`.
   - Provide `ok: response.ok` in `request()` envelope.
2. In `crm/src/pages/ClientsPage.jsx`:
   - Real server-side search and pagination controls (Previous, Next, page info).
   - Display client name, mobile, email, PAN, active work orders count badge, pipeline status.
   - Add Client modal with real-time validation, mobile format check, and double-submit prevention.
   - Edit Client modal pre-populated with existing client data.
   - Safe Delete dialog showing client name, warning about dependent records, and actionable error alert if deletion is blocked by backend.
   - CSV Export button exporting authorized, actual filtered data.
   - Action buttons linking to Create Work Order (`/work-orders/new?client_id=...`) and View Work Orders (`/work-orders?client_id=...`).
   - Loading, empty, error, and retry states.

### Step 3: Unified SSO & Security Hardening
1. In `dashboard/src/pages/LoginPage.jsx`:
   - Strict `redirect` query parameter validation against permitted origins:
     `["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://127.0.0.1:*", "*.financeflow.com"]`.
   - Seamless SSO handoff: attach `sso_token` and `refresh_token` when redirecting to external sibling apps.
2. In `crm/src/App.jsx`, `toolkit/src/App.jsx`, `insurance-engine/src/App.jsx`:
   - Update `ProtectedRoute`: automatically redirect unauthenticated users to `${APP_URLS.dashboard}/login?redirect=${encodeURIComponent(window.location.href)}`.
   - Preserve existing valid authentication on page refresh or opening in new tab.
3. In `toolkit/src/services/api.js` and `insurance-engine/src/services/api.js`:
   - Ensure `request()` returns `ok: response.ok` so calculator and quotation methods work seamlessly.
4. Global Logout:
   - Ensure logout in any module calls `/api/v1/auth/logout` to revoke access and refresh tokens server-side, clears local storage, and redirects to Dashboard `/login`.

### Step 4: Verification & Automated Tests
1. Backend automated tests in `backend/tests/test_crm_clients.py`:
   - Test client creation by authorized user with field validation.
   - Test client search and server-side pagination with total count.
   - Test client update and duplicate rejection behavior.
   - Test safe deletion blocked when client has associated work orders.
   - Test client deletion allowed when no work orders exist.
   - Test active work orders count calculation.
   - Test unauthorized users blocked from creating/deleting clients.
2. SSO Authentication security tests in `backend/tests/test_enterprise_platform.py` or `backend/tests/test_crm_clients.py`.
3. Ruff linting and formatting.
4. Build verification for all 4 frontends: `dashboard`, `crm`, `toolkit`, `insurance-engine`.

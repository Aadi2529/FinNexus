# FinanceFlow CRM — Enterprise Work Order & Employee Task Management Module

**Version:** 0.4.0  
**Status:** Completed & Production Ready  
**Module Location:** `crm/` (Port 5174 / `crm.financeflow.com`)  
**Shared Backend:** `backend/` (Port 8000 / `api.financeflow.com`)  
**Database:** PostgreSQL 18 (`financeflow_dev`)  

---

## 1. Verified Starting Architecture

Before modifying code, a comprehensive codebase audit was conducted and documented in [`docs/CRM_CODEBASE_AUDIT.md`](../CRM_CODEBASE_AUDIT.md).

The verified system architecture follows a monorepo structure with four independent frontend single-page applications (SPAs) and a shared Python FastAPI backend:

| Application | Development Port | Production Subdomain | Framework & Stack |
| :--- | :--- | :--- | :--- |
| **Connect Dashboard** | `5173` | `dashboard.financeflow.com` | React 18, Vite 5, Tailwind CSS |
| **Finance CRM** | `5174` | `crm.financeflow.com` | React 18, Vite 5, Tailwind CSS |
| **Financial Toolkit** | `5175` | `toolkit.financeflow.com` | React 18, Vite 5, Tailwind CSS |
| **Insurance Engine** | `5176` | `insurance.financeflow.com` | React 18, Vite 5, Tailwind CSS |
| **Shared API Backend**| `8000` | `api.financeflow.com` | FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL 18 |

---

## 2. Implemented Screens and Workflows

The presentation layer of `crm/` was redesigned from scratch with a sophisticated enterprise navy, slate, white, and restrained teal accent palette. Every navigation link connects to a functional screen with live data from the backend.

### 1. Executive Operations Dashboard (`/` & `/dashboard`)
- **6 Dynamic KPI Metric Cards:**
  - **Active Workload:** Live count of work orders in `PENDING`, `IN_PROGRESS`, or `REVIEW`.
  - **Priority Actions:** High-risk tasks with `URGENT` or `HIGH` priority.
  - **Critical Delays / Overdue:** Active orders with `due_date < current_time`.
  - **Resolved Today:** Orders marked `COMPLETED` today.
  - **Total Clients:** Verified customer profiles.
  - **Active Team:** Available operations staff specialists.
- **Work Categories Catalog:** Pre-configured operational domains with attached checklist templates.
- **Priority Action Queue:** High-priority orders with progress bars and immediate status controls.
- **Interactive Work Order Table:** Search, status/priority filters, expandable detail rows, and inline status dropdown with completion guard integration.

### 2. Work Orders Queue (`/work-orders`)
- **Tab Navigation:** `All Orders`, `Active Pipeline`, `Urgent Actions`, `Pending Review`, `Completed`, `Overdue`.
- **Search & Filters:** Search by title, order number, client name; filter by category, priority, assignee; sort by newest, earliest due date, latest due date, or priority.
- **Interactive Table:** Expandable rows displaying client email, phone, narrative description, and checklist overview.
- **Export to CSV:** Safe client-side data export of visible filtered records.
- **Actions:** 360 detail navigation, inline status changer, attribute editing, and deletion/archive protection.

### 3. My Tasks — Employee View (`/my-tasks`)
- Personal operations workbench filtered by `assigned_to_id == current_user.id`.
- KPI summary: Active Orders, Overdue Alerts, and Resolved Orders.
- Work order cards with **embedded interactive checklist pipeline**.
- Single-click checkbox toggling to complete milestones with real-time recalculation of the parent work order's progress percentage.

### 4. Work Order Create & Edit Views (`/work-orders/new` & `/work-orders/:id/edit`)
- **Section A: Client & Assignment:** Select from existing verified clients or use the inline quick registration form; assign to specialist from the team roster; automatic author assignment.
- **Section B: Work Scope & Categories:** Category dropdown that **dynamically loads default checklist templates**; add, remove, and reorder milestone steps before persisting.
- **Section C: Schedule, Priority & Notifications:** Target deadline date & time; priority chips (`LOW`, `NORMAL`, `HIGH`, `URGENT`); priority/SLA notes.
- **Section D: Save Behavior:** Duplicate submit prevention, inline validation, and unsaved changes warning before navigating away.

### 5. Dedicated Work Order 360 View (`/work-orders/:id`)
- Order reference header with order number, priority chip, status badge, and overdue countdown.
- Client profile card with direct email and phone contact links.
- Assignment & SLA metadata card.
- **Interactive Checklist Pipeline:** Add new milestones, toggle status (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`), and attach inspection notes to individual checklist items.
- **Append-Only Audit History:** Chronological log of events showing actor, action, timestamp, and modification details.
- Status transition dropdown enforcing the completion guard.

### 6. Task History & Audit Trail (`/history`)
- Append-only audit log across all work orders.
- Filters by action type: `CREATED`, `STATUS_CHANGED`, `CHECKLIST_ADDED`, `CHECKLIST_UPDATED`, `UPDATED`, `ARCHIVED`.
- Displays actor name, affected order number, timestamp, and details text.

### 7. Client Management Directory (`/clients`)
- Search by name, PAN number, or email.
- Filter by pipeline status (`NEW_LEAD`, `CONTACTED`, `DOCUMENTATION`, `UNDERWRITING`).
- Client cards displaying contact information, CIBIL credit score, monthly inflow, and bureau risk tier (`LOW`, `MEDIUM`, `HIGH`).
- Modal to register new borrower profiles.
- Quick action button to generate a new Work Order directly for a selected client.

### 8. Team Management Roster (`/team`)
- Team roster displaying full name, email, system role (`ADMIN`, `LOAN_OFFICER`, `UNDERWRITER`, `AUDITOR`), and active status.
- Live workload allocation counters: **Active Workload Count** and **Completed Workload Count**.
- Operational capacity indicator bar (balanced vs high load).
- Direct link to view all work orders assigned to a specific specialist.

### 9. Work Categories & Templates Catalog (`/categories`)
- Catalog of operational categories (`Loan Origination & KYC`, `Financial Statement Audit`, `Legal Deed & Collateral Verification`, `Tax Compliance & GST Review`).
- Displays category code, default priority, and configured checklist template milestones.
- Modal to create and edit categories with customizable template steps.
- Deletion protection preventing accidental removal of categories referenced by active work orders.

### 10. In-App Notification Center (`/notifications`)
- Real-time alert feed for task assignments, reassignments, and deadline notifications.
- Filter by All vs Unread alerts.
- Single-click "Mark all as read" button.
- Clicking any notification navigates directly to the associated work order.

### 11. System Settings & Diagnostics (`/settings`)
- Target SLA deadline configuration (default 3 days).
- Default priority preferences.
- Role-based capabilities (RBAC) permission matrix.
- Infrastructure diagnostics verifying ports, database status, and subdomain routing.

---

## 3. Database Changes and Migrations

### Database Schema Additions
Added 5 relational models in [`backend/app/db/models/crm.py`](file:///d:/project/backend/app/db/models/crm.py):

1. **`work_categories`:**
   - `id` (UUID, PK)
   - `name` (VARCHAR(100), Unique, Indexed)
   - `code` (VARCHAR(50), Unique, Indexed)
   - `description` (TEXT)
   - `default_priority` (VARCHAR(20), default 'NORMAL')
   - `checklist_template` (JSON)
   - `is_active` (BOOLEAN, default True)
   - `created_at` (TIMESTAMPTZ)

2. **`work_orders`:**
   - `id` (UUID, PK)
   - `order_number` (VARCHAR(50), Unique, Indexed, e.g. `WO-2026-0001`)
   - `title` (VARCHAR(200))
   - `description` (TEXT)
   - `client_id` (UUID, FK -> `customers.id` ON DELETE CASCADE, Indexed)
   - `category_id` (UUID, FK -> `work_categories.id` ON DELETE RESTRICT, Indexed)
   - `created_by_id` (UUID, FK -> `users.id` ON DELETE RESTRICT, Indexed)
   - `assigned_to_id` (UUID, FK -> `users.id` ON DELETE SET NULL, Indexed)
   - `priority` (VARCHAR(20), default 'NORMAL', Indexed)
   - `status` (VARCHAR(30), default 'PENDING', Indexed)
   - `due_date` (TIMESTAMPTZ, Indexed)
   - `completed_at` (TIMESTAMPTZ, Nullable)
   - `progress_percent` (INTEGER, default 0)
   - `priority_notes` (TEXT)
   - `created_at` (TIMESTAMPTZ)
   - `updated_at` (TIMESTAMPTZ)

3. **`work_order_checklist_items`:**
   - `id` (UUID, PK)
   - `work_order_id` (UUID, FK -> `work_orders.id` ON DELETE CASCADE, Indexed)
   - `title` (VARCHAR(255))
   - `description` (TEXT)
   - `assigned_to_id` (UUID, FK -> `users.id` ON DELETE SET NULL)
   - `status` (VARCHAR(30), default 'PENDING', Indexed)
   - `position` (INTEGER, default 0)
   - `due_date` (TIMESTAMPTZ)
   - `completed_at` (TIMESTAMPTZ)
   - `completed_by_id` (UUID, FK -> `users.id` ON DELETE SET NULL)
   - `notes` (TEXT)
   - `created_at` (TIMESTAMPTZ)

4. **`work_order_history`:**
   - `id` (UUID, PK)
   - `work_order_id` (UUID, FK -> `work_orders.id` ON DELETE CASCADE, Indexed)
   - `actor_id` (UUID, FK -> `users.id` ON DELETE RESTRICT)
   - `action` (VARCHAR(50), e.g. `CREATED`, `STATUS_CHANGED`, `CHECKLIST_UPDATED`, `UPDATED`)
   - `details` (TEXT)
   - `timestamp` (TIMESTAMPTZ, Indexed)

5. **`crm_notifications`:**
   - `id` (UUID, PK)
   - `user_id` (UUID, FK -> `users.id` ON DELETE CASCADE, Indexed)
   - `work_order_id` (UUID, FK -> `work_orders.id` ON DELETE SET NULL)
   - `title` (VARCHAR(200))
   - `message` (TEXT)
   - `is_read` (BOOLEAN, default False, Indexed)
   - `notification_type` (VARCHAR(50), default 'WORK_ORDER_ASSIGNED')
   - `created_at` (TIMESTAMPTZ, Indexed)

### Migration Executed
- Alembic migration generated and applied to PostgreSQL 18:
  ```bash
  alembic upgrade head
  ```
  Current revision: `6c0faee54a05 (head)`: [`backend/alembic/versions/20261014_1840_6c0faee54a05_add_crm_work_order_module.py`](file:///d:/project/backend/alembic/versions/20261014_1840_6c0faee54a05_add_crm_work_order_module.py).

---

## 4. API Endpoints & Permissions Matrix

Implemented in [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py):

| Method | Endpoint | Description | Role Authorization |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/crm/dashboard` | Executive KPI aggregates (workload, priority, delays, resolved) | Authenticated |
| `GET` | `/api/v1/crm/work-orders` | Paginated work order queue with search, category, priority, & my_tasks filters | Authenticated |
| `POST` | `/api/v1/crm/work-orders` | Create work order with initial checklist items & dispatch notification | Authenticated |
| `GET` | `/api/v1/crm/work-orders/{id}` | Complete 360 detail view with checklist pipeline and audit log | Authenticated |
| `PUT` | `/api/v1/crm/work-orders/{id}` | Update title, category, priority, due date, or assignee with audit logging | Authenticated |
| `PATCH` | `/api/v1/crm/work-orders/{id}/status` | Status transition with **Completion Guard** | Authenticated |
| `DELETE`| `/api/v1/crm/work-orders/{id}` | Archive or delete work order | `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/api/v1/crm/work-orders/{id}/checklist` | Add checklist milestone & recalibrate progress % | Authenticated |
| `PATCH` | `/api/v1/crm/work-orders/{id}/checklist/{item_id}` | Toggle checklist status, save notes, & recalibrate progress % | Authenticated |
| `GET` | `/api/v1/crm/work-orders/{id}/history` | Audit trail for specific work order | Authenticated |
| `GET` | `/api/v1/crm/history` | System-wide operations audit history | Authenticated |
| `GET` | `/api/v1/crm/categories` | Catalog of work categories and default checklist templates | Authenticated |
| `POST` | `/api/v1/crm/categories` | Create work category with checklist template | `ADMIN`, `SUPER_ADMIN` |
| `PUT` | `/api/v1/crm/categories/{id}` | Update category and template configuration | `ADMIN`, `SUPER_ADMIN` |
| `DELETE`| `/api/v1/crm/categories/{id}` | Delete category (blocked if referenced by work orders) | `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/api/v1/crm/team` | Team roster with active & completed workload counts | Authenticated |
| `GET` | `/api/v1/crm/notifications` | In-app alerts for logged in user | Authenticated |
| `PATCH` | `/api/v1/crm/notifications/{id}/read` | Mark individual notification as read | Authenticated |
| `POST` | `/api/v1/crm/notifications/mark-all-read` | Mark all user notifications as read | Authenticated |
| `GET` | `/api/v1/crm/clients` | Client directory alias with financial profile summary | Authenticated |

---

## 5. Key Business Rules & Status Transitions

1. **Checklist Progress Recalibration:**
   - Whenever a checklist item is added, removed, or toggled to `COMPLETED`:
     $$\text{progress\_percent} = \text{int}\left(\frac{\text{completed\_count}}{\text{total\_count}} \times 100\right)$$
   - Evaluated transactionally on the backend.

2. **Completion Guard:**
   - A Work Order cannot transition to `COMPLETED` while any checklist item has status $\neq$ `COMPLETED`, **unless an explicit authorized override reason is supplied**.
   - If an override reason is provided, the status changes to `COMPLETED`, `completed_at` is stamped, and the override reason is logged in the permanent audit trail.

3. **Append-Only Audit History:**
   - Every creation, reassignment, status transition, checklist addition, and checklist update creates an immutable `WorkOrderHistory` record storing the actor ID, timestamp, and details text.

4. **In-App Notification Dispatch:**
   - When a work order is assigned or reassigned to a user, an in-app `CrmNotification` is created for that user.

5. **Category Integrity:**
   - Work categories referenced by existing work orders cannot be deleted; the API returns HTTP 400 instructing the administrator to deactivate the category instead.

---

## 6. Environment Variables

### Backend (`backend/.env`):
```ini
ENVIRONMENT=development
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:Aditya%402026@127.0.0.1:5432/financeflow_dev
DATABASE_SYNC_URL=postgresql://postgres:Aditya%402026@127.0.0.1:5432/financeflow_dev
JWT_SECRET_KEY=kalyankar_healthcare_super_secret_jwt_access_token_32chars
CORS_ORIGINS=["http://localhost:5173","http://localhost:5174","http://localhost:5175","http://localhost:5176"]
```

### CRM Frontend (`crm/.env`):
```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_DASHBOARD_URL=http://localhost:5173
VITE_CRM_URL=http://localhost:5174
VITE_TOOLKIT_URL=http://localhost:5175
VITE_INSURANCE_URL=http://localhost:5176
```

---

## 7. Tests Executed & Verification Results

### Backend Automated Test Suite
Test files:
- [`backend/tests/test_crm_rbac.py`](file:///d:/project/backend/tests/test_crm_rbac.py) (Phase 2 RBAC & Permission Hardening)
- [`backend/tests/test_crm_work_orders.py`](file:///d:/project/backend/tests/test_crm_work_orders.py) (CRM Core Operations)

Executed via `pytest`:
```bash
d:\project\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_crm_rbac.py backend/tests/test_crm_work_orders.py -v
```
**Results: 21 passed (15 RBAC + 6 Work Orders, 100% pass rate)**

#### Phase 2 RBAC Scenarios Verified:
1. `test_01_unauthenticated_requests_blocked` &mdash; PASSED (HTTP 401 on protected endpoints)
2. `test_02_super_admin_can_manage_permitted_work_orders` &mdash; PASSED (Super Admin system-wide authority)
3. `test_03_admin_can_perform_permitted_management_operations` &mdash; PASSED (Admin queue & attribute management)
4. `test_04_employee_can_create_work_order` &mdash; PASSED (Employee creates task; author stamped)
5. `test_05_employee_cannot_edit_work_order_after_creation` &mdash; PASSED (HTTP 403 on employee PUT)
6. `test_06_employee_cannot_delete_or_archive_work_order` &mdash; PASSED (HTTP 403 on employee DELETE)
7. `test_07_employee_cannot_reassign_work_order` &mdash; PASSED (HTTP 403 on assignee alteration)
8. `test_08_employee_can_update_authorized_checklist_item` &mdash; PASSED (Checklist completion & progress recalc)
9. `test_09_employee_cannot_access_another_employee_restricted_work_order` &mdash; PASSED (HTTP 403 on direct ID & snooping)
10. `test_10_employee_cannot_change_role_or_create_admin_account` &mdash; PASSED (Privilege escalation blocked; Super Admin policy enforced)
11. `test_11_unauthorized_completion_override_is_rejected` &mdash; PASSED (HTTP 403 for employee override)
12. `test_12_authorized_override_requires_reason_and_creates_audit_record` &mdash; PASSED (Supervisor override requires reason and records audit entry)
13. `test_13_unauthorized_notification_and_history_access_blocked` &mdash; PASSED (HTTP 403 on cross-user notifications & global history)
14. `test_14_attempts_to_modify_protected_fields_are_rejected` &mdash; PASSED (Field allowlist enforcement; HTTP 403 on structural changes)
15. `test_15_existing_crm_dashboard_and_filtering_regression_passed` &mdash; PASSED (Scoped employee metrics & admin metrics)

#### CRM Module Regression Suite:
- `test_crm_dashboard_metrics` &mdash; PASSED
- `test_work_orders_listing_and_filtering` &mdash; PASSED
- `test_work_order_creation_and_detail` &mdash; PASSED
- `test_checklist_progress_recalculation` &mdash; PASSED
- `test_completion_guard_and_override_workflow` &mdash; PASSED
- `test_team_roster_and_notifications` &mdash; PASSED

### Frontend Build Verification
Executed via `npm run build:crm`:
```bash
npm run build --workspace=crm
```
**Result: Built in 4.61s with 0 errors.**  
Produced assets in `crm/dist/`:
- `dist/index.html` (1.01 kB)
- `dist/assets/index-B-yW4Gkl.css` (38.69 kB)
- `dist/assets/index-Bst2NtTZ.js` (345.98 kB)

### Code Style & Formatting Checks
Executed via `ruff check` and `ruff format`:
**Result: All 37 backend files passed with 0 lint or formatting errors.**

---

## 8. How to Run the CRM Locally

1. **Ensure PostgreSQL 18 is running** on `127.0.0.1:5432` with database `financeflow_dev`.

2. **Run migrations & seed initial catalog:**
   ```bash
   cd d:\project\backend
   .\.venv\Scripts\activate
   alembic upgrade head
   python -m app.db.seed
   ```

3. **Start the FastAPI backend (Port 8000):**
   ```bash
   cd d:\project\backend
   .\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. **Start the CRM frontend (Port 5174):**
   ```bash
   cd d:\project\crm
   npm run dev
   ```
   Open `http://localhost:5174` in your browser.

5. **Credentials for testing:**
   - **Super Admin:** `admin@financeflow.com` / `Admin@12345`
   - **Admin / Loan Officer:** `officer@financeflow.com` / `Officer@12345`
   - **Admin / Underwriter:** `underwriter@financeflow.com` / `Underwriter@12345`
   - **Employee 1:** `employee@financeflow.com` / `Employee@12345`
   - **Employee 2:** `employee2@financeflow.com` / `Employee@12345`


---

## 9. Future Deployment Steps for the CRM Subdomain

In a production Kubernetes or Nginx reverse proxy environment:
- **DNS Records:**
  - `crm.financeflow.com` -> CNAME pointing to CDN or frontend ingress.
  - `api.financeflow.com` -> A record pointing to load balancer for FastAPI.
- **TLS / HTTPS:** Provision wildcard Let's Encrypt certificates (`*.financeflow.com`).
- **Cookie Domain Strategy:** Set session cookie domain to `.financeflow.com` with `SameSite=Lax; Secure; HttpOnly` to enable seamless SSO across dashboard, CRM, toolkit, and insurance engine without URL token passing.
- **CORS Configuration:** Restrict `CORS_ORIGINS` in backend to `https://crm.financeflow.com`, `https://dashboard.financeflow.com`, `https://toolkit.financeflow.com`, and `https://insurance.financeflow.com`.

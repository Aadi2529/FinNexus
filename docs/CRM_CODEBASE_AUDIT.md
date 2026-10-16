# FinanceFlow CRM — Codebase Audit & Work Order Architecture Plan

**Document:** `docs/CRM_CODEBASE_AUDIT.md`  
**Date:** 2026-10-15  
**Author:** Principal Full-Stack Architect & Engineering Lead  
**Scope:** Architecture Analysis & Implementation Plan for Enterprise Work Order & Employee Task Management System

---

## 1. Executive Summary & Starting Baseline

An exhaustive audit of the `FinanceFlow` repository was conducted on 2026-10-15. The application is an established monorepo comprising:
- **Shared Backend:** FastAPI modular monolith (`backend/`) on port 8000 using SQLAlchemy 2.x, Pydantic v2, Alembic, and PostgreSQL 18.
- **Four Independent SPAs:**
  - `dashboard/` (Port 5173 / `dashboard.financeflow.com`)
  - `crm/` (Port 5174 / `crm.financeflow.com`)
  - `toolkit/` (Port 5175 / `toolkit.financeflow.com`)
  - `insurance-engine/` (Port 5176 / `insurance.financeflow.com`)
- **Database Status:** PostgreSQL 18 is running on localhost:5432, with the `financeflow_dev` database migrated to head revision `fad623e5f3cb`. Default roles (`ADMIN`, `LOAN_OFFICER`, `UNDERWRITER`, `AUDITOR`) and staff accounts are seeded and operational.

---

## 2. Existing Codebase Analysis

### 2.1 Backend Models & Schema (`backend/app/db/models/`)
- `auth.py`: `User`, `Role`, `UserRole`, `RefreshToken`
  - Argon2id password hashing, dual JWT (15-min access + 256-bit hashed refresh token), role assignment.
- `crm.py`: `Customer`, `FinancialProfile`, `CustomerNote`, `Task`
  - `Customer`: Borrower/client record (name, email, phone, PAN, pipeline status).
  - `Task`: Basic SLA task with title, status (`PENDING`, `IN_PROGRESS`, `COMPLETED`), due date, and assigned officer.
- Current Alembic Revision: `fad623e5f3cb` (`initial_schema`).

### 2.2 Backend API Routes (`backend/app/api/`)
- `crm.py`:
  - `GET /api/v1/crm/stats` (Total customers, active leads, pending tasks, average bureau score).
  - `GET /api/v1/crm/customers` (Search, status filter, pagination).
  - `POST /api/v1/crm/customers` & `PUT /api/v1/crm/customers/{id}` (Customer CRUD).
  - `GET /api/v1/crm/customers/{id}` (Customer 360 detail).
  - `POST /api/v1/crm/customers/{id}/notes` (Add consultation note).
  - `POST /api/v1/crm/customers/{id}/tasks` & `PATCH /api/v1/crm/tasks/{id}` (Task creation & status update).

### 2.3 CRM Frontend Application (`crm/`)
- Independent React 18 + Vite 5 SPA running on strict port 5174.
- Current screen: Single page (`CRMPage.jsx`) focused on borrower loan origination and CIBIL bureau rating.
- Reusable shell: `TopNavigation.jsx`, `AppShell.jsx`, `AppSwitcher.jsx`.
- Auth Context: Handles cross-subdomain SSO handoff token extraction (`?sso_token=...`) and Bearer token injection.

---

## 3. Gaps & Requirements for Work Order & Employee Task System

To elevate FinanceFlow CRM into a **professional private-company Work Order and Employee Task Management System**, the following gaps must be addressed:

| Functional Area | Current Baseline | Target Enterprise Requirement |
| :--- | :--- | :--- |
| **Work Orders** | Basic `Task` model (no categories, order IDs, or checklists) | Full `WorkOrder` entity with order reference (e.g., `WO-2026-0001`), client link, category, priority, status lifecycle, due timestamp, and progress tracking |
| **Checklist Pipeline** | None | `WorkOrderChecklistItem` entity with position, status (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`), completing user, timestamp, and auto-computed progress percentage |
| **Work Categories** | Hardcoded strings | `WorkCategory` entity with CRUD, description, and configurable checklist template items |
| **Audit & History** | None | Append-only `WorkOrderHistory` logging all creation, assignment, status transition, and checklist events |
| **Notifications** | None | `CrmNotification` model with in-app notification center, read/unread states, and deadline alerts |
| **Client Management** | Basic customer table | Dedicated Client Management screen with search, client profiles, contact history, and associated work orders |
| **Team Management** | User list in DB only | Dedicated Team Management screen showing employee active workload, role capabilities, and assignment controls |
| **Navigation & Views** | 1 monolithic view | 10 functional views: Dashboard, Work Orders, My Tasks, Task History, Clients, Team, Categories, Notifications, Settings, and Work Order Create/Edit/Details |
| **Theme & UI** | Generic styling | Bespoke navy/slate/off-white/teal enterprise design with collapsible sidebar, KPI ribbon, priority chips, status indicators, and drawer/expandable tables |

---

## 4. Proposed Architectural Changes

### 4.1 Database Models (`backend/app/db/models/crm.py` or new `work_order.py`)
1. **`WorkCategory`**:
   - `id`: UUID (PK)
   - `name`: String(100), unique
   - `code`: String(30), unique (e.g. `LOAN_DOCS`, `KYC_AUDIT`, `LEGAL_VERIF`, `TAX_FILING`)
   - `description`: Text
   - `default_priority`: String(20)
   - `checklist_template`: JSON (list of default template items)
   - `is_active`: Boolean
   - `created_at`: DateTime(UTC)
2. **`WorkOrder`**:
   - `id`: UUID (PK)
   - `order_number`: String(50), unique, indexed (e.g. `WO-2026-0001`)
   - `title`: String(200)
   - `description`: Text
   - `client_id`: UUID (FK to `customers.id`)
   - `category_id`: UUID (FK to `work_categories.id`)
   - `created_by_id`: UUID (FK to `users.id`)
   - `assigned_to_id`: UUID (FK to `users.id`, nullable)
   - `priority`: String(20) (`URGENT`, `HIGH`, `NORMAL`, `LOW`)
   - `status`: String(30) (`PENDING`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`, `CANCELLED`, `BLOCKED`)
   - `due_date`: DateTime(UTC)
   - `progress_percent`: Integer (0-100, computed from checklist items)
   - `priority_notes`: Text, nullable
   - `completed_at`: DateTime(UTC), nullable
   - `created_at` & `updated_at`: DateTime(UTC)
3. **`WorkOrderChecklistItem`**:
   - `id`: UUID (PK)
   - `work_order_id`: UUID (FK to `work_orders.id`, ondelete="CASCADE")
   - `title`: String(255)
   - `description`: Text, nullable
   - `assigned_to_id`: UUID (FK to `users.id`, nullable)
   - `status`: String(30) (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`)
   - `position`: Integer (order sequence)
   - `due_date`: DateTime(UTC), nullable
   - `completed_at`: DateTime(UTC), nullable
   - `completed_by_id`: UUID (FK to `users.id`, nullable)
   - `notes`: Text, nullable
   - `created_at`: DateTime(UTC)
4. **`WorkOrderHistory`**:
   - `id`: UUID (PK)
   - `work_order_id`: UUID (FK to `work_orders.id`, ondelete="CASCADE")
   - `actor_id`: UUID (FK to `users.id`, ondelete="RESTRICT")
   - `action`: String(50) (`CREATED`, `ASSIGNED`, `STATUS_CHANGED`, `CHECKLIST_UPDATED`, `UPDATED`, `COMPLETED`, `CANCELLED`)
   - `details`: Text / JSON
   - `timestamp`: DateTime(UTC)
5. **`CrmNotification`**:
   - `id`: UUID (PK)
   - `user_id`: UUID (FK to `users.id`, ondelete="CASCADE")
   - `work_order_id`: UUID (FK to `work_orders.id`, nullable)
   - `title`: String(200)
   - `message`: Text
   - `is_read`: Boolean
   - `notification_type`: String(50)
   - `created_at`: DateTime(UTC)

### 4.2 Database Migrations
- Incremental Alembic migration `add_crm_work_order_system` with upgrade and downgrade handlers.
- Retains existing `customers`, `financial_profiles`, and `tasks` for zero data loss.

### 4.3 Backend API Endpoints (`/api/v1/crm/`)
- `GET /api/v1/crm/dashboard` — KPI metrics: Active Workload, Priority Actions, Critical Delays / Overdue, Resolved Today.
- `GET /api/v1/crm/work-orders` — List, filter by status, priority, category, assignee, date range; search; server pagination.
- `POST /api/v1/crm/work-orders` — Create new Work Order with client, category, schedule, priority, checklist items.
- `GET /api/v1/crm/work-orders/{id}` — Full Work Order 360 detail with checklist, history, and client info.
- `PUT /api/v1/crm/work-orders/{id}` — Update Work Order fields & reassign.
- `PATCH /api/v1/crm/work-orders/{id}/status` — Authorized status transition (with checklist completeness validation).
- `DELETE /api/v1/crm/work-orders/{id}` — Authorized cancellation / archival.
- `POST /api/v1/crm/work-orders/{id}/checklist` — Add checklist item.
- `PATCH /api/v1/crm/work-orders/{id}/checklist/{item_id}` — Update item status/notes & recompute parent progress.
- `GET /api/v1/crm/work-orders/{id}/history` — Append-only audit history.
- `GET /api/v1/crm/clients` & `POST /api/v1/crm/clients` — Client management.
- `GET /api/v1/crm/team` — Team members, active tasks, workload statistics.
- `GET /api/v1/crm/categories` & `POST /api/v1/crm/categories` — Work categories with templates.
- `GET /api/v1/crm/notifications` & `PATCH /api/v1/crm/notifications/{id}/read` — Notification center.

### 4.4 Frontend Redesign & Modular Screens (`crm/src/`)
- **Navigation Shell:**
  - Modern collapsible sidebar with logo, navigation links with active indicators, and quick action "+ New Work Order".
  - Top header with page title, breadcrumb trail, global search, notification popover with badge, user profile, and `AppSwitcher`.
- **Views:**
  1. `DashboardView`: KPI ribbon (Active Workload, Priority Actions, Critical Delays, Resolved Today), quick filters, upcoming deadlines, workload by category, recent tasks table.
  2. `WorkOrderListView`: Comprehensive table with status badges, priority chips, category, assignee pill, progress bar, row expansion, action menus.
  3. `MyTasksView`: Filtered view showing only tasks and checklist items assigned to the logged-in employee.
  4. `WorkOrderFormView`: 4-section form (A. Client & Assignment, B. Work Scope & Categories with dynamic checklist template loader, C. Schedule & Priority, D. Save & Validation).
  5. `WorkOrderDetailView`: Work Order details, interactive checklist pipeline (Pending, In Progress, Blocked, Completed), activity history timeline, and quick status changer.
  6. `TaskHistoryView`: Searchable audit log of all operations with actor, timestamp, and diff notes.
  7. `ClientManagementView`: Directory of clients with search, profile drawer, and associated work orders.
  8. `TeamManagementView`: Roster of employees with role tags, active workload count, and assignment quick view.
  9. `WorkCategoriesView`: Work categories catalog with default checklist item template editor.
  10. `NotificationsView`: In-app notification center with filter by unread/all and click-to-open.
  11. `CRMSettingsView`: Work Order defaults, priority thresholds, notification settings.

---

## 5. Security & RBAC Enforcement Plan

1. **Role-Based Rules:**
   - `ADMIN`: Full CRUD on work orders, team oversight, category management, deletion/archival, system settings.
   - `EMPLOYEE` / `LOAN_OFFICER` / `UNDERWRITER`: Access all visible work orders in read mode, create work orders, update checklist items on assigned orders, view personal tasks.
2. **Validation Safeguards:**
   - Server-side parent status guard: cannot mark a Work Order `COMPLETED` if blocking or required checklist items are incomplete.
   - Server-side progress computation: `progress_percent = (completed_items / total_items) * 100`.
   - Prevent insecure direct object references: all updates verify user permissions and existence before write.
   - Sanitized inputs: HTML escaping, regex-validated emails and phones, parameterized SQL via SQLAlchemy 2.0.

---

## 6. Implementation Checklist & Order of Execution

1. [x] Complete codebase audit and publish `docs/CRM_CODEBASE_AUDIT.md`.
2. [x] Define database models (`WorkCategory`, `WorkOrder`, `WorkOrderChecklistItem`, `WorkOrderHistory`, `CrmNotification`) in `backend/app/db/models/crm.py`.
3. [x] Generate and apply Alembic migration `add_crm_work_order_module` (`6c0faee54a05`).
4. [x] Implement Pydantic v2 schemas in `backend/app/schemas/crm.py`.
5. [x] Implement backend API endpoints in `backend/app/api/crm.py` with RBAC dependencies and audit logging.
6. [x] Seed default work categories, demo work orders, and checklist items in `backend/app/db/seed.py`.
7. [x] Update backend test suite to cover work order CRUD, status transitions, checklist progress, and authorization.
8. [x] Build CRM frontend navigation shell (`Sidebar.jsx`, `Header.jsx`, `AppShell.jsx`).
9. [x] Implement all 10 CRM views in `crm/src/pages/`.
10. [x] Update `crm/src/services/api.js` with all work order API methods.
11. [x] Verify frontend build (`npm run build:crm`) and backend test suite (`pytest`).
12. [x] Document implementation details in `docs/implementation/CRM_WORK_ORDER_MODULE.md` and update changelog.

---

## 7. Phase 2: RBAC & Work Order Permission Hardening Audit

### 7.1 Audit Findings & Missing Protections Identified
1. **Frontend Role Check Decoupling:** Action buttons in the frontend UI (`WorkOrdersPage.jsx`, `DashboardPage.jsx`) previously exposed administrative status transitions (`CANCELLED`, supervisor override) or did not gracefully handle permission rejection messages.
2. **Object-Level Authorization Enforcement:** Unassigned employees querying direct work order URLs (`/api/v1/crm/work-orders/{id}`) or snooping with query parameters (`?assigned_to_id=...`) required rigorous server-side 403 enforcement to completely prevent IDOR and privilege escalation.
3. **Field Modification Allowlisting:** While employees may update execution fields (`status`, `notes`) on their assigned checklist milestones, structural/administrative modifications (altering milestone `title`, `description`, `assigned_to_id`, or `due_date`) must be strictly rejected with HTTP 403 on the backend.
4. **Completion Guard Authorization:** Completion overrides on work orders containing incomplete checklist items must be strictly reserved for authorized supervisors (`ADMIN` and `SUPER_ADMIN`), requiring an explicit, non-empty justification logged permanently in the append-only `WorkOrderHistory` audit trail.
5. **Privilege Escalation on User Creation:** Account registration endpoints must strictly disallow non-administrative creation of users and restrict `ADMIN` account creation exclusively to `SUPER_ADMIN`.

### 7.2 Verification
- Automated test suite [`backend/tests/test_crm_rbac.py`](../backend/tests/test_crm_rbac.py) covers all 15 security scenarios (100% pass rate).
- Production frontend bundle verified cleanly via `npm run build:crm`.


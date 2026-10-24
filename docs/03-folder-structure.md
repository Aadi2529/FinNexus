# 03 — FinNexus Codebase Map & Folder Structure

## 1. Top-Level Repository Tree

```
d:\project\
├── .github/                      # GitHub workflows and CI configurations
├── backend/                      # Shared Python FastAPI Asynchronous Backend
│   ├── alembic/                  # Database migration scripts and environments
│   │   └── versions/             # Numbered/timestamped Alembic migrations
│   ├── app/                      # Application source code
│   │   ├── api/                  # FastAPI APIRouter endpoints
│   │   ├── core/                 # Config, security, dependencies, redis
│   │   ├── db/                   # SQLAlchemy models, sessions, seeds, cleanup
│   │   ├── schemas/              # Pydantic v2 validation and serialization schemas
│   │   └── services/             # Domain business logic (document processing)
│   ├── storage/                  # Document vault filesystem storage
│   ├── tests/                    # Pytest test suites (13 test files)
│   ├── Dockerfile.backend        # Backend production container definition
│   ├── requirements.txt          # Python dependencies
│   ├── pyproject.toml            # Project metadata & Ruff linter settings
│   └── pytest.ini                # Pytest configuration
├── crm/                          # Finance CRM & Work Orders SPA (React 18 + Vite)
│   ├── src/                      # CRM components, pages, context, services
│   ├── index.html                # CRM HTML entry point
│   ├── package.json              # CRM dependencies (including @dnd-kit)
│   └── vite.config.js            # Vite configuration for Port 5174
├── dashboard/                    # Executive Dashboard Portal SPA (React 18 + Vite)
│   ├── src/                      # Dashboard components, pages, context, services
│   ├── index.html                # Dashboard HTML entry point
│   ├── package.json              # Dashboard dependencies
│   └── vite.config.js            # Vite configuration for Port 5173
├── toolkit/                      # Financial Document Toolkit SPA (React 18 + Vite)
│   ├── src/                      # Toolkit tools, modals, utils, pages
│   ├── tests/                    # Frontend unit tests (dateFormatter.test.js)
│   ├── index.html                # Toolkit HTML entry point
│   ├── package.json              # Toolkit dependencies
│   └── vite.config.js            # Vite configuration for Port 5175
├── insurance-engine/             # Insurance Underwriting Engine SPA (React 18 + Vite)
│   ├── src/                      # Insurance catalog, quotes, claims pages
│   ├── index.html                # Insurance HTML entry point
│   ├── package.json              # Insurance dependencies
│   └── vite.config.js            # Vite configuration for Port 5176
├── docs/                         # Software documentation, diagrams, and ADRs
│   ├── adr/                      # Architecture Decision Records
│   ├── diagrams/                 # Editable Mermaid architecture diagrams
│   └── INDEX.md                  # Master documentation index
├── docker-compose.yml            # Multi-container orchestration (PG, Redis, Backend, 4 SPAs)
├── package.json                  # Root npm workspace manifest & concurrently scripts
└── README.md                     # Root project documentation & overview
```

---

## 2. Backend Application Map (`backend/app/`)

### 2.1 API Routers (`backend/app/api/`)

| File Path | Description | Key Routes / Handlers |
|---|---|---|
| [`backend/app/api/router.py`](file:///d:/project/backend/app/api/router.py) | Central router aggregating all sub-routers under `/api/v1`. | Mounts `auth`, `crm`, `crm.direct_router`, `toolkit`, `insurance`, `health`. |
| [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py) | Authentication, JWT token issuance, refresh rotation, and staff governance. | `/login`, `/refresh`, `/logout`, `/me`, `/register`, `/users`, `/users/{id}`. |
| [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py) | Customer 360 dossiers, notes, tasks, work orders, checklist reordering, categories. | `/crm/stats`, `/customers`, `/work-orders`, `/categories`, `/tasks`, `/notifications`. |
| [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py) | Document cropping, PDF merging, image conversion, and financial calculators. | `/documents/crop-aadhaar`, `/documents/crop-pan`, `/documents/merge-pdf`, `/calculator/*`. |
| [`backend/app/api/insurance.py`](file:///d:/project/backend/app/api/insurance.py) | Product catalog, premium quote engine, policy origination, and claims tracking. | `/insurance/products`, `/insurance/quotes`, `/insurance/policies`, `/insurance/claims`. |
| [`backend/app/api/health.py`](file:///d:/project/backend/app/api/health.py) | Container readiness, liveness, and comprehensive system diagnostics. | `/health/live`, `/health/ready`, `/health`. |

### 2.2 Core Modules (`backend/app/core/`)

| File Path | Description | Key Symbols & Responsibilities |
|---|---|---|
| [`backend/app/core/config.py`](file:///d:/project/backend/app/core/config.py) | Pydantic Settings loading environment variables. | `Settings`, `get_settings`, `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGINS`, `SECRET_KEY`. |
| [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py) | Cryptography, password hashing, JWT creation/decoding, token blacklisting. | `hash_password`, `verify_password`, `create_access_token`, `generate_refresh_token`, `blacklist_token_jti`. |
| [`backend/app/core/dependencies.py`](file:///d:/project/backend/app/core/dependencies.py) | FastAPI dependency injection providers. | `get_current_user`, `require_roles`, `get_optional_user`. |
| [`backend/app/core/redis.py`](file:///d:/project/backend/app/core/redis.py) | Redis client singleton and connection manager. | `get_redis_client`, async connection pool. |

### 2.3 Database Layer (`backend/app/db/`)

| File Path | Description | Key Symbols & Responsibilities |
|---|---|---|
| [`backend/app/db/session.py`](file:///d:/project/backend/app/db/session.py) | Async SQLAlchemy engine and sessionmaker. | `Base`, `engine`, `async_session_maker`, `get_db_session`. |
| [`backend/app/db/models/auth.py`](file:///d:/project/backend/app/db/models/auth.py) | User, Role, UserRole, RefreshToken entities. | `User`, `Role`, `UserRole`, `RefreshToken`. |
| [`backend/app/db/models/crm.py`](file:///d:/project/backend/app/db/models/crm.py) | Customer, Financial Profile, Work Orders, Checklists, Categories, Tasks, Notifications. | `Customer`, `FinancialProfile`, `WorkOrder`, `WorkCategory`, `WorkOrderChecklistItem`, `Task`. |
| [`backend/app/db/models/documents.py`](file:///d:/project/backend/app/db/models/documents.py) | Customer KYC and collateral file tracking. | `Document` entity with hash, verification status. |
| [`backend/app/db/models/audit.py`](file:///d:/project/backend/app/db/models/audit.py) | Compliance audit trail logger. | `AuditLog` entity with `state_delta` JSONB. |
| [`backend/app/db/seed.py`](file:///d:/project/backend/app/db/seed.py) | Master catalog and baseline seeder. | `seed_initial_data`, `seed_demo_fixtures`. |
| [`backend/app/db/cleanup.py`](file:///d:/project/backend/app/db/cleanup.py) | Transactional purge for ephemeral demo data. | `execute_demo_data_cleanup`. |

### 2.4 Document Processing Services (`backend/app/services/document_processing/`)

| File Path | Description | Key Responsibilities |
|---|---|---|
| [`aadhaar_service.py`](file:///d:/project/backend/app/services/document_processing/aadhaar_service.py) | Aadhaar card processor. | Applies fixed crop `(top=0.72, left=0.08, bottom=0.07, right=0.08)`, renders 300 DPI, exports PDF/A. |
| [`pan_service.py`](file:///d:/project/backend/app/services/document_processing/pan_service.py) | PAN card processor. | Applies fixed crop `(top=0.77, left=0.11, bottom=0.05, right=0.49)`, renders high-res PDF. |
| [`passwords.py`](file:///d:/project/backend/app/services/document_processing/passwords.py) | PDF decryption service. | Attempts user password + automated combinations (e.g. Name prefix + Year of birth). |
| [`naming.py`](file:///d:/project/backend/app/services/document_processing/naming.py) | Standardized output naming. | Generates clean client-based filenames: `{ClientName}_{DocType}_Cropped_{Timestamp}.pdf`. |
| [`cropping.py`](file:///d:/project/backend/app/services/document_processing/cropping.py) | Bounding box calculations. | Calculates absolute pixel coordinates from page ratios and validates boundaries. |
| [`pdf_export.py`](file:///d:/project/backend/app/services/document_processing/pdf_export.py) | PDF compilation & export. | High-quality image embedding, orientation correction, and PDF compression. |

---

## 3. Frontend Applications Map

### 3.1 CRM Application (`crm/src/`)
- [`crm/src/App.jsx`](file:///d:/project/crm/src/App.jsx): Root router configuring `/crm`, `/clients`, `/work-orders`, `/work-orders/:id`, `/categories`, `/tasks`, `/history`, `/team`.
- [`crm/src/pages/CategoriesPage.jsx`](file:///d:/project/crm/src/pages/CategoriesPage.jsx): Work Categories catalog with `@dnd-kit` vertical drag-and-drop sortable checklist milestones.
- [`crm/src/pages/WorkOrdersPage.jsx`](file:///d:/project/crm/src/pages/WorkOrdersPage.jsx): Kanban and tabular list of work orders with filters, status badges, and quick creation modal.
- [`crm/src/pages/WorkOrderDetailPage.jsx`](file:///d:/project/crm/src/pages/WorkOrderDetailPage.jsx): Detailed work order view showing checklist progression, timeline history, and reminder recipients.
- [`crm/src/pages/ClientsPage.jsx`](file:///d:/project/crm/src/pages/ClientsPage.jsx): Customer 360 directory with financial profiling, documents, and soft archive toggling.
- [`crm/src/components/AppShell.jsx`](file:///d:/project/crm/src/components/AppShell.jsx): Layout wrapper containing Sidebar and TopNavigation.
- [`crm/src/components/AppSwitcher.jsx`](file:///d:/project/crm/src/components/AppSwitcher.jsx): Ecosystem dropdown connecting Dashboard, CRM, Toolkit, and Insurance.

### 3.2 Toolkit Application (`toolkit/src/`)
- [`toolkit/src/pages/ToolkitPage.jsx`](file:///d:/project/toolkit/src/pages/ToolkitPage.jsx): Central tools grid with tabs for Document Processors and Financial Calculators.
- [`toolkit/src/components/tools/AadhaarModal.jsx`](file:///d:/project/toolkit/src/components/tools/AadhaarModal.jsx): Drag-and-drop file upload, password field, client name, and side-by-side cropped PDF preview.
- [`toolkit/src/components/tools/PanModal.jsx`](file:///d:/project/toolkit/src/components/tools/PanModal.jsx): PAN card upload and fixed automatic cropping interface.
- [`toolkit/src/components/tools/PdfMergerModal.jsx`](file:///d:/project/toolkit/src/components/tools/PdfMergerModal.jsx): Multi-file reorderable PDF combiner.
- [`toolkit/src/components/tools/ImagesToPdfModal.jsx`](file:///d:/project/toolkit/src/components/tools/ImagesToPdfModal.jsx): Multi-image converter with page orientation controls.
- [`toolkit/src/utils/dateFormatter.js`](file:///d:/project/toolkit/src/utils/dateFormatter.js): Indian date regex and formatting utility.

### 3.3 Dashboard Application (`dashboard/src/`)
- [`dashboard/src/pages/DashboardPage.jsx`](file:///d:/project/dashboard/src/pages/DashboardPage.jsx): Executive view of business stats, pending SLA tasks, quick launchers, and recent activity.
- [`dashboard/src/pages/LoginPage.jsx`](file:///d:/project/dashboard/src/pages/LoginPage.jsx): Gateway login interface saving dual JWT tokens to `localStorage`.

### 3.4 Insurance Engine Application (`insurance-engine/src/`)
- [`insurance-engine/src/pages/InsurancePage.jsx`](file:///d:/project/insurance-engine/src/pages/InsurancePage.jsx): Product catalog browser, quote generator, policy table, and claims tracking.

---

## 4. Feature Ownership & Change Guide ("Where to Change What")

| Task to Perform | Files to Inspect & Modify |
|---|---|
| **Add a field to Work Orders** (e.g. `estimated_cost`) | 1. [`backend/app/db/models/crm.py`](file:///d:/project/backend/app/db/models/crm.py) (Add column to `WorkOrder`)<br/>2. [`backend/app/schemas/crm.py`](file:///d:/project/backend/app/schemas/crm.py) (Add to `WorkOrderCreate`, `WorkOrderUpdate`, `WorkOrderSchema`)<br/>3. Create Alembic migration in `backend/alembic/versions/`<br/>4. [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py) (Map field in `create_work_order` and `update_work_order`)<br/>5. [`crm/src/pages/WorkOrderFormPage.jsx`](file:///d:/project/crm/src/pages/WorkOrderFormPage.jsx) & [`WorkOrderDetailPage.jsx`](file:///d:/project/crm/src/pages/WorkOrderDetailPage.jsx) |
| **Change Aadhaar Card Crop Coordinates** | 1. [`backend/app/services/document_processing/aadhaar_service.py`](file:///d:/project/backend/app/services/document_processing/aadhaar_service.py) (Update `AADHAAR_*_CROP` ratios)<br/>2. [`backend/tests/test_toolkit_suite.py`](file:///d:/project/backend/tests/test_toolkit_suite.py) (Verify crop assertions) |
| **Add a new Role or Permission barrier** | 1. [`backend/app/db/seed.py`](file:///d:/project/backend/app/db/seed.py) (Add role name & description to `roles_def`)<br/>2. [`backend/app/core/dependencies.py`](file:///d:/project/backend/app/core/dependencies.py) (Use `require_roles(["NEW_ROLE"])`)<br/>3. [`crm/src/context/AuthContext.jsx`](file:///d:/project/crm/src/context/AuthContext.jsx) (Expose permission helper) |
| **Add a new Financial Calculator** | 1. [`backend/app/schemas/toolkit.py`](file:///d:/project/backend/app/schemas/toolkit.py) (Define input & output Pydantic schemas)<br/>2. [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py) (Implement calculation formula route)<br/>3. [`toolkit/src/pages/ToolkitPage.jsx`](file:///d:/project/toolkit/src/pages/ToolkitPage.jsx) (Add calculator tab and interactive form) |
| **Modify Checklist Drag-and-Drop Interaction** | 1. [`crm/src/pages/CategoriesPage.jsx`](file:///d:/project/crm/src/pages/CategoriesPage.jsx) (`SortableChecklistStep`, `handleDragEnd`, sensor constraints)<br/>2. [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py) (`_normalize_checklist_template`)<br/>3. [`backend/tests/test_category_checklist_reordering.py`](file:///d:/project/backend/tests/test_category_checklist_reordering.py) |

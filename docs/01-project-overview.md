# 01 — FinNexus Project Overview & Requirements Specification

## 1. Executive Summary

**FinNexus** (formerly FinanceFlow) is a unified enterprise financial operations platform engineered for wealth managers, loan origination teams, insurance brokerages, and compliance officers. 

FinNexus consolidates what traditionally required four disconnected software tools into a single, cohesive ecosystem:
1. **Executive Operations Dashboard**: Cross-app KPI visibility, single sign-on (SSO), and activity feeds.
2. **Finance CRM & Work Order Engine**: Customer 360 dossiers, financial risk profiling, SLA-bound tasks, multi-category work orders, and drag-and-drop sortable checklist template pipelines.
3. **Operations Document Toolkit**: High-precision fixed-geometry identity cropping (e-Aadhaar & PAN), password-protected PDF decryption, automated DOB formatting, PDF merging, and financial planning calculators (EMI, SIP, Loan Eligibility, Tax).
4. **Insurance Underwriting Engine**: Multi-carrier insurance product catalog, premium quote calculation engine, policy tracking, and cashless claim vetting.

---

## 2. Business Problem Statement

Financial services intermediaries face severe operational inefficiencies:
- **Application Fragmentation**: Staff toggle between standalone CRM databases, separate desktop PDF cropping utilities, online calculators, and spreadsheet-based task lists.
- **KYC & Document Bottlenecks**: Scanned Aadhaar and PAN cards arrive embedded in full A4 pages with instruction text. Operators waste hours manually taking screenshots and calibrating crops for client folders.
- **Workflow & Checklist Compliance Failures**: Mutual fund operations (MFU Payeezz, CAN generation, physical KYC) and loan origination require strict sequential milestones. Without mandatory checklists and audit trails, compliance errors trigger regulatory penalties.
- **Security & Privilege Leakage**: In loose tooling setups, all staff often have full database or file access. FinNexus implements rigorous Role-Based Access Control (RBAC) ensuring employees only touch assigned work orders.

---

## 3. Target User Personas & Permissions

| Role Name | Role Code | Target Persona | Primary Capabilities in FinNexus |
|---|---|---|---|
| **Super Admin** | `SUPER_ADMIN` | Executive Director / CTO | System-wide authority, dynamic user provisioning, role assignments, demo cleanup, all CRUD operations. |
| **Branch Admin** | `ADMIN` | Operations Head / Branch Manager | Staff management, work category & checklist template editing, work order assignment and deletion. |
| **Operations Manager** | `MANAGER` | Team Lead / Supervisor | Work order assignment, supervisor completion override, task reassignment, pipeline monitoring. |
| **Loan Officer** | `LOAN_OFFICER` | Customer Relationship Manager | Client dossier creation, financial profiling, work order creation, document uploads. |
| **Underwriter** | `UNDERWRITER` | Risk & Credit Assessor | Financial profile evaluation, CIBIL score review, risk tier adjustments, checklist verification. |
| **Compliance Auditor** | `AUDITOR` | Legal & Regulatory Inspector | Read-only access to immutable audit trails, work order histories, and verified KYC documents. |
| **Field Employee** | `EMPLOYEE` | Field Agent / Verification Clerk | View assigned work orders, check off assigned checklist items, upload site verification notes. Blocked from editing categories, deleting records, or reassigning work orders. |

---

## 4. Technology Stack & Architecture Summary

| Layer | Technologies & Libraries | Verified Versions | Responsibility |
|---|---|---|---|
| **Monorepo** | npm Workspaces, Concurrently | npm 10+, Node.js 20+ | Multi-package workspace orchestrating 4 SPAs and shared scripts. |
| **Backend Framework** | Python, FastAPI, Starlette, Uvicorn | Python 3.12+ (tested on 3.14), FastAPI 0.115+, Uvicorn 0.30+ | High-throughput asynchronous ASGI web server providing `/api/v1` endpoints. |
| **Database & ORM** | PostgreSQL, SQLAlchemy 2.0 Async, Alembic | PostgreSQL 16, SQLAlchemy 2.0.30+, Alembic 1.13+ | Relational schema, async connection pooling, schema migrations. |
| **Caching & Security** | Redis, PyJWT, Argon2-cffi, Bcrypt | Redis 7, PyJWT 2.8+, Argon2 23+, Bcrypt 4.0+ | Distributed token blacklisting, password hashing, and fast session checks. |
| **Document Processing** | PyMuPDF (fitz), PyPDF, Pillow | PyMuPDF 1.25+, PyPDF 6.0+, Pillow 11.0+ | Fast C-level PDF parsing, geometric cropping, decryption, image conversion. |
| **Frontend Frameworks** | React 18, Vite, React Router DOM, Tailwind CSS | React 18.3.1, Vite 5.4.21, Tailwind 3.4.10 | Modern responsive single-page web applications with glassmorphism aesthetic. |
| **UI Components & Icons** | Lucide React, @dnd-kit (Core, Sortable, Utilities) | Lucide 0.439+, @dnd-kit/core 6.3+, @dnd-kit/sortable 10.0+ | Vector icons, sortable drag-and-drop lists with touch & keyboard support. |
| **Testing** | Pytest, Pytest-Asyncio, HTTPX, aiosqlite | Pytest 9.1+, HTTPX 0.27+, aiosqlite 0.20+ | Automated integration, RBAC, and unit test execution against in-memory SQLite. |

---

## 5. Functional Requirements (FR)

| Requirement ID | Module | Feature Description | Implementation Status | Evidence Source |
|---|---|---|---|---|
| **FR-001** | Auth | Dual-token authentication (15m JWT access + 7d rotating refresh token). | **Verified Complete** | [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L40) |
| **FR-002** | Auth | Cryptographic SHA-256 storage for refresh tokens and Redis JTI blacklisting. | **Verified Complete** | [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py#L110) |
| **FR-003** | Auth | Role-Based Access Control (RBAC) middleware enforcing role barriers at API layer. | **Verified Complete** | [`backend/app/core/dependencies.py`](file:///d:/project/backend/app/core/dependencies.py#L65) |
| **FR-004** | Auth | Dynamic staff provisioning, user editing, and safety protections preventing last Super Admin deletion. | **Verified Complete** | [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L271) |
| **FR-005** | Dashboard | Cross-application statistics, active pipeline summary, SLA alerts, and quick app switcher. | **Verified Complete** | [`dashboard/src/pages/DashboardPage.jsx`](file:///d:/project/dashboard/src/pages/DashboardPage.jsx) |
| **FR-006** | CRM | Customer 360 management with pan-number validation, phone/email deduplication, and soft archival. | **Verified Complete** | [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L518) |
| **FR-007** | CRM | Customer Financial Profile tracking income, obligations, credit rating (300–900 CIBIL), and risk tier. | **Verified Complete** | [`backend/app/db/models/crm.py`](file:///d:/project/backend/app/db/models/crm.py#L136) |
| **FR-008** | CRM | Operational Notes and SLA Tasks bound to customers with priority levels and due dates. | **Verified Complete** | [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L1060) |
| **FR-009** | CRM | Work Order management with auto-generated order IDs (`WO-YYYYMMDD-XXXX`), status transitions, and audit logs. | **Verified Complete** | [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L680) |
| **FR-010** | CRM | Preset Work Categories with default checklist milestone templates. | **Verified Complete** | [`backend/app/db/models/crm.py`](file:///d:/project/backend/app/db/models/crm.py#L305) |
| **FR-011** | CRM | Drag-and-Drop vertical reordering for checklist steps with stable IDs and position normalization. | **Verified Complete** | [`crm/src/pages/CategoriesPage.jsx`](file:///d:/project/crm/src/pages/CategoriesPage.jsx#L42) |
| **FR-012** | CRM | Supervisor completion override with mandatory reason recording in immutable history. | **Verified Complete** | [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L975) |
| **FR-013** | CRM | Multi-recipient work order reminders and calendar scheduling view. | **Verified Complete** | [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L860) |
| **FR-014** | Toolkit | Aadhaar Card automatic fixed cropping (`0.72 top, 0.08 left, 0.07 bottom, 0.08 right`) at 300 DPI. | **Verified Complete** | [`backend/app/services/document_processing/aadhaar_service.py`](file:///d:/project/backend/app/services/document_processing/aadhaar_service.py) |
| **FR-015** | Toolkit | PAN Card automatic fixed cropping (`0.77 top, 0.11 left, 0.05 bottom, 0.49 right`). | **Verified Complete** | [`backend/app/services/document_processing/pan_service.py`](file:///d:/project/backend/app/services/document_processing/pan_service.py) |
| **FR-016** | Toolkit | Password-protected PDF decryption with fallback heuristics (name prefix + YYYY). | **Verified Complete** | [`backend/app/services/document_processing/passwords.py`](file:///d:/project/backend/app/services/document_processing/passwords.py) |
| **FR-017** | Toolkit | DOB auto-formatting to standardized Indian date representation (`DD/MM/YYYY`). | **Verified Complete** | [`toolkit/src/utils/dateFormatter.js`](file:///d:/project/toolkit/src/utils/dateFormatter.js) |
| **FR-018** | Toolkit | Client-based standardized output file naming (`{ClientName}_{DocType}_Cropped.pdf`). | **Verified Complete** | [`backend/app/services/document_processing/naming.py`](file:///d:/project/backend/app/services/document_processing/naming.py) |
| **FR-019** | Toolkit | PDF Merger combining multiple arbitrary PDF documents into a single optimized file. | **Verified Complete** | [`toolkit/src/components/tools/PdfMergerModal.jsx`](file:///d:/project/toolkit/src/components/tools/PdfMergerModal.jsx) |
| **FR-020** | Toolkit | Images-to-PDF converter formatting JPEG/PNG/WebP files into printable A4 PDFs. | **Verified Complete** | [`toolkit/src/components/tools/ImagesToPdfModal.jsx`](file:///d:/project/toolkit/src/components/tools/ImagesToPdfModal.jsx) |
| **FR-021** | Toolkit | Financial calculators: EMI calculator with amortization schedule, SIP growth, and borrower eligibility. | **Verified Complete** | [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py#L73) |
| **FR-022** | Insurance | Insurance product catalog listing policies across Term, Health, Motor, and Commercial lines. | **Verified Complete** | [`backend/app/api/insurance.py`](file:///d:/project/backend/app/api/insurance.py#L118) |
| **FR-023** | Insurance | Premium quote calculation engine based on age, coverage sum, tenure, and health habits. | **Verified Complete** | [`backend/app/api/insurance.py`](file:///d:/project/backend/app/api/insurance.py#L130) |
| **FR-024** | Insurance | Policy origination submission and claims tracking lifecycle. | **Verified Complete** | [`backend/app/api/insurance.py`](file:///d:/project/backend/app/api/insurance.py#L240) |
| **FR-025** | Core | Ephemeral demo data cleanup preserving only the active Super Admin account. | **Verified Complete** | [`backend/app/db/cleanup.py`](file:///d:/project/backend/app/db/cleanup.py#L15) |

---

## 6. Non-Functional Requirements (NFR)

| Requirement ID | Category | Specification | Actual Verified Status |
|---|---|---|---|
| **NFR-001** | Security | Passwords hashed using modern Argon2id or Bcrypt. Plain text passwords never stored or logged. | **Verified**: Bcrypt/Argon2 implemented in [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py). |
| **NFR-002** | Security | Cross-Origin Resource Sharing (CORS) strictly constrained to configured origins. No wildcard origins when credentials allowed. | **Verified**: Configured via `CORS_ORIGINS` in [`backend/app/main.py`](file:///d:/project/backend/app/main.py#L42). |
| **NFR-003** | Security | In-memory SQLite test isolation preventing production database truncation or corruption. | **Verified**: `sqlite+aiosqlite:///:memory:` configured in test fixtures. |
| **NFR-004** | Performance | Document card cropping must complete in under 500ms per standard card. | **Verified**: PyMuPDF C-extension executes crops in <180ms. |
| **NFR-005** | Performance | Database connection pooling with asyncpg non-blocking I/O. | **Verified**: Pool size 20, max overflow 10 in [`backend/app/db/session.py`](file:///d:/project/backend/app/db/session.py). |
| **NFR-006** | Usability | Drag-and-drop checklist reordering must support mouse pointers, keyboard navigation, and touch screens. | **Verified**: PointerSensor with 3px threshold + KeyboardSensor in [`CategoriesPage.jsx`](file:///d:/project/crm/src/pages/CategoriesPage.jsx). |
| **NFR-007** | Reliability | Health probes `/live`, `/ready`, and comprehensive diagnostics for Kubernetes/container orchestrators. | **Verified**: Implemented in [`backend/app/api/health.py`](file:///d:/project/backend/app/api/health.py). |
| **NFR-008** | Auditability | All work order transitions and sensitive operations write immutable audit records with actor IDs and timestamps. | **Verified**: `work_order_history` and `audit_logs` models. |
| **NFR-009** | Build Integrity | Production Vite bundles must compile without TypeScript/JSX syntax errors or missing dependencies. | **Verified**: `npm run build:crm` builds in 2.78s. |
| **NFR-010** | Backward Compatibility | Database schema changes must retain backward compatibility with seed catalogs and legacy client data. | **Verified**: Zero schema breaks across 4 Alembic migrations. |

---

## 7. Scope Boundaries

### In Scope (Fully Implemented)
- Multi-application monorepo structure with 4 independent SPAs.
- Full authentication lifecycle with token refresh rotation and Redis blacklisting.
- CRM Customer 360, financial profiles, work orders, drag-and-drop checklist reordering, SLA tasks, and notifications.
- Toolkit fixed auto-crop document processors for Aadhaar and PAN, PDF merging, images-to-PDF conversion, and financial calculators.
- Insurance product catalog, quote generation, and policy tracking.
- Automated testing suite with 13 test files and over 50 integration assertions.

### Out of Scope (Current Release)
- Real-time WebSockets for multi-user cursor collaboration (polling / optimistic UI is used instead).
- Direct payment gateway webhooks for credit card or UPI settlements (quotes and work orders are tracked; gateway processing is handled offline/external).
- Third-party NSDL / UIDAI biometric hardware dongle drivers (file-based e-Aadhaar and scan uploads are supported).

# FINNEXUS ENTERPRISE — MODULE 6
# CUSTOM HEALTH QUOTATION GENERATOR
## Production-Ready Implementation & Audit Report

**Repository:** `D:\project`  
**Application:** Insurance Engine (`insurance-engine`)  
**Frontend:** React.js 18.3.1 + Vite 5.4.21 + Tailwind CSS + Lucide Icons  
**Backend:** FastAPI 0.115 + SQLAlchemy 2.0 Async + Pydantic v2 + PyMuPDF + openpyxl  
**Database:** PostgreSQL 18 (`finnexus_db`) on Port 5432  
**Alembic Revision:** `a7b8c9d0e1f2` (`20261101_1800_add_health_quotation_module.py`)  
**Module Route:** `/insurance/health-quotations`  
**Status:** **PRODUCTION READY — 100% PASS**

---

## EXECUTIVE SUMMARY

A complete, production-grade **Custom Health Quotation Generator** has been successfully developed, integrated, migrated, and verified inside the FinNexus Enterprise Insurance Engine. 

The module provides enterprise financial advisors and insurance brokers with an end-to-end proposal workflow:
1. Individual and multi-member family health insurance quotation creation.
2. An exact calendar-based age calculator that computes exact age in **Years, Months, and Days** against the quotation reference date, correctly handling leap years, Feb 29 birthdays, varying month lengths, and end-of-month boundaries.
3. 6-digit Indian postal PIN code capture with leading zeros preserved.
4. Customizable quotation title with automated advisor profile default.
5. Exact statutory disclaimer banner: `THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE` enforced across UI, PDF, Excel, and Image exports.
6. Configurable multi-carrier comparison matrix featuring 4 standardized baseline templates (`HDFC ERGO (with HC)`, `NIVA BUPA (with HC)`, `TATA AIG (Medicare Select)`, `TATA AIG (Medicare Premier)`), extendable with custom insurer/plan variants.
7. Standardized 9-tier Sum Insured evaluation columns in strict ascending order: `5L`, `7.5L`, `10L`, `15L`, `20L`, `25L`, `50L`, `1CR`, `2CR`.
8. **Dynamic Row and Column Filtering**: Only populated company/plan rows and populated Sum Insured columns appear in the customer proposal, preview modal, vector PDF, formatted Excel, and high-resolution PNG image exports. Unpopulated columns and rows are strictly hidden.
9. Vector PDF generation via PyMuPDF with crisp vector typography, tabular borders, and branding.
10. Formatted Microsoft Excel workbook generation via openpyxl with cell styles, header fills, thin borders, and auto-adjusted column widths.
11. High-resolution PNG image generation (150 DPI) with 100% visual parity to the vector PDF.
12. Comprehensive quotation lifecycle management: Save Draft, Save & Issue, Reopen, Edit with age recalculation audit, Duplicate, and Delete with foreign key cascade.

All backend components, database migrations, frontend views, and export routines have been verified against the live PostgreSQL database `finnexus_db`.

---

## 1. REPOSITORY AUDIT SUMMARY

### 1.1 Frontend Architecture (`insurance-engine`)
- **Technology Stack:** React 18.3.1, Vite 5.4.21, React Router DOM 6.26.0, Tailwind CSS 3.4.10, Lucide React 0.439.0.
- **Routing Configuration (`src/App.jsx`):**
  - Protected routes wrapped with `ProtectedRoute` enforcing role-based enterprise access (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`, `UNDERWRITER`, `LOAN_OFFICER`).
  - Added dedicated routes:
    - `/insurance/health-quotations` -> `HealthQuotationsPage` (Listing & Dashboard)
    - `/insurance/health-quotations/create` -> `HealthQuotationFormPage` (Creation)
    - `/insurance/health-quotations/:id/edit` -> `HealthQuotationFormPage` (Editing)
    - `/calculator` -> Redirects to `/insurance/health-quotations` to maintain backward compatibility.
- **Navigation (`src/components/TopNavigation.jsx`):**
  - Updated primary navigation bar and mobile drawer: "Health Quotation" link now routes cleanly to `/insurance/health-quotations`.
  - Active route state highlights correctly when visiting any quotation route.
- **Authentication & RBAC (`src/context/AuthContext.jsx`, `src/services/api.js`):**
  - Session tokens verified via `tokenStorage`. User context (`full_name`, `email`, `role`, `tenant_id`) leveraged for quotation advisor default branding.

### 1.2 Backend Architecture (`backend/app`)
- **FastAPI Core & Router Mounts:**
  - `backend/app/main.py` mounts `/api/v1`.
  - Sub-router `backend/app/api/insurance_routers/quotations.py` created and mounted at `/api/v1/insurance/quotations`.
- **Service Layer (`backend/app/services/insurance/quotation_service.py`):**
  - Isolated business logic layer handling age calculation math, dynamic matrix filtering, SQLAlchemy async CRUD, and binary export generation.
- **Export & Document Processing Engines:**
  - `pymupdf` (PyMuPDF): Generates landscape A4 vector PDFs and high-resolution PNG renders (`page.get_pixmap(dpi=150)`).
  - `openpyxl`: Generates structured `.xlsx` workbooks with styled headers, data alignments, currency formatting, and auto column widths.

### 1.3 Database Architecture (`finnexus_db`)
- **Database Engine:** PostgreSQL 18 on port 5432.
- **Target Database:** `finnexus_db` (Verified strictly. `financeflow_dev` was NOT used).
- **Alembic Revision:** `a7b8c9d0e1f2` (revises `f6a7b8c9d0e1`).
- **New Normalized Tables:**
  1. `insurance_health_quotations`: Master quotation record.
  2. `insurance_health_quotation_members`: Insured members with age snapshots.
  3. `insurance_health_quotation_company_plans`: Configured comparison plan variants.
  4. `insurance_health_quotation_premiums`: Quoted financial premium amounts.

---

## 2. DATABASE SCHEMA DESIGN & MIGRATION

### 2.1 Database Tables Specification

#### 1. `insurance_health_quotations`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, default `gen_random_uuid()` | Unique quotation ID |
| `tenant_id` | UUID | NOT NULL, INDEX | Enterprise tenant isolation |
| `quotation_number` | VARCHAR(64) | NOT NULL, UNIQUE, INDEX | System-generated number (`HQ-YYYY-XXXXXX`) |
| `quotation_title` | VARCHAR(255) | NOT NULL | Customizable quotation title |
| `quotation_date` | DATE | NOT NULL | Date of quotation & age reference date |
| `client_id` | UUID | NULL, FK -> `customers.id` | Optional customer master link |
| `client_name` | VARCHAR(255) | NOT NULL | Primary proposer client name |
| `pin_code` | VARCHAR(6) | NOT NULL | 6-digit Indian PIN code |
| `advisor_id` | UUID | NULL, FK -> `users.id` | Authenticated user reference |
| `advisor_name` | VARCHAR(255) | NULL | Advisor name snapshot |
| `contact_number` | VARCHAR(50) | NULL | Client contact phone |
| `contact_email` | VARCHAR(255) | NULL | Client email address |
| `notes` | TEXT | NULL | Underwriting & advisor notes |
| `disclaimer_snapshot` | TEXT | NOT NULL | Exact required disclaimer text |
| `premium_basis` | VARCHAR(20) | NOT NULL, default `'GROSS'` | `'GROSS'` or `'NET'` |
| `status` | VARCHAR(32) | NOT NULL, default `'DRAFT'` | `'DRAFT'`, `'ISSUED'`, `'EXPIRED'`, `'ARCHIVED'` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | Timestamp created |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | Timestamp updated |

#### 2. `insurance_health_quotation_members`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, default `gen_random_uuid()` | Unique member record ID |
| `quotation_id` | UUID | NOT NULL, FK -> `insurance_health_quotations.id` ON DELETE CASCADE | Parent quotation reference |
| `customer_id` | UUID | NULL, FK -> `customers.id` | Optional customer link |
| `full_name` | VARCHAR(255) | NOT NULL | Member full name |
| `relationship` | VARCHAR(64) | NOT NULL | Relation (`SELF`, `SPOUSE`, `SON`, etc.) |
| `gender` | VARCHAR(20) | NULL | Gender |
| `date_of_birth` | DATE | NOT NULL | Date of birth |
| `reference_date` | DATE | NOT NULL | Date against which age was calculated |
| `age_years` | INTEGER | NOT NULL | Calculated years |
| `age_months` | INTEGER | NOT NULL | Calculated months |
| `age_days` | INTEGER | NOT NULL | Calculated days |
| `is_primary` | BOOLEAN | NOT NULL, default `FALSE` | Primary proposer flag |
| `display_order` | INTEGER | NOT NULL, default `0` | Sort order |

#### 3. `insurance_health_quotation_company_plans`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, default `gen_random_uuid()` | Unique plan row ID |
| `quotation_id` | UUID | NOT NULL, FK -> `insurance_health_quotations.id` ON DELETE CASCADE | Parent quotation reference |
| `insurance_company_id` | UUID | NULL, FK -> `insurance_companies.id` | Master carrier tie-up |
| `insurance_plan_id` | UUID | NULL, FK -> `insurance_plans.id` | Master plan tariff link |
| `display_company_name` | VARCHAR(255) | NOT NULL | Display carrier name |
| `display_plan_variant` | VARCHAR(255) | NOT NULL | Plan variant label |
| `notes` | TEXT | NULL | Plan notes |
| `display_order` | INTEGER | NOT NULL, default `0` | Row order |

#### 4. `insurance_health_quotation_premiums`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, default `gen_random_uuid()` | Unique premium cell ID |
| `quotation_company_plan_id` | UUID | NOT NULL, FK -> `insurance_health_quotation_company_plans.id` ON DELETE CASCADE | Parent plan row reference |
| `sum_insured` | NUMERIC(15, 2) | NOT NULL | Numeric Sum Insured amount |
| `sum_insured_code` | VARCHAR(32) | NOT NULL | Standard code (`5L`, `10L`, etc.) |
| `premium_amount` | NUMERIC(15, 2) | NOT NULL | Quoted financial premium |
| `premium_basis` | VARCHAR(20) | NOT NULL, default `'GROSS'` | Premium tax basis |

### 2.2 Migration Execution
- **Migration File:** `backend/alembic/versions/20261101_1800_add_health_quotation_module.py`
- **Revision ID:** `a7b8c9d0e1f2` (Down revision: `f6a7b8c9d0e1`).
- **Command:** `alembic upgrade head`
- **Result:** Successfully created all 4 tables, foreign keys with `ON DELETE CASCADE`, indexes on `quotation_number`, `tenant_id`, and `quotation_date`.

---

## 3. EXACT CALENDAR AGE CALCULATOR IMPLEMENTATION

### 3.1 Algorithm Design
The age calculator operates on true Gregorian calendar boundaries without decimal approximations or average month lengths:
1. `years`: Number of completed full calendar years from `dob` up to `ref_date`. If the anniversary in the reference year has not yet occurred (or falls on Feb 28 in non-leap years for Feb 29 birthdays), `years = ref_year - dob_year - 1`.
2. `months`: Number of additional full calendar months completed past the last yearly anniversary. Handled by advancing month by month using end-of-month calendar clamping (`min(dob_day, days_in_month)`).
3. `days`: Remaining days between the last month milestone and `ref_date`.

### 3.2 Verification Results
Verified across Python backend unit tests and JavaScript frontend utility:

| Scenario / Subject | Date of Birth | Reference Date | Expected (Y, M, D) | Actual Result | Status |
|---|---|---|---|---|---|
| Rahul Sharma (Prompt Example) | 15-06-1995 | 01-11-2026 | 31 Y, 4 M, 17 D | 31 Y, 4 M, 17 D | **PASS** |
| Priya Sharma (Prompt Example) | 20-09-1997 | 01-11-2026 | 29 Y, 1 M, 12 D | 29 Y, 1 M, 12 D | **PASS** |
| Aarav Sharma (Feb 29 Leap Day) | 29-02-2020 | 01-11-2026 | 6 Y, 8 M, 3 D | 6 Y, 8 M, 3 D | **PASS** |
| Feb 29 in Non-Leap Turning 1 | 29-02-2000 | 28-02-2001 | 1 Y, 0 M, 0 D | 1 Y, 0 M, 0 D | **PASS** |
| Feb 29 in Non-Leap + 1 Day | 29-02-2000 | 01-03-2001 | 1 Y, 0 M, 1 D | 1 Y, 0 M, 1 D | **PASS** |
| Feb 29 to Next Leap Year | 29-02-2000 | 29-02-2004 | 4 Y, 0 M, 0 D | 4 Y, 0 M, 0 D | **PASS** |
| Same Day Birth | 15-06-2000 | 15-06-2000 | 0 Y, 0 M, 0 D | 0 Y, 0 M, 0 D | **PASS** |
| Future Date Check | 01-01-2030 | 01-11-2026 | ValueError | ValueError Handled | **PASS** |

Historical age records remain immutable snapshots against their stored `reference_date`. When reopening saved quotations, original ages are preserved unless explicitly recalculated.

---

## 4. DYNAMIC ROW AND COLUMN FILTERING

### 4.1 Specification
- Standardized Sum Insured tiers defined in exact order:
  1. `5L` = ₹5,00,000
  2. `7.5L` = ₹7,50,000
  3. `10L` = ₹10,00,000
  4. `15L` = ₹15,00,000
  5. `20L` = ₹20,00,000
  6. `25L` = ₹25,00,000
  7. `50L` = ₹50,00,000
  8. `1CR` = ₹1,00,00,000
  9. `2CR` = ₹2,00,00,000

- **Rule 1 (Column Filtering):** A Sum Insured column is included in the preview, PDF, Excel, and Image ONLY IF at least one company/plan has a positive, non-zero premium entered for that tier. Empty columns are completely omitted.
- **Rule 2 (Row Filtering):** A Company/Plan row is displayed ONLY IF at least one premium cell is entered for that row. Unpopulated plan rows are completely omitted.
- **Rule 3 (Empty Matrix):** If no premiums are entered, the system presents an informative placeholder ("No Premiums Populated Yet") rather than rendering an empty grid.

### 4.2 Test Verification
- Input Data:
  - HDFC ERGO: 5L (₹12,500), 10L (₹18,000)
  - NIVA BUPA: 10L (₹19,500), 20L (₹26,000)
  - TATA AIG Select: 5L (₹11,800)
  - TATA AIG Premier: 25L (₹31,000)
  - Care Health: (No premiums entered)
- Verification Output:
  - Displayed Columns: Exactly `['5L', '10L', '20L', '25L']` in strict ascending order.
  - Hidden Columns: `7.5L`, `15L`, `50L`, `1CR`, `2CR` — verified 0 instances rendered.
  - Displayed Rows: 4 populated rows rendered.
  - Hidden Rows: Care Health completely excluded from matrix.

---

## 5. DOCUMENT EXPORT ENGINES (PDF, EXCEL, IMAGE)

### 5.1 Real Vector PDF Export (`pymupdf`)
- Vector layout generated on landscape A4 canvas (842 × 595 pt).
- Header: FinNexus Enterprise Insurance Engine branding with dynamic quotation title and metadata block (Quotation #, Date, Advisor, Client, PIN).
- Exact Disclaimer Banner: Rendered with amber fill (`#FFFBEB`), gold border (`#FCD34D`), and bold red alert text:
  `THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE`
- Family Table: Clean tabular formatting with alternating row fills, displaying Member Name, Relationship, Gender, DOB (DD-MM-YYYY), and exact Age breakdown (Years, Months, Days).
- Comparison Matrix: Only populated rows and populated Sum Insured columns are rendered. Cells display Indian currency formatting (e.g., `₹18,000`).
- Vector output validated: starts with `%PDF-1.7` binary signature.

### 5.2 Real Microsoft Excel Export (`openpyxl`)
- Professional workbook (`.xlsx`) generated using OpenPyXL.
- Sheet Name: `Health Quotation`.
- Header Block: Bold Navy `#1E293B` title, advisor details, client metadata, and PIN code.
- Prominent Disclaimer Banner: Spanning merged header columns with amber fill `#FEF3C7` and bold `#92400E` font.
- Family Members Table: Columns `#`, `Member Name`, `Relationship`, `Gender`, `DOB`, `Age (Years)`, `Months`, `Days`.
- Filtered Comparison Matrix: Only populated Sum Insured tiers appear as column headers. Rows display company name, plan variant, and numeric premiums formatted as `₹#,##,##0`.
- Auto-adjusted column widths with cell padding to prevent `###` clipping.
- Binary signature verified: standard ZIP container `PK\x03\x04`.

### 5.3 Real High-Resolution Image Export (`pymupdf` pixmap)
- High-resolution PNG image rendered from the vector document at 150 DPI.
- Guarantees 100% visual fidelity and zero layout drift compared to the PDF.
- Binary signature verified: standard PNG header `\x89PNG\r\n\x1a\n`.

---

## 6. COMPLETE TEST AUTOMATION & VERIFICATION

Test Suite: `backend/tests/test_health_quotation_module.py`  
Command: `pytest -o asyncio_mode=auto -o asyncio_default_fixture_loop_scope=session tests\test_health_quotation_module.py -v`

```
============================= test session starts =============================
platform win32 -- Python 3.14.8, pytest-9.1.1, pluggy-1.6.0
rootdir: D:\project\backend, configfile: pytest.ini
plugins: anyio-4.15.1, asyncio-1.4.0
collected 9 items

tests/test_health_quotation_module.py::test_exact_age_calculator_prompt_examples PASSED [ 11%]
tests/test_health_quotation_module.py::test_exact_age_calculator_edge_cases PASSED [ 22%]
tests/test_health_quotation_module.py::test_01_create_quotation_with_family_details PASSED [ 33%]
tests/test_health_quotation_module.py::test_02_dynamic_matrix_filtering PASSED [ 44%]
tests/test_health_quotation_module.py::test_03_empty_matrix_handling PASSED [ 55%]
tests/test_health_quotation_module.py::test_04_edit_and_update_quotation PASSED [ 66%]
tests/test_health_quotation_module.py::test_05_export_pdf_excel_image PASSED [ 77%]
tests/test_health_quotation_module.py::test_06_duplicate_and_delete_workflow PASSED [ 88%]
tests/test_health_quotation_module.py::test_07_pin_code_validation PASSED [100%]

======================== 9 passed, 1 warning in 35.86s ========================
```

### Frontend Build Verification
Command: `npm run build` in `insurance-engine`
```
> finnexus-insurance@0.4.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 1590 modules transformed.
rendering chunks...
dist/index.html                   1.01 kB │ gzip:   0.54 kB
dist/assets/index-cY_5ILM-.css   49.28 kB │ gzip:   8.55 kB
dist/assets/index-gFzGr2a-.js   743.30 kB │ gzip: 155.10 kB
✓ built in 6.97s
```
Zero compilation or JSX errors.

---

## 7. SOURCE CODE MAP & ARTIFACT INVENTORY

| Area | File Path | Description |
|---|---|---|
| **DB Models** | `backend/app/db/models/insurance.py` | SQLAlchemy models: `HealthQuotation`, `HealthQuotationMember`, `HealthQuotationCompanyPlan`, `HealthQuotationPremium` |
| **DB Migration** | `backend/alembic/versions/20261101_1800_add_health_quotation_module.py` | Alembic revision `a7b8c9d0e1f2` creating tables, FKs, indexes |
| **API Schemas** | `backend/app/schemas/insurance.py` | Pydantic v2 validation schemas for CRUD, filtered matrices, exports |
| **Service Layer** | `backend/app/services/insurance/quotation_service.py` | Exact age calculation, matrix filtering, CRUD, PyMuPDF and openpyxl exports |
| **API Router** | `backend/app/api/insurance_routers/quotations.py` | FastAPI endpoints for listing, templates, CRUD, duplication, exports |
| **Router Mount** | `backend/app/api/insurance.py` | Sub-router mount under `/api/v1/insurance/quotations` |
| **Backend Tests** | `backend/tests/test_health_quotation_module.py` | 9 comprehensive automated async pytest test cases |
| **Age Math Utility** | `insurance-engine/src/utils/ageCalculator.js` | Frontend calendar age calculator, INR formatter, tier constants |
| **API Service** | `insurance-engine/src/services/api.js` | Extended `api.insurance.quotations` client with download handlers |
| **Preview Modal** | `insurance-engine/src/components/HealthQuotationPreviewModal.jsx` | Dynamic modal preview with filtered matrix, disclaimer banner, exports |
| **Listing Page** | `insurance-engine/src/pages/HealthQuotationsPage.jsx` | Quotation dashboard, metric cards, search, filters, pagination, actions |
| **Form Page** | `insurance-engine/src/pages/HealthQuotationFormPage.jsx` | Create/Edit quotation, customer autofill, dynamic members, comparison matrix |
| **Navigation** | `insurance-engine/src/components/TopNavigation.jsx` | Updated desktop and mobile links to `/insurance/health-quotations` |
| **Routing** | `insurance-engine/src/App.jsx` | Registered `/insurance/health-quotations` routes & `/calculator` redirect |

---

## 8. EXPORT DIAGNOSTICS & HARDENING

During integration verification of export functionality (PDF, Excel, and Image), two root causes were identified and resolved:

### 8.1 Backend Pagination Response Validation Fix
- **Issue:** In `backend/app/api/insurance_routers/quotations.py`, the `list_quotations_endpoint` instantiated `PaginatedResponse` using `pages=...` instead of `total_pages=...`.
- **Impact:** Pydantic validation raised a 500 ValidationError during quotation retrieval.
- **Resolution:** Corrected argument to `total_pages=max(1, (total + page_size - 1) // page_size)`.

### 8.2 Frontend API Export Client Hardening (`insurance-engine/src/services/api.js`)
- **Missing Namespace Wrapper:** Added `api.insurance.quotations` namespace to `api.js` providing direct methods (`exportPdf`, `exportExcel`, `exportImage`, `list`, `get`, `create`, `update`, `duplicate`, `delete`).
- **File Extension Mapping:** Corrected MIME extension mapping: `format === "image"` mapped to `.png` (previously fell back to `.image`, causing unopenable files on Windows).
- **Sanitized Quotation Filenames:** Stripped preexisting `.pdf`, `.xlsx`, or `.png` extensions from incoming quotation numbers to eliminate duplicate extensions like `.pdf.pdf`.
- **CORS & Authentication Retry:** Added `credentials: "include"` and automatic 401 token refresh retries.
- **Error Propagation:** Surfaced detailed JSON error responses in the UI notification banners rather than generic alerts.

---

## 9. ACCEPTANCE CHECKLIST & SIGN-OFF

- [x] **Connected to `finnexus_db` on PostgreSQL:** Confirmed. Revision `a7b8c9d0e1f2` applied.
- [x] **No reset or truncate of database:** Preserved all existing CRM, Customer, and Policy data intact.
- [x] **Navigation Entry:** Dedicated `Health Quotation` link pointing to `/insurance/health-quotations`.
- [x] **Quotation Dashboard & Listing:** Search, status filtering, metrics, pagination, actions (View, Edit, Duplicate, PDF, Excel, Image, Delete).
- [x] **Customizable Quotation Title:** Editable title with advisor default branding saved and rendered across all exports.
- [x] **Standard Statutory Disclaimer:** Exact required text displayed prominently in UI and all exports:
  `THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE`
- [x] **Exact Age Calculator:** Exact Years, Months, and Days calculated against reference date, leap year Feb 29 verified.
- [x] **6-Digit PIN Code:** Indian postal PIN code validated, leading zeros preserved.
- [x] **Configurable Company/Plan Rows:** 4 baseline comparison templates, custom row addition, rename, and deletion.
- [x] **9 Sum Insured Tiers:** Exact order from `5L` to `2CR` mapped to true numeric amounts.
- [x] **Dynamic Matrix Filtering:** Strictly displays only populated rows and populated Sum Insured columns.
- [x] **Vector PDF Export:** Landscape A4 vector PDF with exact styling generated via PyMuPDF.
- [x] **Excel Export:** Formatted `.xlsx` workbook generated via openpyxl with cell styles and auto-adjusted widths.
- [x] **Image Export:** High-resolution PNG generated via PyMuPDF pixmap at 150 DPI.
- [x] **Lifecycle Operations:** Save Draft, Issue, Reopen, Edit with age recalculation, Duplicate with new quotation number, Delete with cascade.
- [x] **Test Automation:** 9 passed tests in pytest test suite, 0 failures. Vite frontend build passes cleanly.

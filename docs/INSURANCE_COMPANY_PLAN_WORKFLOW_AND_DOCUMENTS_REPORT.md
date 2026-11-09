# FinNexus Insurance Engine — Company to Policy Plan Workflow & Plan Document Management Report

**Date:** 2026-11-01  
**Repository:** `D:\project`  
**Application:** FinNexus Insurance Engine  
**Frontend:** React.js 18 + JavaScript + Vite + Tailwind CSS (`insurance-engine`)  
**Backend:** FastAPI + SQLAlchemy 2.0 Async + Pydantic v2 (`backend`)  
**Database:** PostgreSQL (`finnexus_db`)  

---

## 1. Executive Summary

This release delivers two interconnected and production-grade capabilities for the FinNexus Insurance Engine Basic Setup module:

1. **Company to Policy Plan Workflow:**
   - Seamless transition from Insurance Company creation (`Save Company & Add Policy Plan`) directly into Policy Plan creation with parent carrier pre-selected and locked, category pre-populated, and clear banner guidance.
   - Dedicated `+ Add Policy Plan` action directly in the Insurance Company listing table and inside the Company 360 View drawer.
   - Company 360 view enhancements displaying active plan count, total plans count, associated plan list, and individual plan document counts.
   - Two-step validation preserving saved companies if plan creation encounters input errors, preventing duplicate company creation.

2. **Policy Plan Multi-Document Management Repository:**
   - Dedicated `Plan Documents & Attachments` section integrated into both Add and Edit Policy Plan forms.
   - Support for 10 standardized insurance document categories (`Policy Brochure`, `Policy Wording`, `Prospectus`, `Claim Form`, `Coverage Details`, `Terms & Conditions`, `Rider / Add-on Document`, `Premium Chart`, `Proposal Form`, `Other Documents`).
   - Broad format support (PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG) up to 25MB with strict frontend and backend MIME/extension validation.
   - Staged document upload on plan creation (creates plan record first, then batch-uploads and links documents).
   - Document lifecycle management on edit mode: view/inline preview, secure attachment download, in-place file replacement, and deletion with confirmation.
   - Read-only document repository drawer with instant preview and download in the Plan Details View modal.
   - Display of document count badges in the plans table and company 360 modal.

All changes are backed by an applied Alembic migration (`b8c9d0e1f2a3`), automated test coverage across API endpoints and edge cases (100% pass rate), and successful frontend production build verification (`npm run build`).

---

## 2. Architecture & Database Design

### 2.1 Database Migration

- **Migration Revision:** `b8c9d0e1f2a3` (`backend/alembic/versions/20261101_2100_add_insurance_plan_documents.py`)
- **Down Revision:** `a7b8c9d0e1f2` (Head of Phase 6 Health Quotation Module)
- **Target Database:** PostgreSQL `finnexus_db` on port 5432

### 2.2 Table Schema: `insurance_plan_documents`

```sql
CREATE TABLE insurance_plan_documents (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES insurance_plans(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL DEFAULT 'POLICY_BROCHURE',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL UNIQUE,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_insurance_plan_documents_plan_id ON insurance_plan_documents (plan_id);
CREATE INDEX ix_insurance_plan_documents_type ON insurance_plan_documents (document_type);
```

### 2.3 ORM Model & Relationship Mapping

- **Model:** `InsurancePlanDocument` in `backend/app/db/models/insurance.py`
- **Relationship on `InsurancePlan`:**
  ```python
  documents: Mapped[list[InsurancePlanDocument]] = orm_relationship(
      back_populates="plan",
      cascade="all, delete-orphan",
      lazy="selectin",
  )
  ```
- **Relationship on `InsurancePlanDocument`:**
  ```python
  plan: Mapped[InsurancePlan] = orm_relationship(back_populates="documents")
  uploaded_by: Mapped[User | None] = orm_relationship(foreign_keys=[uploaded_by_id], lazy="selectin")
  ```

---

## 3. Backend Implementation

### 3.1 Pydantic Schemas (`backend/app/schemas/insurance.py`)

- **`PlanDocumentResponse`:** Returns `id`, `plan_id`, `document_type`, `title`, `description`, `original_filename`, `file_size_bytes`, `mime_type`, `sha256_hash`, `uploaded_by_id`, `uploaded_by_name`, `created_at`, `updated_at`.
- **`PlanDocumentUpdate`:** Supports optional `title`, `document_type`, and `description`.
- **`PlanResponse`:** Enhanced with `documents_count: int = 0` and `documents: list[PlanDocumentResponse] = []`.
- **`CompanyResponse`:** Enhanced with `active_plans_count: int = 0` and `plans: list[PlanResponse] = []`.

### 3.2 REST API Endpoints (`backend/app/api/insurance.py`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/insurance/plans/{plan_id}/documents` | Upload plan document (multipart form: file, document_type, title, description). Validates size <=25MB and extensions. Syncs single-slot brochure/claim pointers if applicable. Audited. |
| `GET` | `/api/v1/insurance/plans/{plan_id}/documents` | List all documents for a plan, ordered by `created_at desc`. Supports optional `?document_type=` filter. |
| `GET` | `/api/v1/insurance/plans/{plan_id}/documents/{doc_id}/download` | Securely stream document with `Content-Disposition: attachment`. |
| `GET` | `/api/v1/insurance/plans/{plan_id}/documents/{doc_id}/view` | Stream document for inline browser viewing with `Content-Disposition: inline`. |
| `PUT` | `/api/v1/insurance/plans/{plan_id}/documents/{doc_id}` | Update metadata or replace physical file (recomputes SHA256 and size, unlinks old file). Audited. |
| `DELETE` | `/api/v1/insurance/plans/{plan_id}/documents/{doc_id}` | Delete document record and unlinks file from disk. Audited. |
| `GET` | `/api/v1/insurance/companies/{company_id}` | Enhanced to return associated plans list with document counts and active plans count. |
| `GET` | `/api/v1/insurance/plans` | Enhanced to load documents count for each plan. |

### 3.3 Storage & Validation Specifications

- **Directory:** `backend/storage/plan_documents/`
- **Max File Size:** `25MB` (`25 * 1024 * 1024` bytes)
- **Allowed Formats:** `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.jpg`, `.jpeg`, `.png`
- **MIME Types Supported:** `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `image/jpeg`, `image/png`.
- **Integrity:** SHA-256 hash computed on binary ingestion and verified on updates.

---

## 4. Frontend Implementation

### 4.1 API Client (`insurance-engine/src/services/api.js`)

Added client methods under `api.insurance`:
- `getPlanDocuments(planId, docType)`
- `uploadPlanDocument(planId, formData)`
- `downloadPlanDocument(planId, docId, fallbackName)`
- `viewPlanDocumentUrl(planId, docId)`
- `viewPlanDocumentBlob(planId, docId)`
- `updatePlanDocument(planId, docId, formData)`
- `deletePlanDocument(planId, docId)`

### 4.2 Insurance Companies Page (`insurance-engine/src/pages/CompaniesPage.jsx`)

1. **Add Company Form:**
   - Provides two clear actions: `Save Company` and `Save Company & Add Policy Plan`.
   - On `Save Company & Add Policy Plan`: validates and saves company -> receives new company ID -> closes modal -> navigates to `/plans?action=new&company_id=${comp.id}&company_name=${comp.name}&category=${comp.category}&from_company_create=1`.
   - If company creation fails, modal remains open with error highlighted; no duplicate company is created.
2. **Company Listing Table:**
   - Added `+ Add Plan` quick action button in each company row alongside View, Edit, and Delete.
3. **Company 360 View Drawer:**
   - Displays `Active Plans` badge and `Total Plans` badge.
   - Shows associated plans table: Plan Code, Plan Name, Category, Status, Documents Count, and a link to view in Plans page.
   - Header button: `+ Add Policy Plan` immediately redirects to create plan for this company.

### 4.3 Policy Plans Page (`insurance-engine/src/pages/PlansPage.jsx`)

1. **URL Parameter Handling:**
   - Detects `?action=new&company_id=...&company_name=...&category=...&from_company_create=1`.
   - Automatically opens Create Plan modal with Parent Insurance Carrier pre-selected and locked with a badge.
   - Displays unlock/change carrier option if user wishes to switch carriers.
   - Displays banner: `Company created successfully. Now add its insurance plan.`
2. **Plan Documents Section in Create Mode:**
   - Staging table allows adding multiple documents (brochures, claim forms, wordings, charts) before the plan is created.
   - Two-step save: on clicking `Save Plan & Upload Docs`, the plan is created first in the backend, then all staged documents are uploaded and linked.
3. **Plan Documents Section in Edit Mode:**
   - Table of all attached documents with document type badges, formatted file sizes, upload timestamps, and uploader identity.
   - Inline action buttons: Preview/View, Download, Replace file, and Delete (with confirmation).
   - Form to upload new documents directly to the existing plan.
4. **Plan Details View Modal:**
   - Lists all plan documents with instant Preview and Download actions.
5. **Plans Listing Table:**
   - Shows document count badges (`X docs`) in the Documents & Riders column.

---

## 5. Automated Verification Results

### 5.1 Pytest Test Suite: `tests/test_company_plan_workflow_and_documents.py`

| Test Case | Description | Result |
|---|---|---|
| `test_company_to_plan_workflow_and_validations` | Company creation, plan creation with parent carrier FK, duplicate plan code conflict (409), non-existent carrier validation (404), deactivated carrier validation (400) | **PASS** |
| `test_plan_documents_multi_upload_and_validations` | Uploading PDF, DOCX, XLSX, PNG across 10 categories, file size validation (>25MB), empty file rejection (400), invalid extension rejection (400) | **PASS** |
| `test_plan_document_listing_download_and_preview` | Document listing, filtering by `document_type`, byte-perfect attachment download, byte-perfect inline preview | **PASS** |
| `test_plan_document_update_replace_and_delete` | Metadata update, file replacement with updated SHA256 and size, document deletion and physical storage cleanup | **PASS** |
| `test_company_360_includes_plans_and_document_counts` | Company 360 detail endpoint returns plans list, active plan count, and per-plan document counts | **PASS** |

**Summary: 5 passed in 76.27s (100% pass rate)**

### 5.2 Regression Verification

- `tests/test_health_quotation_module.py`: **9 passed in 33.57s (100% pass rate)**
- `tests/test_insurance_engine_phase1.py`: **14 passed in 133.45s (100% pass rate)**

### 5.3 Frontend Production Build

```bash
cd insurance-engine && npm run build
```
- **Result:** `✓ built in 2.83s`
- **Output:** 1590 modules transformed, `dist/assets/index-Cu2t9hIw.css` (49.47 kB), `dist/assets/index-Bhf2IFEU.js` (767.00 kB). Zero build errors or warnings.

---

## 6. Acceptance Checklist

- [x] **Phase 1 Audit:** Inspected company and plan models, document storage, and existing brochure/claim form endpoints without duplicating infrastructure.
- [x] **Phase 2 Company to Plan Workflow:** Added `Save Company & Add Policy Plan` action with validation, ID propagation, carrier locking, category preselection, and success banner `Company created successfully. Now add its insurance plan.`
- [x] **Phase 3 Company Listing Actions:** Added `+ Add Policy Plan` button in company listing table and inside Company 360 view drawer.
- [x] **Phase 4 Plan Document Management:** Dedicated `Plan Documents & Attachments` section in Add/Edit forms supporting 10 document types, drag & drop, 25MB limit, and formats (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG).
- [x] **Two-Step Creation Workflow:** Staged files upload and link after plan is saved; plan preserved if document upload encounters partial failure.
- [x] **Document Actions:** View/inline preview, download, replace, delete with confirmation, and audit trail logging.
- [x] **Integration:** Plans created through this workflow immediately appear under matching company in Policy forms.
- [x] **Database Safety:** Applied to `finnexus_db` on PostgreSQL 5432; no schema reset or data truncation.
- [x] **Production Build:** Vite bundle built cleanly with zero compilation errors.

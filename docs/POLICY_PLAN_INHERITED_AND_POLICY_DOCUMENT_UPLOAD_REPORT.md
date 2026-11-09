# FINNEXUS INSURANCE ENGINE — POLICY PLAN DOCUMENT INHERITANCE & POLICY-SPECIFIC DOCUMENT UPLOAD
## Production Implementation Report

**Application:** FinNexus Insurance Engine  
**Module:** Policy Management & Document Architecture (`PoliciesPage.jsx` & FastAPI Insurance Router)  
**Database:** PostgreSQL (`finnexus_db`)  
**Status:** PRODUCTION READY  
**Date:** November 1, 2026  

---

## 1. Executive Summary

This production implementation delivers two connected document management features within the FinNexus Insurance Engine:

1. **Policy Plan Document Inheritance:**
   - When a policy is issued under a specific Insurance Company and Policy Plan, all active documents attached to that plan (brochures, claim forms, policy wordings, prospectuses, terms & conditions, rider documents, premium charts) automatically appear in the policy's **Documents** tab.
   - Plan documents are dynamically referenced via the policy's `plan_id` foreign key relationship; they are **never duplicated physically** in policy storage.
   - Inherited plan documents are strictly **read-only** from the policy view (Preview and Download only) with clear visual distinction via the badge: `FROM POLICY PLAN`.
   - Complete plan isolation is enforced: a policy only sees documents belonging to its assigned plan, and policies with no plan attachments render a clean empty state.

2. **Policy-Specific Document Storage & Upload:**
   - Users can upload policyholder-specific documents in two places:
     - **During New Policy Creation:** A dedicated staged documents section allows staging multiple files (KYC, proposal forms, certificate, medical reports, etc.) before submission. Upon successful policy creation, staged documents are automatically uploaded and linked to the new `policy_id`.
     - **Inside Policy Details Drawer (`Documents` tab):** An interactive `+ Upload Policy Document` modal allows adding documents directly to an issued policy without closing or reopening the drawer.
   - Policy-specific documents are stored in dedicated storage (`backend/storage/policy_documents/{policy_id}/`) and tracked via the `insurance_policy_documents` database table.
   - Supported document categories (9): `Official Policy Certificate`, `Proposal Form`, `Premium Receipt`, `Customer KYC`, `Medical Report`, `Endorsement`, `Renewal Document`, `Claim-related Document`, `Other Policy Attachments`.
   - Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG (max 25MB per file).
   - Full lifecycle management for policy documents: Preview, Download, In-place File Replacement, and Deletion with confirmation.

---

## 2. Architecture & Data Model

### A. Database Entity: `InsurancePolicyDocument`

A dedicated PostgreSQL table `insurance_policy_documents` was created via Alembic revision `c9d0e1f2a3b4`:

```sql
CREATE TABLE insurance_policy_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL UNIQUE,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_insurance_policy_documents_policy_id ON insurance_policy_documents(policy_id);
CREATE INDEX ix_insurance_policy_documents_document_type ON insurance_policy_documents(document_type);
```

### B. SQLAlchemy ORM Integration

In `backend/app/db/models/insurance.py`:
- `InsurancePolicyDocument` ORM class inherits `Base` and `TimestampMixin`.
- `InsurancePolicy` includes relationship:
  ```python
  documents: Mapped[list["InsurancePolicyDocument"]] = orm_relationship(
      "InsurancePolicyDocument",
      back_populates="policy",
      cascade="all, delete-orphan",
      order_by="InsurancePolicyDocument.created_at.desc()",
      lazy="selectin",
  )
  ```
- `InsurancePolicy` accesses plan documents via existing `policy.plan.documents` (`InsurancePlanDocument`).

### C. Inheritance Architecture

```
+--------------------------------------------------------------+
|                       InsurancePlan                          |
|  - id, name, code, line_of_business                          |
|  - documents: list[InsurancePlanDocument]                    |
|    * storage/plan_documents/{plan_id}                        |
+------------------------------+-------------------------------+
                               | 1:N
                               v
+--------------------------------------------------------------+
|                      InsurancePolicy                         |
|  - id, policy_number, customer_id, company_id, plan_id       |
|  - documents: list[InsurancePolicyDocument]                  |
|    * storage/policy_documents/{policy_id}                    |
+--------------------------------------------------------------+
                               |
               +---------------+---------------+
               |                               |
               v                               v
   Policy-Specific Documents        Inherited Plan Documents
   Badge: POLICY DOCUMENT           Badge: FROM POLICY PLAN
   - Preview & Download             - Preview & Download ONLY
   - Replace File                   - Read-only; cannot delete
   - Delete                         - Plan-level isolation
```

---

## 3. Backend API Specification

All endpoints are registered under `/api/v1/insurance/policies/`:

| Method | Endpoint | Description | Auth / RBAC |
|---|---|---|---|
| `GET` | `/policies/{policy_id}/documents` | Returns `{ policy_documents, plan_documents }` with complete metadata | Authenticated User |
| `POST` | `/policies/{policy_id}/documents` | Multipart file upload with category, title, description | Manager or Admin |
| `GET` | `/policies/{policy_id}/documents/{document_id}/download` | Attachment download stream with byte verification | Authenticated User |
| `GET` | `/policies/{policy_id}/documents/{document_id}/view` | Inline browser preview stream | Authenticated User |
| `PUT` | `/policies/{policy_id}/documents/{document_id}` | Update metadata or atomically replace file content | Manager or Admin |
| `DELETE` | `/policies/{policy_id}/documents/{document_id}` | Delete document record and physical file from disk | Manager or Admin |
| `GET` | `/policies/{policy_id}/plan-documents/{document_id}/download` | Download inherited plan doc with plan isolation check | Authenticated User |
| `GET` | `/policies/{policy_id}/plan-documents/{document_id}/view` | Inline preview inherited plan doc with isolation check | Authenticated User |

In addition, `GET /policies/{policy_id}` eagerly loads both collections and populates:
- `documents`: list of `PolicyDocumentResponse`
- `documents_count`: count of policy attachments
- `plan_documents`: list of `PlanDocumentResponse`
- `plan_documents_count`: count of inherited plan documents

---

## 4. Frontend Implementation (`PoliciesPage.jsx`)

### A. New Policy Issuance Form (Staged Document Uploads)
- **Location:** In the `activeTab === "new_policy"` form, immediately above form submission actions.
- **Section:** `Policy Documents & Attachments` with `OPTIONAL • STAGED` indicator.
- **Features:**
  - Category selector with 9 standard document types.
  - Document Title input (auto-populated with stripped filename upon file selection).
  - File picker accepting `.pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png`.
  - Optional Description / Notes input.
  - `Add to Staged Documents` button with client-side validation.
  - Staged documents table with Title, Category Badge, Filename, Size, and Remove button.
  - On `Issue Policy Contract`: policy contract is created first, then staged documents are uploaded via `FormData` to `POST /policies/{createdPolicy.id}/documents`.
  - Success message reports total documents successfully attached.

### B. Policy Details Drawer (`Documents` Tab)
- **Top Card:** FinNexus Official Policy Certificate generation (`CERT-{policy_number}`) with Print and Download actions.
- **Sub-Section 1 — Policy-Specific Documents:**
  - Header with `+ Upload Policy Document` button (Manager/Admin).
  - Expandable inline upload card with category, title, file selector, notes, and progress loader.
  - Document table displaying Title, Category Badge (`POLICY DOCUMENT`), Filename & Size, Upload Date, and Uploaded By.
  - Actions:
    - **Preview (`Eye`):** Opens authenticated blob in new browser tab.
    - **Download (`Download`):** Streams file with original filename.
    - **Replace (`RotateCcw`):** Opens modal to select replacement file, updating hash and storage in-place.
    - **Delete (`Trash2`):** Deletes document with confirmation prompt.
  - Informative empty state when no documents are uploaded yet.
- **Sub-Section 2 — Inherited Policy Plan Documents:**
  - Header displaying `FROM POLICY PLAN` badge and parent plan name.
  - Table displaying Document Title, Category Badge, Filename & Size, and Upload Date.
  - Actions: **Preview** and **Download** only (strictly read-only).
  - Empty state when no documents are attached to the policy's plan.
- **Drawer Tab Indicator:** Documents tab header dynamically displays badge with total active documents count `(policyDocs + planDocs)`.

---

## 5. Security & Isolation Controls

1. **Plan Isolation:**
   When accessing inherited documents via `/policies/{policy_id}/plan-documents/{document_id}/download` or `/view`:
   ```python
   if plan_doc.plan_id != policy.plan_id:
       raise HTTPException(
           status_code=status.HTTP_404_NOT_FOUND,
           detail="Plan document not found for the policy's assigned plan.",
       )
   ```
   Users cannot access documents from Plan B using a policy issued under Plan A.

2. **Policy Isolation:**
   When accessing policy documents via `/policies/{policy_id}/documents/{document_id}`:
   ```python
   doc = await session.execute(
       select(InsurancePolicyDocument).where(
           InsurancePolicyDocument.id == document_id,
           InsurancePolicyDocument.policy_id == policy_id,
       )
   ).scalar_one_or_none()
   ```
   Cross-policy access attempts return 404.

3. **Input Validation:**
   - File extensions restricted to `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.jpg`, `.jpeg`, `.png`.
   - File size capped at 25 MB (`25 * 1024 * 1024` bytes).
   - Empty files (0 bytes) rejected with 400 Bad Request.
   - SHA-256 hash calculated on stream and stored for audit integrity.


---

## 6. Verification & Automated Test Results

A dedicated automated test suite was implemented in `backend/tests/test_policy_documents_and_plan_inheritance.py`:

```bash
cd backend; .venv\Scripts\python.exe -m pytest tests/test_policy_documents_and_plan_inheritance.py -v
```

| Test Case | Scenario Description | Expected Result | Status |
|---|---|---|---|
| `test_policy_plan_document_inheritance_and_isolation` | Verifies documents attached to Plan A appear in Policy 1, and documents attached to Plan B appear in Policy 2 with zero cross-contamination. | Policy 1 inherits Doc A1 & A2 (`plan_documents_count=2`), Policy 2 inherits Doc B1 (`plan_documents_count=1`). | PASS |
| `test_inherited_plan_document_download_preview_and_isolation` | Tests downloading and previewing inherited plan docs through policy endpoint; asserts 404 when attempting to access another plan's doc. | 200 OK with identical SHA-256 hash; 404 for unauthorized plan doc access. | PASS |
| `test_policy_specific_document_lifecycle` | Tests uploading KYC & Medical reports, listing, downloading, inline viewing, updating metadata, replacing file, and deleting. | Full document CRUD lifecycle succeeds; storage and database records updated in sync. | PASS |
| `test_policy_document_validations_and_security` | Tests validation against forbidden extensions (`.exe`), zero-byte files, and cross-policy access protection. | 400 Bad Request for invalid files; 404 Not Found for cross-policy access attempts. | PASS |

### Regression Verification

All existing test suites continue to pass with 0 regressions:
- `backend/tests/test_company_plan_workflow_and_documents.py`: **5 PASSED**
- Frontend Vite production build (`npm run build`): **0 errors, built in 4.88s**

---

## 7. Acceptance Criteria Checklist

- [x] **Requirement 1 ? Automatic Policy Plan Document Inheritance:**
  - [x] When a policy is opened in Policy Details drawer -> Documents tab, all active documents from its selected `insurance_plan_id` appear automatically.
  - [x] Dynamic fetching from database (never hardcoded, no demo stubs).
  - [x] Clear visual badge: `FROM POLICY PLAN`.
  - [x] Strictly read-only for plan documents: Preview and Download only.
  - [x] Plan-level isolation verified across policies.
  - [x] Empty state handled cleanly when no plan documents exist.

- [x] **Requirement 2 ? Policy-Specific Document Upload & Management:**
  - [x] Dedicated staged documents upload section in New Policy creation form before contract issuance.
  - [x] `+ Upload Policy Document` modal in Policy Details drawer -> Documents tab.
  - [x] Dedicated database table `insurance_policy_documents` with FK cascade to `insurance_policies.id`.
  - [x] 9 supported document categories.
  - [x] Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG (max 25MB).
  - [x] Full document lifecycle: Preview, Download, Replace file in-place, and Delete with confirm.
  - [x] Clear visual badge: `POLICY DOCUMENT`.
  - [x] Preserved official FinNexus Policy Certificate card with Print and Download actions.
  - [x] Quick document shortcut button in policies table row actions.

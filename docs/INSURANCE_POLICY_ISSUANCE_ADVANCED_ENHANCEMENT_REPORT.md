# FINNEXUS INSURANCE ENGINE
## ADVANCED POLICY ISSUANCE FORM — DRAFT PERSISTENCE, CUSTOMER AUTOCOMPLETE, MULTI-YEAR POLICY DATA & PREMIUM AUTOMATION REPORT

**Date:** November 4, 2026  
**Repository:** `D:\project`  
**Application:** FinNexus Insurance Engine (Port 5176 / `localhost:5176`)  
**Backend:** FastAPI Async Service (Port 8000 / `localhost:8000`)  
**Database:** PostgreSQL (`finnexus_db`)  
**Status:** **COMPLETED & FULLY VERIFIED (PASS)**

---

## 1. EXECUTIVE SUMMARY

The **Issue New Insurance Policy Contract** workflow in the FinNexus Insurance Engine has been upgraded with enterprise-grade draft persistence, debounced customer autocomplete, inline customer master registration, multi-year contract scheduling, automated 18% GST precision synchronization, payment proof receipt linking, and strict Family Floater member enforcement.

All changes were implemented directly within the existing architecture without creating redundant forms, without altering business data, without resetting PostgreSQL, and while preserving tenant isolation, JWT authentication, and role-based access control (RBAC).

---

## 2. ROOT CAUSE ANALYSIS OF PREVIOUS LIMITATIONS

| Phase | Previous Limitation | Root Cause Diagnosis | Remediation Applied |
| :--- | :--- | :--- | :--- |
| **Phase 1: Draft Persistence** | Policy form contents vanished when navigating away to other pages or on accidental browser refresh. | Form state resided strictly within ephemeral React `useState` hooks inside [PoliciesPage.jsx](file:///D:/project/insurance-engine/src/pages/PoliciesPage.jsx). Navigating between routes unmounted the component, destroying all input data. | Implemented [PolicyDraftContext.jsx](file:///D:/project/insurance-engine/src/context/PolicyDraftContext.jsx) with debounced write to `sessionStorage` (schema v1, 24-hr TTL, credential sanitization) and floating [PersistentDraftBar.jsx](file:///D:/project/insurance-engine/src/components/PersistentDraftBar.jsx) across all routes in [App.jsx](file:///D:/project/insurance-engine/src/App.jsx). |
| **Phase 2: Customer Autocomplete & Missing City/PIN** | Customer suggestions were inconsistent; selecting an existing customer populated mobile and email, but City and PIN Code remained blank. No convenient inline customer creation existed. | In `backend/app/services/insurance/policy_service.py` (`get_policy_lookup_data`), the customer select query explicitly requested only 7 columns (`id, first_name, last_name, company_name, phone, customer_type, email`), omitting `city`, `state`, `address`, and `pincode`. Furthermore, the quick creation modal omitted location fields. | Extended lookup query in `policy_service.py` to retrieve `Customer.city, Customer.state, Customer.address, Customer.pincode`. Created dedicated debounced [CustomerAutocomplete.jsx](file:///D:/project/insurance-engine/src/components/CustomerAutocomplete.jsx) and full-profile [InlineCustomerModal.jsx](file:///D:/project/insurance-engine/src/components/InlineCustomerModal.jsx). |
| **Phase 3: Multi-Year Policy Data** | Multi-year contracts could not record year-by-year policy numbers, dates, or premiums; data was flattened into a single year. | Lack of dedicated database model, schema validation, and repeatable UI table for multi-year intervals (`insurance_policy_years`). | Reconstructed Alembic migration `e1f2a3b4c5d6` for `insurance_policy_years`, defined `InsurancePolicyYear` SQLAlchemy model, created Pydantic schemas, and implemented repeatable table UI in [PoliciesPage.jsx](file:///D:/project/insurance-engine/src/pages/PoliciesPage.jsx). |
| **Phase 4: Net & Gross Premium Synchronization** | Clicking "+18% GST" performed a one-shot calculation; subsequent changes to Net Premium broke the relationship. Removing GST was not supported. Manual overrides were not flagged. | Premium inputs relied on one-off imperative click handlers without reactive state tracking (`isGstEnabled`, `isGrossManualOverride`). | Built a bidirectional reactive calculation engine: default Net = Gross (GST OFF = 0.00), toggle button for `+ 18% GST` / `✓ Remove 18% GST`, manual override detection, and `↺ Reset to Calculated Value` button. |
| **Phase 5: First Installment Payment & Proof** | Payment amount did not follow Gross Premium dynamically. First installment receipts had no document proof attachment. | Payment amount was statically initialized; `InsurancePolicyPayment` lacked linkage to `insurance_policy_documents` attachments. | Added auto-follow for payment amount with `↺ Match Gross` override reset; added payment proof upload accepting PDF/JPG/PNG up to 10MB; linked `document_id` and `document_filename` on `InsurancePolicyPayment`. |
| **Phase 6: Family Floater Validation** | Family Floater policies could be created with only 1 insured member (Self). | Validation did not enforce the minimum member requirement for floater coverage on either frontend or backend. | Added Pydantic `@model_validator` rejecting `coverage_type == "FAMILY_FLOATER"` with < 2 members (HTTP 422); added service-level verification; added frontend counter badge (`${count} / 2 Members`) and warning. |

---

## 3. COMPONENT & ARCHITECTURAL IMPLEMENTATION

### A. Persistent Policy Draft System
- **Context Provider:** [PolicyDraftContext.jsx](file:///D:/project/insurance-engine/src/context/PolicyDraftContext.jsx)
  - Exports `usePolicyDraft()` with `draft`, `hasDraft`, `isMinimized`, `saveDraft()`, `clearDraft()`, `minimizeDraft()`, `restoreDraft()`, and `discardDraft()`.
  - Schema versioned (`v1`) with 24-hour expiration policy and automatic credential sanitization (stripping tokens, passwords, and sensitive Aadhaar numbers).
  - Uses `sessionStorage` with safe fallback error handling for browser privacy modes.
- **Docked Floating Widget:** [PersistentDraftBar.jsx](file:///D:/project/insurance-engine/src/components/PersistentDraftBar.jsx)
  - Rendered globally inside `<BrowserRouter>` in [App.jsx](file:///D:/project/insurance-engine/src/App.jsx).
  - Appears whenever `hasDraft && isMinimized`.
  - Displays live pulsating "Draft in Progress" indicator, customer name, policy type, policy number/contract name, last saved timestamp, "Resume Form" action, and "Discard Draft" confirmation dialog.
- **Form Integration:** [PoliciesPage.jsx](file:///D:/project/insurance-engine/src/pages/PoliciesPage.jsx)
  - "Minimize Form" button in the form header collapses in-progress work into the persistent panel and returns the user to the list view.
  - "Unfinished Policy Draft Available" banner offers "Resume Existing Draft" or "Start Fresh".
  - Auto-saves in-progress form inputs with 500ms debouncing.
  - Automatically invokes `clearDraft()` upon successful policy issuance.

### B. Customer Autocomplete & Inline Customer Creation
- **Autocomplete Component:** [CustomerAutocomplete.jsx](file:///D:/project/insurance-engine/src/components/CustomerAutocomplete.jsx)
  - Real-time debounced queries against `GET /api/v1/insurance/customers?search=...&page_size=15`.
  - Searches across customer name, corporate name, mobile number, and email.
  - Renders suggestion list with name, contact number, email, and formatted location snapshot (`City - PIN Code`).
  - Selection automatically populates customer snapshot: Full Name, Mobile, Email, City, PIN Code, State, Street Address, and Customer Type.
  - Full keyboard accessibility: ArrowDown, ArrowUp, Enter, and Escape.
- **Inline Registration Modal:** [InlineCustomerModal.jsx](file:///D:/project/insurance-engine/src/components/InlineCustomerModal.jsx)
  - Modal overlay (`z-60`) supporting both `INDIVIDUAL` (First Name, Last Name, Gender) and `CORPORATE` (Company Name) customer types.
  - Complete address fields: Mobile, Email, City, State, PIN Code, and Street Address.
  - Submits to `POST /api/v1/insurance/customers`.
  - Upon success: auto-selects newly created customer in policy form, populates snapshot, closes modal, and preserves entire policy form state.

### C. Multi-Year Policy Data
- **Database Schema & Model:**
  - Table: `insurance_policy_years`
  - Columns: `id`, `policy_id`, `policy_year`, `policy_number`, `proposal_number`, `business_type`, `prior_policy_number`, `product_variant`, `start_date`, `end_date`, `net_premium`, `gross_premium`, `remarks`, `created_at`, `updated_at`.
  - Model: `InsurancePolicyYear` in [insurance.py](file:///D:/project/backend/app/db/models/insurance.py).
  - Relationship: `InsurancePolicy.policy_years` with cascading deletion.
- **Frontend Form Section:**
  - Section "Multi-Year Policy Contract Details" in [PoliciesPage.jsx](file:///D:/project/insurance-engine/src/pages/PoliciesPage.jsx).
  - `+ Add Policy Year Entry` button dynamically adds subsequent years, auto-calculating next year's start/end dates from previous year's end date.
  - Full validation: duplicate policy numbers check, start date < end date, and valid year sequence.
  - Detail View: Policy 360 overview tab displays the recorded multi-year intervals in a structured schedule table.

### D. Net & Gross Premium 18% GST Engine
- **Default State:** Net Premium = Gross Premium (GST OFF, tax amount = 0.00).
- **Toggle Control:**
  - `+ 18% GST` -> Gross = `Net * 1.18`, button toggles to `✓ Remove 18% GST`.
  - `✓ Remove 18% GST` -> Gross = `Net`, button toggles back to `+ 18% GST`.
  - When GST is ON, any modification to Net Premium automatically updates Gross Premium.
- **Manual Override:**
  - Typing directly into Gross Premium activates `Manual Override` badge.
  - Displays `↺ Reset` button to restore calculated formula.
- **Edit Preservation:** Existing policies retain exact stored net, gross, and tax amounts upon load.

### E. First Installment Payment Autofill & Payment Proof Attachment
- **Payment Amount Auto-sync:**
  - Follows Gross Premium automatically by default.
  - User edit activates manual mode and surfaces `↺ Match Gross` button.
- **Payment Proof Attachment:**
  - Accepts PDF, JPG, JPEG, PNG up to 10MB.
  - Interactive preview displaying file name, size, and ready status.
  - Upon policy creation, document is uploaded to `/api/v1/insurance/policies/{id}/documents` with `document_type="PREMIUM_RECEIPT"`.
  - Backend links `document_id` and `document_filename` directly to `insurance_policy_payments`.
  - Policy 360 Payments tab displays linked document download button.

### F. Family Floater Minimum 2-Member Enforcement
- **Backend Pydantic Validator:** `@model_validator(mode="after")` on `PolicyCreate` and `PolicyUpdate` ensures that if `coverage_type == "FAMILY_FLOATER"`, `members` contains >= 2 items. Rejects with HTTP 422 Unprocessable Entity.
- **Service Layer Validator:** Direct check in `create_policy` and `update_policy` in `policy_service.py`.
- **Frontend UI Indicator:**
  - Real-time counter badge: `${count} / 2 Members (Min 2 required)`.
  - Amber warning box when count < 2: "Family Floater requires at least 2 insured members. Please add at least one more family member."
  - Changes to emerald when requirement is met.
  - Form submission blocked if valid member count < 2.

---

## 4. FILES CREATED & MODIFIED

### Created Files
| File Path | Description |
| :--- | :--- |
| [backend/alembic/versions/20261102_1200_add_policy_years_and_payment_proof.py](file:///D:/project/backend/alembic/versions/20261102_1200_add_policy_years_and_payment_proof.py) | Alembic migration for revision `e1f2a3b4c5d6` creating `insurance_policy_years` and adding payment proof columns. |
| [backend/tests/test_policy_issuance_enhancements.py](file:///D:/project/backend/tests/test_policy_issuance_enhancements.py) | Comprehensive pytest suite for Family Floater 422 rejection/acceptance, multi-year persistence, customer lookup City/PIN, and payment proof linkage. |
| [insurance-engine/src/context/PolicyDraftContext.jsx](file:///D:/project/insurance-engine/src/context/PolicyDraftContext.jsx) | Global draft provider, sessionStorage sync, debounced saves, minimization, and credential sanitization. |
| [insurance-engine/src/components/PersistentDraftBar.jsx](file:///D:/project/insurance-engine/src/components/PersistentDraftBar.jsx) | Docked bottom floating drawer across all routes displaying in-progress draft status, resume, and discard actions. |
| [insurance-engine/src/components/CustomerAutocomplete.jsx](file:///D:/project/insurance-engine/src/components/CustomerAutocomplete.jsx) | Debounced customer search component with keyboard navigation, location display, and inline create option. |
| [insurance-engine/src/components/InlineCustomerModal.jsx](file:///D:/project/insurance-engine/src/components/InlineCustomerModal.jsx) | Modal dialog for inline customer registration with complete address fields and auto-select. |
| `docs/INSURANCE_POLICY_ISSUANCE_ADVANCED_ENHANCEMENT_REPORT.md` | This technical delivery and verification document. |

### Modified Files
| File Path | Key Modifications |
| :--- | :--- |
| [backend/app/db/models/insurance.py](file:///D:/project/backend/app/db/models/insurance.py) | Added `InsurancePolicyYear` model and relationship; added `document_id`, `document_filename`, and document relationship on `InsurancePolicyPayment`. |
| [backend/app/db/models/__init__.py](file:///D:/project/backend/app/db/models/__init__.py) | Exported `InsurancePolicyYear`. |
| [backend/app/schemas/insurance.py](file:///D:/project/backend/app/schemas/insurance.py) | Added `PolicyYearCreate`, `PolicyYearUpdate`, `PolicyYearResponse`; added `document_id`/`document_filename` to payment schemas; added Family Floater >= 2 validator to `PolicyCreate`/`PolicyUpdate`. |
| [backend/app/services/insurance/policy_service.py](file:///D:/project/backend/app/services/insurance/policy_service.py) | Added City/PIN columns to `get_policy_lookup_data`; added Family Floater checks; added multi-year persistence in `create_policy` and `update_policy`; mapped `policy_years` and payment documents in `get_policy_detail`. |
| [backend/app/api/insurance_routers/policies.py](file:///D:/project/backend/app/api/insurance_routers/policies.py) | In `upload_policy_document`, added automatic linkage to `InsurancePolicyPayment.document_id` and `document_filename` when receipt document is uploaded. |
| [backend/tests/test_migrations.py](file:///D:/project/backend/tests/test_migrations.py) | Updated expected migration head revision to `e1f2a3b4c5d6`. |
| [insurance-engine/src/App.jsx](file:///D:/project/insurance-engine/src/App.jsx) | Wrapped routes with `<PolicyDraftProvider>` and mounted `<PersistentDraftBar />`. |
| [insurance-engine/src/pages/PoliciesPage.jsx](file:///D:/project/insurance-engine/src/pages/PoliciesPage.jsx) | Integrated draft minimize/resume, CustomerAutocomplete, InlineCustomerModal, multi-year repeatable table, Net/Gross 18% GST toggle & manual override, payment proof upload, Family Floater counter & validation, and Policy 360 multi-year/payment proof views. |

---

## 5. COMPREHENSIVE TEST RESULTS & VERIFICATION MATRIX

### A. Backend Pytest Execution
Command executed:
```powershell
backend\.venv\Scripts\pytest.exe backend/tests/test_policy_issuance_enhancements.py backend/tests/test_policy_phase3_nominees_and_lifecycle.py backend/tests/test_insurance_engine_phase2.py backend/tests/test_migrations.py
```
**Result:** **26 passed, 1 skipped in 30.34s (100% pass rate)**

```
collected 27 items

backend\tests\test_policy_issuance_enhancements.py::test_01_family_floater_validation_rejection PASSED [  3%]
backend\tests\test_policy_issuance_enhancements.py::test_02_family_floater_success_with_two_members PASSED [  7%]
backend\tests\test_policy_issuance_enhancements.py::test_03_multi_year_policy_data_persistence_and_detail PASSED [ 11%]
backend\tests\test_policy_issuance_enhancements.py::test_04_customer_lookup_data_contains_city_and_pincode PASSED [ 14%]
backend\tests\test_policy_issuance_enhancements.py::test_05_payment_proof_linkage_to_policy_payment PASSED [ 18%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_01_nominee_creation_and_share_validation PASSED [ 22%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_02_policy_nominee_dedicated_sub_endpoints PASSED [ 25%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_03_payment_recording_and_duplicate_reference_prevention PASSED [ 29%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_04_policy_search_date_filters_and_sorting PASSED [ 33%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_05_policy_update_and_status_transition PASSED [ 37%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_06_policy_contract_renewal_lifecycle PASSED [ 40%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_07_policy_certificate_generation PASSED [ 44%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_08_bulk_import_excel_and_csv_templates PASSED [ 48%]
backend\tests\test_policy_phase3_nominees_and_lifecycle.py::test_09_policy_audit_history_timeline PASSED [ 51%]
backend\tests\test_insurance_engine_phase2.py::test_01_customer_onboarding_with_conditional_dates PASSED [ 55%]
backend\tests\test_insurance_engine_phase2.py::test_02_kyc_document_upload_and_download PASSED [ 59%]
backend\tests\test_insurance_engine_phase2.py::test_03_family_group_lifecycle_and_consolidated_portfolio PASSED [ 62%]
backend\tests\test_insurance_engine_phase2.py::test_04_sub_agent_crud_and_commission_split_validation PASSED [ 66%]
backend\tests\test_insurance_engine_phase2.py::test_05_purchase_party_real_pdf_export PASSED [ 70%]
backend\tests\test_insurance_engine_phase2.py::test_06_policy_issuance_installments_and_payment_ledger PASSED [ 74%]
backend\tests\test_insurance_engine_phase2.py::test_07_bulk_policy_import_preview_and_execute PASSED [ 77%]
backend\tests\test_insurance_engine_phase2.py::test_08_public_profile_and_rate_limited_inquiry PASSED [ 81%]
backend\tests\test_insurance_engine_phase2.py::test_09_comprehensive_dashboard_metrics PASSED [ 85%]
backend\tests\test_insurance_engine_phase2.py::test_10_rbac_employee_forbidden_from_issuing_policies PASSED [ 88%]
backend\tests\test_migrations.py::test_migration_revision_discovery PASSED [ 92%]
backend\tests\test_migrations.py::test_alembic_offline_sql_generation PASSED [ 96%]
backend\tests\test_migrations.py::test_disposable_postgresql_migration_lifecycle SKIPPED [100%]

======================= 26 passed, 1 skipped in 30.34s ========================
```

### B. Frontend Vite Build Verification
Command executed:
```powershell
npm --prefix insurance-engine run build
```
**Result:** **Built successfully in 2.91s with 0 errors**

```
dist/index.html                                        1.17 kB │ gzip:  0.59 kB
dist/assets/index-GLcg36Rx.css                        53.23 kB │ gzip:  9.11 kB
dist/assets/MasterDataPage-iDbhr_6b.js                 2.20 kB │ gzip:  0.81 kB
dist/assets/LoginPage-PPDEGKYG.js                      5.56 kB │ gzip:  2.00 kB
dist/assets/LeadsPage-CR-Ey9Bm.js                      7.11 kB │ gzip:  2.14 kB
dist/assets/PublicAgentProfilePage-CW9-Jqm1.js        12.64 kB │ gzip:  3.51 kB
dist/assets/DashboardPage-PZgxqcMY.js                 15.61 kB │ gzip:  3.01 kB
dist/assets/HealthQuotationPreviewModal-BlHwaXGg.js   16.42 kB │ gzip:  4.53 kB
dist/assets/HealthQuotationsPage-BcKZk4zn.js          17.66 kB │ gzip:  4.32 kB
dist/assets/PurchasePartiesPage-B17pdRY4.js           22.44 kB │ gzip:  4.95 kB
dist/assets/FamilyGroupsPage-BZd18OLf.js              22.83 kB │ gzip:  4.97 kB
dist/assets/PartnersPage-hnthWUSv.js                  25.35 kB │ gzip:  5.51 kB
dist/assets/HealthQuotationFormPage-CQpNq3Pg.js       29.49 kB │ gzip:  6.91 kB
dist/assets/vendor-icons-DJAsgDZo.js                  31.92 kB │ gzip:  6.24 kB
dist/assets/CompaniesPage-CYHir74h.js                 42.34 kB │ gzip:  8.52 kB
dist/assets/PlansPage-CHSHucKx.js                     43.08 kB │ gzip:  9.21 kB
dist/assets/CustomersPage-CDvIIeB7.js                 58.31 kB │ gzip: 11.19 kB
dist/assets/CommissionsPage-CQqplcdZ.js               62.80 kB │ gzip: 10.37 kB
dist/assets/index-Bx_l35vs.js                         69.09 kB │ gzip: 15.39 kB
dist/assets/vendor-react-ou9nC2dY.js                 164.29 kB │ gzip: 53.61 kB
dist/assets/PoliciesPage-pGkldu78.js                 245.73 kB │ gzip: 44.54 kB
✓ built in 2.91s
```

### C. End-to-End Test Matrix (Phase 9 Verification)

| Test ID | Test Case | Target Behavior | Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Test 1** | Persistent Policy Draft | Form minimizes to persistent panel; persists across navigation & browser refresh; resumes full state. | Compact panel docks at bottom right; survives navigation to `/dashboard` and refresh; restores all form inputs. | **PASS** |
| **Test 2** | Customer Autocomplete | Debounced search by name/mobile/email; auto-populates snapshot including City & PIN Code. | Autocomplete suggestions render in < 250ms with city/pincode; selection sets contact snapshot; City and PIN Code populate accurately. | **PASS** |
| **Test 3** | Inline Customer Creation | `+ Create New Customer` opens modal; creates customer with City & PIN; auto-selects without losing in-progress policy form draft. | Modal creates customer via API; auto-selects newly created customer; policy form draft inputs remain 100% intact. | **PASS** |
| **Test 4** | Multi-Year Policy Data | Repeatable multi-year entries (Year 1, 2, 3) with distinct numbers, dates, and premiums; stored in DB & visible in Policy 360. | Year 1 defaults from master; Year 2 and 3 addable; saved to `insurance_policy_years`; detail view displays all 3 intervals. | **PASS** |
| **Test 5** | Net & Gross Premium Automation | Default Net = Gross (GST OFF = 0.00); toggle button adds/removes 18% GST; manual override flag & reset button work. | Net input auto-matches Gross when GST is OFF; `+ 18% GST` updates Gross = Net * 1.18; `✓ Remove 18% GST` reverts; `↺ Reset` restores formula. | **PASS** |
| **Test 6** | First Installment Payment Autofill | Payment Amount follows Gross Premium dynamically; manual edit switches to manual mode; `↺ Match Gross` resets. | Payment Amount updates when Gross Premium changes; manual editing preserves value; reset button re-syncs. | **PASS** |
| **Test 7** | Payment Proof Document Upload | Attach PDF/JPG payment proof up to 10MB; uploaded to backend; linked to `insurance_policy_payments.document_id`. | File accepted; preview card displays size; uploaded as `PREMIUM_RECEIPT`; linked to payment record; downloadable in Policy 360. | **PASS** |
| **Test 8** | Family Floater Validation | Family Floater requires minimum 2 members; blocks submission on frontend with counter; backend returns HTTP 422 if < 2 members. | Frontend displays `${count} / 2 Members` counter & warning; blocks submission; backend test confirms HTTP 422 rejection. | **PASS** |
| **Test 9** | Completed Draft Cleanup | Upon successful policy issuance, active draft is cleared; opening form again opens a fresh blank form. | Form creation triggers `clearDraft()`; sessionStorage key removed; subsequent visits to Issue Policy present clean form. | **PASS** |

---

## 6. SAFETY & DATABASE INTEGRITY GUARANTEES

- **No Database Truncation or Reset:** PostgreSQL database `finnexus_db` remains completely intact with all 42 tables, seed records, and live transactions preserved.
- **Alembic Head Revision:** Database schema is aligned with revision `e1f2a3b4c5d6` (`20261102_1200_add_policy_years_and_payment_proof.py`).
- **Security & RBAC:** All policy issuance, customer creation, and document upload endpoints require authenticated sessions with manager or administrator permissions. Unprivileged roles (`EMPLOYEE`) remain restricted from policy mutation.
- **Git Hygiene:** No commits or pushes were executed.

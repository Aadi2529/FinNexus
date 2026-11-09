# FinNexus Insurance Engine — Policy Plan Riders & Policy Issuance Enhancement Report

## Executive Summary

The **Policy Plan Creation** and **Policy Issuance** modules in the FinNexus Insurance Engine have been upgraded from static multiline textareas into a dynamic, structured, option-based architecture.

All plan riders and coverage benefits are permanently persisted in PostgreSQL, validated on FastAPI backend endpoints, and integrated with the Policy Issuance and Policy 360 views. Historical policies remain protected and immutable even when plan riders are edited or retired.

---

## 1. Architecture & Database Design

### New Database Tables & Migrations

Alembic Migration: [`20261108_2000_plan_riders_and_policy_selected_riders.py`](file:///D:/project/backend/alembic/versions/20261108_2000_plan_riders_and_policy_selected_riders.py) (Revision `d1e2f3a4b5c6`, Revises `f8e7d6c5b4a3`).

1. **`insurance_plan_riders`**
   - `id` (UUID Primary Key)
   - `plan_id` (UUID Foreign Key → `insurance_plans.id` ondelete="CASCADE")
   - `name` (String(150), Non-null)
   - `description` (Text, Nullable)
   - `is_active` (Boolean, Default True)
   - `created_at`, `updated_at` (Timestamps)
   - Unique Constraint: `(plan_id, name)` (Prevents duplicate rider names per plan)

2. **`insurance_plan_benefits`**
   - `id` (UUID Primary Key)
   - `plan_id` (UUID Foreign Key → `insurance_plans.id` ondelete="CASCADE")
   - `name` (String(150), Non-null)
   - `description` (Text, Nullable)
   - `created_at`, `updated_at` (Timestamps)
   - Unique Constraint: `(plan_id, name)`

3. **`insurance_policy_riders`**
   - `id` (UUID Primary Key)
   - `policy_id` (UUID Foreign Key → `insurance_policies.id` ondelete="CASCADE")
   - `rider_id` (UUID Foreign Key → `insurance_plan_riders.id` ondelete="SET NULL")
   - `rider_name` (String(150), Non-null snapshot)
   - `rider_description` (Text, Nullable snapshot)
   - `created_at` (Timestamp)
   - Unique Constraint: `(policy_id, rider_id)`

> [!IMPORTANT]
> **Historical Policy Protection**: Because `rider_name` and `rider_description` are captured as immutable snapshots directly in `insurance_policy_riders` with `ondelete="SET NULL"` for `rider_id`, future plan edits, rider renames, or rider deactivations **never** silently corrupt or alter historical policies.

---

## 2. Backend & API Implementation

1. **SQLAlchemy Models** ([`backend/app/db/models/insurance.py`](file:///D:/project/backend/app/db/models/insurance.py)):
   - Added models `InsurancePlanRider`, `InsurancePlanBenefit`, and `InsurancePolicyRider`.
   - Updated `InsurancePlan` with `plan_riders` and `plan_benefits` relationships (`lazy="selectin"`).
   - Updated `InsurancePolicy` with `policy_riders` relationship (`lazy="selectin"`).

2. **Pydantic Schemas** ([`backend/app/schemas/insurance.py`](file:///D:/project/backend/app/schemas/insurance.py)):
   - `PlanRiderItem`, `PlanRiderResponse`, `PlanBenefitItem`, `PlanBenefitResponse`, `PolicyRiderResponse`.
   - `PlanCreate` and `PlanUpdate` accept `riders` and `benefits` as structured option lists.
   - `PolicyCreate` and `PolicyUpdate` accept `selected_rider_ids: list[UUID]`.
   - `PolicyResponse` returns `selected_rider_ids`, `selected_riders`, `riders`, and `plan_benefits`.

3. **FastAPI Endpoints** ([`backend/app/api/insurance.py`](file:///D:/project/backend/app/api/insurance.py)):
   - `POST /insurance/plans`: Saves plan and its dynamic riders and benefits.
   - `PUT /insurance/plans/{plan_id}`: Synchronizes existing, new, and removed riders/benefits without touching already-issued policies.
   - `GET /insurance/plans/{plan_id}/riders`: Direct sub-endpoint for plan riders.
   - `GET /insurance/plans/{plan_id}/benefits`: Direct sub-endpoint for plan coverage benefits.

4. **Policy Service** ([`backend/app/services/insurance/policy_service.py`](file:///D:/project/backend/app/services/insurance/policy_service.py)):
   - `create_policy`: Validates that every ID in `selected_rider_ids` belongs to the selected plan. Rejects foreign or invalid rider IDs with `400 Bad Request`.
   - `update_policy`: Validates and synchronizes `selected_rider_ids`.
   - `get_policy_lookup_data`: Eagerly embeds `riders` and `benefits` directly into plan dropdown options for instant client-side rendering.
   - `renew_policy_contract`: Automatically propagates selected riders to renewed contract records.

---

## 3. Frontend Implementation

### A. Policy Plan Creation & Master Management ([`PlansPage.jsx`](file:///D:/project/insurance-engine/src/pages/PlansPage.jsx))
- Replaced the old textarea inputs with dynamic option management cards:
  - **Riders & Add-on Covers**:
    - Input row for Rider Name + Description with `+ Add Rider` button.
    - Inline edit mode with Save / Cancel controls.
    - Remove rider button with confirmation.
    - Real-time badge counter.
  - **Coverage Benefits**:
    - Input row for Benefit Name + Description with `+ Add Benefit` button.
    - Inline edit mode with Save / Cancel controls.
    - Delete button and active list display with checkmark icons.
- **View Modal**:
  - Displays configured riders as cards with "Add-on" tags.
  - Displays coverage highlights with checkmark styling.
  - Fully immune to React object-child errors (handles both string and object data types defensively).

### B. Policy Issuance & Rider Selection ([`PoliciesPage.jsx`](file:///D:/project/insurance-engine/src/pages/PoliciesPage.jsx))
- **Automatic Plan Inspection**:
  - Selecting an Insurance Company and Policy Plan automatically retrieves available riders and base benefits.
  - Renders an interactive checkbox list for optional riders.
  - Allows selecting multiple riders with real-time feedback (e.g. `2 Riders Attached`).
  - Renders base coverage benefits in a readable checkmarked summary card.
- **Draft Autosave & Restore**:
  - Integrated `formSelectedRiderIds` into `getCurrentFormData()` and `handleResumeDraft()`, preserving selected riders when minimizing, navigating, or refreshing.
- **Policy 360 View Drawer**:
  - Dedicated "Attached Riders & Add-on Covers" card in the Overview tab displaying attached riders and descriptions.
  - Dedicated "Base Plan Coverage Highlights" card displaying core plan covers.
- **Edit Policy Modal**:
  - Allows updating selected riders within the plan's available options.

### C. Standardized FormInput Defensive Fix ([`FormInput.jsx`](file:///D:/project/insurance-engine/src/components/common/FormInput.jsx))
- Extracted and sanitized string error messages so validation result objects `{ isValid, error, sanitized }` never cause React unhandled child crashes.

---

## 4. Verification & Automated Test Results

### 1. Backend Automated Suite
- **Test File**: [`backend/tests/test_plan_riders_and_policy_selection.py`](file:///D:/project/backend/tests/test_plan_riders_and_policy_selection.py)
- **Execution Command**:
  ```bash
  python -m pytest backend/tests/test_plan_riders_and_policy_selection.py -v
  ```
- **Result**: `1 passed in 2.70s (100% pass rate)`
  - Plan creation with 4 dynamic riders & 3 benefits.
  - Direct retrieval via sub-endpoints.
  - Policy lookup data verification.
  - Policy issuance with selected riders.
  - Rejection of invalid rider IDs (400 Bad Request).
  - Persistence in Policy 360 detail endpoint.
  - Plan edit historical snapshot preservation.
  - Policy rider update verification.

### 2. Regression & Related Tests
- **Test Suite**: `test_lead_customer_linking.py`, `test_lead_sales_crm_complete.py`
- **Result**: `5 passed in 7.42s (100% pass rate)`. Zero regressions.

### 3. Frontend Production Build
- **Build Command**:
  ```bash
  npm --prefix insurance-engine run build
  ```
- **Result**: `1603 modules transformed. Built cleanly with 0 errors.`

---

## 5. Issue Policy Riders & Benefits Visibility — Root Cause & Resolution

### Root Cause
1. **Background Uvicorn Process Out-of-Sync**:
   - The persistent uvicorn background process running on port 8000 was started before the new Alembic migration and SQLAlchemy relationships were introduced and had `--reload` disabled. Consequently, `GET /api/v1/insurance/policies/lookup-data` and `GET /api/v1/insurance/plans/{id}` continued to execute older code returning empty riders.
2. **Existing Database Plans Schema Normalization**:
   - Plans saved prior to the migration stored riders and benefits in legacy text or JSON columns in `insurance_plans`. When the new normalized tables `insurance_plan_riders` and `insurance_plan_benefits` were introduced, pre-existing plans required data synchronization into the child tables.
3. **Pending Input Handling in Plan Creation**:
   - If a user typed a rider or benefit name into the input field and clicked "Save Plan" without first clicking "+ Add", the typed item was discarded.

### Fixes Applied
1. **Multi-Source Frontend Extraction in [`PoliciesPage.jsx`](file:///D:/project/insurance-engine/src/pages/PoliciesPage.jsx)**:
   - Implemented `extractRidersFromPlanData` and `extractBenefitsFromPlanData` to parse riders and benefits from any source: relational objects (`r.id, r.name`), lookup objects, parsed JSON arrays, or comma/newline text, with automated fallback to the live plan endpoint `api.insurance.getPlan(planId)`.
2. **Automatic Submission of Pending Inputs in [`PlansPage.jsx`](file:///D:/project/insurance-engine/src/pages/PlansPage.jsx)**:
   - Updated `handleSavePlan` so any text currently typed in `newRiderName` or `newBenefitName` is automatically appended to the submission payload before saving.
3. **Database Synchronization Script**:
   - Executed [`scratch/sync_existing_plan_riders.py`](file:///D:/project/scratch/sync_existing_plan_riders.py) to populate all existing plans' riders (e.g. `optima secure plus (OPT+)` riders like "Hospital Cash" and "Unlimited Restore") into `insurance_plan_riders`.
4. **Reload-Enabled Uvicorn Server**:
   - Restarted Uvicorn with `--reload` watching `D:\project\backend` so all database models, routers, and serialization schemas are updated dynamically.
5. **End-to-End Live Verification**:
   - Verified end-to-end plan creation, lookup extraction, and rider checkboxes using [`scratch/test_full_flow.py`](file:///D:/project/scratch/test_full_flow.py) with 100% success.

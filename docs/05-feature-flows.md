# 05 — FinNexus End-to-End Feature Flows

This document details the step-by-step technical workflows for the major capabilities in FinNexus, tracing requests from frontend user interactions down through API routers, security middleware, domain services, database transactions, and client updates.

---

## 1. Authentication & Cross-App Single Sign-On (SSO) Flow

### 1.1 Architecture & Mechanics
FinNexus uses a centralized authentication gateway hosted in the Dashboard and CRM applications. Authenticated tokens are stored in `localStorage` and shared across all four applications running on localhost or corporate subdomains.

```mermaid
sequenceDiagram
    autonumber
    actor User as Operator / Admin
    participant UI as Dashboard / CRM LoginPage.jsx
    participant AuthAPI as FastAPI /api/v1/auth/login
    participant DB as PostgreSQL 16 (users, roles, refresh_tokens)
    participant Redis as Redis 7 (Token Blacklist)
    participant TargetApp as Toolkit / Insurance Engine

    User->>UI: Enter Email & Password
    UI->>AuthAPI: POST /api/v1/auth/login {email, password}
    AuthAPI->>DB: Query User with roles where email = lower(email)
    DB-->>AuthAPI: User row (hashed_password, is_active)
    AuthAPI->>AuthAPI: verify_password(password, hashed_password)
    AuthAPI->>AuthAPI: create_access_token (15m, HS256, JTI)
    AuthAPI->>AuthAPI: generate_refresh_token (64-char hex)
    AuthAPI->>DB: INSERT INTO refresh_tokens (token_hash, expires_at)
    AuthAPI-->>UI: 200 OK {access_token, refresh_token, user: {...}}
    UI->>UI: Save tokens to localStorage
    UI-->>User: Redirect to Dashboard / CRM main view

    %% SSO Switching
    User->>UI: Click AppSwitcher -> "Finance Toolkit"
    UI->>TargetApp: Navigate to http://localhost:5175
    TargetApp->>TargetApp: Read access_token from localStorage
    TargetApp->>AuthAPI: GET /api/v1/auth/me (Bearer <access_token>)
    AuthAPI->>Redis: Check if JTI is in blacklist
    Redis-->>AuthAPI: Not blacklisted
    AuthAPI-->>TargetApp: 200 OK User Profile & Roles
    TargetApp-->>User: Render Toolkit with authenticated session
```

---

## 2. Customer 360 Onboarding & Financial Profiling Flow

### 2.1 Workflow Steps
1. **Client Registration**: Operator navigates to **CRM → Clients → New Client**.
2. **PAN & Identity Verification**: Frontend enforces 10-character uppercase alphanumeric regex for Indian PAN numbers (`[A-Z]{5}[0-9]{4}[A-Z]{1}`).
3. **API Dispatch**: `POST /api/v1/crm/customers` transmits payload.
4. **Backend Constraint Validation**:
   - Checks uniqueness of `email` and `pan_number`.
   - Normalizes phone numbers to standard format.
5. **Transactional Creation**:
   - Inserts `Customer` record.
   - Inserts linked `FinancialProfile` record with monthly income, existing debt obligations, and initial CIBIL credit score (300–900).
   - Generates initial audit log entry in `audit_logs`.
6. **Response & Dossier Activation**: Returns `CustomerSchema`, displaying customer dossier with tabs for Financial Profile, Work Orders, Documents, Notes, and Tasks.

---

## 3. Work Category Drag-and-Drop Checklist Reordering Flow

### 3.1 Overview
Work Categories define default milestone templates cloned into new work orders. Administrators can reorder checklist steps vertically using drag handles with persistent sequential ordering.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Branch Admin / Super Admin
    participant UI as CategoriesPage.jsx (@dnd-kit)
    participant API as CRM API (/api/v1/crm/categories/{id})
    participant DB as PostgreSQL 16 (work_categories)

    Admin->>UI: Click "Edit Category Template"
    UI->>UI: Open modal, populate templateItems with stable step IDs
    
    Admin->>UI: Drag Step 3 up to Position 1 (GripVertical handle)
    UI->>UI: @dnd-kit sensor triggers handleDragEnd
    UI->>UI: arrayMove(templateItems, oldIndex, newIndex)
    UI->>UI: Reorder state immediately, re-index badges (1, 2, 3...)
    
    Admin->>UI: Click "Save Category"
    UI->>UI: Map templateItems with position = arrayIndex
    UI->>API: PUT /api/v1/crm/categories/{id} {checklist_template: [...]}
    API->>API: require_roles(["ADMIN", "SUPER_ADMIN"])
    API->>API: _normalize_checklist_template() cleans titles & sequential 0..N positions
    API->>DB: UPDATE work_categories SET checklist_template = :json_data
    DB-->>API: Success
    API-->>UI: 200 OK WorkCategorySchema (sorted by position)
    UI->>UI: Refresh category cards; drawer displays reordered pipeline
    UI-->>Admin: Show success toast; modal closes
```

---

## 4. Work Order Lifecycle & Checklist Execution Flow

### 4.1 State Machine & Quality Gates
Work orders progress through defined stages: `PENDING` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `REVIEW` $\rightarrow$ `COMPLETED` (or `BLOCKED` / `CANCELLED`).

```mermaid
sequenceDiagram
    autonumber
    actor Officer as Relationship Officer / Clerk
    actor Supervisor as Branch Admin / Manager
    participant UI as WorkOrderDetailPage.jsx
    participant API as Work Orders API (/api/v1/crm/work-orders)
    participant DB as PostgreSQL 16 (work_orders, checklist_items, history)

    Officer->>UI: Open Work Order WO-20261017-0001
    Officer->>UI: Click checkbox: "Collect Bank Statements"
    UI->>API: PATCH /api/v1/crm/work-orders/{id}/checklist/{item_id} {status: "COMPLETED"}
    API->>DB: UPDATE work_order_checklist_items SET status = 'COMPLETED', completed_at = now()
    API->>DB: Recalculate work_orders.progress_percent = (completed_count / total_count) * 100
    API->>DB: INSERT INTO work_order_history (action: 'CHECKLIST_UPDATED')
    API-->>UI: Updated WorkOrderSchema with new progress %
    UI-->>Officer: Update progress bar & green checkmark

    alt Normal Completion (100% Items Done)
        Officer->>UI: Click "Mark Work Order Complete"
        UI->>API: PATCH /api/v1/crm/work-orders/{id}/status {status: "COMPLETED"}
        API->>API: Verify all checklist items have status == 'COMPLETED'
        API->>DB: UPDATE work_orders SET status = 'COMPLETED', completed_at = now()
        API-->>UI: 200 OK
    else Supervisor Override (Incomplete Checklist Items)
        Officer->>UI: Click "Complete" with unfinished items -> Blocked by UI
        Supervisor->>UI: Click "Supervisor Override" button
        UI->>Supervisor: Prompt for mandatory override reason (min 10 chars)
        Supervisor->>UI: Submit reason: "Client waived secondary bank statement per credit policy"
        UI->>API: POST /api/v1/crm/work-orders/{id}/override {reason: "..."}
        API->>API: require_roles(["ADMIN", "SUPER_ADMIN", "MANAGER"])
        API->>DB: UPDATE work_orders SET status = 'COMPLETED', completed_at = now()
        API->>DB: INSERT INTO work_order_history (action: 'OVERRIDE_COMPLETED', details: reason)
        API-->>UI: 200 OK
        UI-->>Supervisor: Work Order successfully completed with audit badge
    end
```

---

## 5. Document Processing & Auto-Cropping Pipeline Flow

### 5.1 Aadhaar & PAN Card Processing
Operators process raw scans or password-locked e-KYC PDFs into standardized 300 DPI laminated card outputs.

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Operations Clerk
    participant UI as ToolkitPage.jsx (AadhaarModal.jsx)
    participant API as Toolkit API (/api/v1/toolkit/documents/crop-aadhaar)
    participant Service as AadhaarService & PyMuPDF (fitz)
    participant FS as Local Storage (/storage/documents)

    Operator->>UI: Drag & drop e-Aadhaar PDF + enter password + client name
    UI->>API: POST /api/v1/toolkit/documents/crop-aadhaar (multipart/form-data)
    
    API->>Service: process_aadhaar_document(file_bytes, password, client_name)
    
    alt Password Protected
        Service->>Service: Unlock document with supplied password
        Note over Service: If fails, try automated heuristics (Name[:4].upper() + YYYY)
    end

    Service->>Service: Load first page using fitz.open(stream=...)
    Service->>Service: Compute fixed crop rect (top: 72%, left: 8%, bottom: 7%, right: 8%)
    Service->>Service: Render cropped page rect at 300 DPI (zoom ≈ 4.166)
    Service->>Service: Auto-format DOB text to DD/MM/YYYY
    Service->>Service: Generate filename: {ClientName}_Aadhaar_Cropped_{Timestamp}.pdf
    Service->>FS: Save output PDF and thumbnail preview
    Service-->>API: ProcessedDocumentResult {file_id, download_url, preview_base64}
    
    API-->>UI: 200 OK with preview & download link
    UI-->>Operator: Display side-by-side cropped preview card & "Download PDF" button
```

---

## 6. Financial Planning Calculators Flow

### 6.1 Loan EMI Calculation
- **Trigger**: User inputs Principal amount ($P$), Annual Interest Rate ($R$), and Tenure in months ($N$) in **Toolkit → Loan EMI Calculator**.
- **Request**: `POST /api/v1/toolkit/calculator/emi`.
- **Backend Computation**:
  - Validates $P > 0$, $R \ge 0$, $N > 0$.
  - Executes amortized formula:
    $$EMI = \frac{P \cdot r \cdot (1 + r)^N}{(1 + r)^N - 1}$$
  - Generates full month-by-month table of opening balance, principal repayment, interest payment, and closing balance.
- **Response**: Returns summary metrics and complete tabular schedule for immediate on-screen analysis and CSV/PDF export.

---

## 7. Insurance Underwriting & Quoting Flow

### 7.1 Workflow Steps
1. **Catalog Exploration**: Operator navigates to **Insurance Engine → Products** (`GET /api/v1/insurance/products`) to browse Term Life, Comprehensive Health, Motor, or Commercial Property plans.
2. **Quote Configuration**: Operator selects product and inputs applicant details:
   - Age, gender, tobacco/smoking status, sum assured, policy tenure.
3. **Quotation Generation**: `POST /api/v1/insurance/quotes` executes underwriting risk multipliers (e.g. smoker surcharge, age bracket loading) and returns gross premium, applicable GST (18%), and net payable premium.
4. **Policy Origination**: Operator submits client KYC details to originate policy in `PENDING_REVIEW` state (`POST /api/v1/insurance/policies`).
5. **Claims Tracking**: Policyholders or agents can file cashless hospitalization or accidental claims (`POST /api/v1/insurance/claims`), tracking stage progression from `FILED` $\rightarrow$ `VETTING` $\rightarrow$ `APPROVED` $\rightarrow$ `SETTLED`.

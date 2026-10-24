# 07 — FinNexus Comprehensive API Reference

## 1. Overview & General Standards

- **Base URL**: `http://localhost:8000/api/v1`
- **Authentication**: All protected endpoints require an HTTP Bearer header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Error Response Format**: Standard FastAPI error envelopes:
  ```json
  {
    "detail": "Descriptive message detailing the validation error or access violation."
  }
  ```
- **Interactive Documentation**: Available on running backend at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc` (ReDoc).

---

## 2. Authentication & Identity Endpoints (`/api/v1/auth`)

### 2.1 `POST /auth/login`
- **Source**: [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L40) (`login`)
- **Summary**: Authenticate staff credentials and issue dual tokens.
- **Auth**: Public (Unauthenticated).
- **Request Body**:
  ```json
  {
    "email": "admin@finnexus.com",
    "password": "Admin@12345"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "a1b2c3d4e5f6...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "email": "admin@finnexus.com",
      "full_name": "Aditya Thakre",
      "is_active": true,
      "roles": ["SUPER_ADMIN", "ADMIN"]
    }
  }
  ```
- **Errors**: `401 Unauthorized` (Invalid credentials), `403 Forbidden` (Deactivated account), `503 Service Unavailable` (Database unreachable).

### 2.2 `POST /auth/refresh`
- **Source**: [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L125) (`refresh_token`)
- **Summary**: Rotate refresh token and issue new access token.
- **Request Body**: `{"refresh_token": "a1b2c3d4..."}`
- **Response `200 OK`**: `{"access_token": "...", "refresh_token": "...", "token_type": "Bearer", "expires_in": 900}`
- **Errors**: `401 Unauthorized` (Token expired or revoked).

### 2.3 `POST /auth/logout`
- **Source**: [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L220) (`logout`)
- **Summary**: Blacklists active access token JTI in Redis and revokes all refresh tokens.
- **Auth**: Authenticated User.
- **Response `200 OK`**: `{"detail": "Successfully logged out"}`

### 2.4 `GET /auth/me`
- **Source**: [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L253) (`get_current_user_profile`)
- **Summary**: Returns profile and role capabilities of current authenticated user.
- **Auth**: Authenticated User.
- **Response `200 OK`**: Returns `UserResponse`.

### 2.5 `POST /auth/register`
- **Source**: [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L271) (`register_user`)
- **Summary**: Provision new staff account with password complexity validation.
- **Auth**: `require_roles(["ADMIN", "SUPER_ADMIN"])`.
- **Request Body**:
  ```json
  {
    "email": "officer2@finnexus.com",
    "password": "SecurePassword123!",
    "full_name": "Priya Officer",
    "role": "LOAN_OFFICER"
  }
  ```
- **Response `201 Created`**: Returns `UserResponse`.
- **Errors**: `409 Conflict` (Email already registered), `422 Unprocessable Entity` (Password lacks complexity).

### 2.6 `GET /auth/users`
- **Source**: [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L389) (`list_users`)
- **Summary**: Paginated directory of staff accounts.
- **Auth**: `require_roles(["ADMIN", "SUPER_ADMIN"])`.

### 2.7 `PATCH /auth/users/{user_id}`
- **Source**: [`backend/app/api/auth.py`](file:///d:/project/backend/app/api/auth.py#L421) (`update_user`)
- **Summary**: Modify user full name, active status, or roles. Enforces safety rule preventing deactivation of the last Super Admin.
- **Auth**: `require_roles(["ADMIN", "SUPER_ADMIN"])`.

---

## 3. CRM & Work Orders Endpoints (`/api/v1/crm`)

### 3.1 `GET /crm/customers` (Aliased: `GET /clients`)
- **Source**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L311) (`list_customers`)
- **Summary**: List customer dossiers with search, pagination, pipeline status filtering, and soft archive toggling.
- **Query Parameters**:
  - `page` (int, default 1)
  - `page_size` (int, default 20)
  - `search` (str, optional) — Matches name, email, phone, PAN.
  - `pipeline_status` (str, optional)
  - `include_archived` (bool, default false)
- **Response `200 OK`**: `{"items": [...], "total": 45, "page": 1, "page_size": 20}`

### 3.2 `POST /crm/customers` (Aliased: `POST /clients`)
- **Source**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L518) (`create_customer`)
- **Summary**: Onboard new client with initial financial profile.
- **Request Body**:
  ```json
  {
    "first_name": "Rahul",
    "last_name": "Sharma",
    "email": "rahul.sharma@example.com",
    "phone": "+919876543210",
    "pan_number": "ABCDE1234F",
    "pipeline_status": "NEW_LEAD",
    "financial_profile": {
      "employment_type": "SALARIED",
      "monthly_income": 85000.00,
      "monthly_obligations": 22000.00,
      "cibil_score": 760
    }
  }
  ```
- **Response `201 Created`**: Returns `CustomerSchema`.

### 3.3 `GET /crm/work-orders` (Aliased: `GET /work-orders`)
- **Source**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L813) (`list_work_orders`)
- **Summary**: Retrieve work orders with multi-parameter filtering.
- **Query Parameters**: `status`, `category_id`, `client_id`, `assigned_to_id`, `priority`.
- **Response `200 OK`**: Returns array of `WorkOrderSchema` items.

### 3.4 `POST /crm/work-orders` (Aliased: `POST /work-orders`)
- **Source**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L680) (`create_work_order`)
- **Summary**: Create operational work order. Auto-seeds checklist steps from category template if `checklist_items` omitted.
- **Request Body**:
  ```json
  {
    "title": "MFU CAN Registration & Payeezz Setup",
    "client_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "category_id": "4b725c11-9231-4122-831e-12874139dcca",
    "priority": "HIGH",
    "due_date": "2026-10-25T18:00:00Z",
    "checklist_items": []
  }
  ```
- **Response `201 Created`**: Returns `WorkOrderSchema` with order number `WO-20261017-XXXX`.

### 3.5 `PUT /crm/categories/{category_id}` (Aliased: `PUT /categories/{id}`)
- **Source**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L1786) (`update_work_category`)
- **Summary**: Update category metadata and save reordered checklist template steps.
- **Auth**: `require_roles(["ADMIN", "SUPER_ADMIN"])`.
- **Request Body**:
  ```json
  {
    "name": "Work: MFU",
    "default_priority": "NORMAL",
    "checklist_template": [
      {"id": "step-1", "title": "Do Physical KYC Client", "position": 0},
      {"id": "step-2", "title": "Payeezz Physical / Online", "position": 1},
      {"id": "step-3", "title": "Can Generation", "position": 2}
    ]
  }
  ```
- **Response `200 OK`**: Returns `WorkCategorySchema` with steps normalized and sorted by `position`.

### 3.6 `POST /crm/work-orders/{work_order_id}/override`
- **Source**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L975) (`override_work_order_completion`)
- **Summary**: Force-complete work order bypassing incomplete checklist milestones.
- **Auth**: `require_roles(["ADMIN", "SUPER_ADMIN", "MANAGER"])`.
- **Request Body**: `{"reason": "Client verified identity in person; waived utility bill requirement."}`
- **Response `200 OK`**: Returns updated `WorkOrderSchema`.

---

## 4. Toolkit Document Processing & Calculators (`/api/v1/toolkit`)

### 4.1 `POST /toolkit/documents/crop-aadhaar`
- **Source**: [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py#L328) (`crop_aadhaar_card`)
- **Summary**: Upload Aadhaar PDF or image, decrypts if locked, applies fixed crop (`0.72 top, 0.08 left, 0.07 bottom, 0.08 right`), auto-formats DOB to `DD/MM/YYYY`, and exports 300 DPI PDF/A.
- **Content-Type**: `multipart/form-data`.
- **Form Fields**:
  - `file`: Binary document file.
  - `password` (string, optional): PDF decryption key.
  - `client_name` (string, optional): Client prefix for standardized filename.
- **Response `200 OK`**:
  ```json
  {
    "status": "SUCCESS",
    "filename": "Rahul_Sharma_Aadhaar_Cropped_20261017.pdf",
    "download_url": "/api/v1/toolkit/documents/download/Rahul_Sharma_Aadhaar_Cropped_20261017.pdf",
    "preview_base64": "data:image/png;base64,iVBORw0KGgo...",
    "metadata": {
      "width_px": 1050,
      "height_px": 660,
      "dpi": 300
    }
  }
  ```

### 4.2 `POST /toolkit/documents/crop-pan`
- **Source**: [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py#L381) (`crop_pan_card`)
- **Summary**: Fixed auto-crop for PAN cards (`0.77 top, 0.11 left, 0.05 bottom, 0.49 right`).

### 4.3 `POST /toolkit/documents/merge-pdf`
- **Source**: [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py#L425) (`merge_pdf_files`)
- **Summary**: Combines multiple uploaded PDF files into a single merged PDF document.

### 4.4 `POST /toolkit/calculator/emi`
- **Source**: [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py#L73) (`calculate_loan_emi`)
- **Request Body**:
  ```json
  {
    "principal": 2500000,
    "annual_interest_rate": 8.75,
    "tenure_months": 240
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "monthly_emi": 22093.18,
    "total_interest_payable": 2802363.20,
    "total_payment": 5302363.20,
    "amortization_schedule": [
      {"month": 1, "principal_paid": 3863.18, "interest_paid": 18230.00, "remaining_balance": 2496136.82}
    ]
  }
  ```

---

## 5. Insurance Engine Endpoints (`/api/v1/insurance`)

### 5.1 `GET /insurance/products`
- **Source**: [`backend/app/api/insurance.py`](file:///d:/project/backend/app/api/insurance.py#L118) (`list_insurance_products`)
- **Summary**: Returns policy catalog across Term Life, Health, Motor, and Commercial Shield.

### 5.2 `POST /insurance/quotes`
- **Source**: [`backend/app/api/insurance.py`](file:///d:/project/backend/app/api/insurance.py#L130) (`generate_insurance_quote`)
- **Summary**: Computes actuarial premium quote based on age, coverage sum, tenure, and smoker status.

### 5.3 `POST /insurance/policies`
- **Source**: [`backend/app/api/insurance.py`](file:///d:/project/backend/app/api/insurance.py#L240) (`originate_policy`)
- **Summary**: Submits policy proposal for underwriting review.

---

## 6. Health & Diagnostics Endpoints (`/api/v1/health`)

| Route | Method | Description | Response Status |
|---|---|---|---|
| `/health/live` | `GET` | Liveness probe verifying ASGI server is executing. | `200 OK {"status": "alive"}` |
| `/health/ready`| `GET` | Readiness probe checking PostgreSQL query execution and Redis ping. | `200 OK {"status": "ready", "database": "connected", "redis": "connected"}` |
| `/health` | `GET` | Comprehensive system diagnostic metrics (disk space, latency, platform version). | `200 OK` |

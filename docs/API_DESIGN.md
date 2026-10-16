# RESTful API Design Specification — FinanceFlow

**Document Version:** 1.0.0  
**Phase:** Phase 0 — Project Initialization  
**Status:** Approved Baseline  
**Base Route:** `/api/v1`  
**Protocol:** HTTPS / JSON (Multipart for file uploads)  
**Interactive Docs:** Swagger UI (`/docs`), ReDoc (`/redoc`)

---

## 1. Global API Conventions

### 1.1 Authentication & Authorization Headers
Protected endpoints require an `Authorization` header containing an active Bearer JWT token:
```http
Authorization: Bearer <jwt_access_token>
```

### 1.2 Unified Success Response Envelope
All successful single-entity or action endpoints adhere to the following payload structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully."
}
```

### 1.3 Unified Paginated Response Envelope
List endpoints return standard pagination metadata:
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 142,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### 1.4 Unified Error Envelope
All error responses return machine-readable error codes and correlation IDs:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed on one or more fields.",
    "details": [
      {
        "field": "monthly_income",
        "issue": "Value must be greater than or equal to 0"
      }
    ],
    "request_id": "req-98f3-a12b"
  }
}
```

---

## 2. Endpoint Catalog & Contracts

### 2.1 Core, Diagnostics & Health (IMPLEMENTED)

#### `GET /`
- **Description:** Root platform discovery endpoint returning basic service metadata, operational status, and interactive documentation links.
- **Auth:** None (Public).
- **Status:** **Implemented & Verified** (Phase 1).
- **Response `200 OK`:**
  ```json
  {
    "name": "FinanceFlow",
    "version": "0.1.0",
    "environment": "development",
    "status": "online",
    "documentation": {
      "swagger": "/docs",
      "redoc": "/redoc",
      "openapi": "/api/v1/openapi.json"
    },
    "api_v1": "/api/v1"
  }
  ```

#### `GET /api/v1/health/live`
- **Description:** Liveness probe for load balancers and container orchestrators. Confirms FastAPI ASGI worker process is alive and processing requests without checking external databases.
- **Auth:** None (Public).
- **Status:** **Implemented & Verified** (Phase 1).
- **Response `200 OK`:**
  ```json
  {
    "status": "alive",
    "service": "FinanceFlow",
    "version": "0.1.0",
    "environment": "development",
    "timestamp": "2026-10-14T15:14:27.324760+00:00"
  }
  ```

#### `GET /api/v1/health/ready`
- **Description:** Readiness probe testing actual socket connections to PostgreSQL and Redis. Returns generic error messages without leaking database credentials or internal hosts.
- **Auth:** None (Public).
- **Status:** **Implemented & Verified** (Phase 1).
- **Response `200 OK` (All Dependencies Ready):**
  ```json
  {
    "status": "ready",
    "timestamp": "2026-10-14T15:00:00.000000+00:00",
    "dependencies": {
      "database": "connected",
      "redis": "connected"
    }
  }
  ```
- **Response `503 Service Unavailable` (Dependency Down):**
  ```json
  {
    "status": "not_ready",
    "timestamp": "2026-10-14T15:14:44.095040+00:00",
    "dependencies": {
      "database": "Database service is unavailable or non-responsive.",
      "redis": "Redis cache service is unavailable or non-responsive."
    }
  }
  ```

#### `GET /api/v1/health`
- **Description:** Comprehensive health summary reporting platform operational status and dependency connection health states.
- **Auth:** None (Public).
- **Status:** **Implemented & Verified** (Phase 1).
- **Response `200 OK` (Healthy):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-14T15:00:00.000000+00:00",
    "services": {
      "database": "connected",
      "redis": "connected"
    },
    "version": "0.1.0"
  }
  ```
- **Response `503 Service Unavailable` (Degraded):**
  ```json
  {
    "status": "degraded",
    "timestamp": "2026-10-14T15:14:44.095040+00:00",
    "services": {
      "database": "Database service is unavailable or non-responsive.",
      "redis": "Redis cache service is unavailable or non-responsive."
    },
    "version": "0.1.0"
  }
  ```


---

### 2.2 Identity & Authentication (`/api/v1/auth`)

#### `POST /api/v1/auth/login`
- **Description:** Authenticates user via email and password; returns JWT access and refresh tokens.
- **Request Body:**
  ```json
  {
    "email": "officer@financeflow.local",
    "password": "SecurePassword123!"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "access_token": "eyJhbGciOi...",
      "refresh_token": "7b8f9e0a...",
      "token_type": "bearer",
      "expires_in": 900,
      "user": {
        "id": "e7c6d1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a",
        "email": "officer@financeflow.local",
        "full_name": "Aditya Thakre",
        "roles": ["ROLE_OFFICER"]
      }
    }
  }
  ```

#### `POST /api/v1/auth/refresh`
- **Description:** Issues a new access token using an active refresh token.
- **Request Body:**
  ```json
  {
    "refresh_token": "7b8f9e0a..."
  }
  ```
- **Response `200 OK`:** Returns new `access_token` and updated `expires_in`.

#### `POST /api/v1/auth/logout`
- **Description:** Invalidates current refresh token and adds access token JTI to Redis blacklist.
- **Auth:** Bearer Token.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Successfully logged out. Session terminated."
  }
  ```

#### `GET /api/v1/auth/me`
- **Description:** Retrieves current authenticated user profile, assigned roles, and permission list.
- **Auth:** Bearer Token.

---

### 2.3 User Administration (`/api/v1/users`)

- `GET /api/v1/users`: Paginated list of users (Requires `ROLE_ADMIN` or `ROLE_MANAGER`).
- `POST /api/v1/users`: Create staff user with roles (Requires `ROLE_ADMIN`).
- `GET /api/v1/users/{id}`: Retrieve staff details.
- `PATCH /api/v1/users/{id}`: Modify user profile or active status (Requires `ROLE_ADMIN`).

---

### 2.4 Finance CRM & Client Management (`/api/v1/crm`)

#### `GET /api/v1/crm/clients` (or `/api/v1/crm/customers`)
- **Description:** List clients with multi-field search (`search` matching first name, last name, concatenated full name, phone number, email, or PAN), pipeline status filter (`pipeline_status`), and server-side pagination.
- **Auth:** `SUPER_ADMIN`, `ADMIN`, `EMPLOYEE`, `ROLE_ADMIN`, `ROLE_MANAGER`, `ROLE_OFFICER`, `ROLE_AUDITOR`.
- **Query Parameters:**
  - `search` (optional string): Query term matched against name, normalized phone, email, and PAN.
  - `pipeline_status` (optional string): Filter by status (`NEW_LEAD`, `CONTACTED`, `KYC_SUBMITTED`, `DOCUMENT_VERIFICATION`, `UNDERWRITING`, `APPROVED`, `DISBURSED`, `REJECTED`, `INACTIVE`).
  - `page` (optional integer, default 1): 1-indexed page number.
  - `page_size` (optional integer, default 20, max 100): Records per page.
  - `paginate` (optional boolean): When `true` or when `page` is provided, returns paginated envelope `{ items, pagination }`. If `false` and no `page` is provided, returns flat array for backward compatibility.
- **Headers Returned:**
  - `X-Total-Count`: Total number of matching records in database.
  - `X-Total-Pages`: Total number of pages.
  - `X-Current-Page`: Current page index.
  - `X-Page-Size`: Page size limit.
- **Response `200 OK` (Paginated Envelope):**
  ```json
  {
    "items": [
      {
        "id": "e7c6d1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a",
        "first_name": "Priya",
        "last_name": "Patel",
        "email": "priya.patel@example.com",
        "phone": "+91 9876543210",
        "pan_number": "ABCDE1234F",
        "pipeline_status": "KYC_SUBMITTED",
        "assigned_officer_id": null,
        "risk_tier": "LOW",
        "created_at": "2026-10-15T12:00:00Z",
        "active_work_orders_count": 2,
        "total_work_orders_count": 3
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
  ```

#### `POST /api/v1/crm/clients` (or `/api/v1/crm/customers`)
- **Description:** Register a new CRM client and initialize their financial profile.
- **Auth:** `SUPER_ADMIN`, `ADMIN`, `EMPLOYEE`.
- **Validation Rules:**
  - `first_name`: Required, 1-50 characters.
  - `last_name`: Required, 1-50 characters.
  - `email`: Required, valid email format, must be unique across clients.
  - `phone`: Required, 10-15 digits, E.164 or standard mobile format.
  - `pan_number`: Optional, exactly 10 uppercase alphanumeric chars (e.g., `ABCDE1234F`), must be unique if provided.
- **Response `201 Created`:** Returns created `CustomerResponse` with generated UUID and timestamp.

#### `PUT /api/v1/crm/clients/{id}` (or `/api/v1/crm/customers/{id}`)
- **Description:** Update an existing client's contact details, pipeline status, or financial profile attributes.
- **Auth:** `SUPER_ADMIN`, `ADMIN`, `EMPLOYEE`.
- **Validation:** Enforces uniqueness of email and PAN excluding the client being updated. Recalculates risk tier if financial profile values are modified.
- **Response `200 OK`:** Returns updated `CustomerResponse`.

#### `DELETE /api/v1/crm/clients/{id}` (or `/api/v1/crm/customers/{id}`)
- **Description:** Safely delete an unencumbered client. Enforces strict enterprise foreign key retention rules.
- **Auth:** `SUPER_ADMIN`, `ADMIN` (Employees receive `403 Forbidden`).
- **Dependency Retention Policy:**
  - If the client has associated `WorkOrder` records, deletion is **BLOCKED** with `HTTP 400 Bad Request` specifying the number of linked work orders.
  - If the client has active `Task` records (status `PENDING` or `IN_PROGRESS`), deletion is **BLOCKED** with `HTTP 400 Bad Request`.
  - Only unencumbered clients can be deleted, preventing orphaned operational records and audit gaps.
- **Response `200 OK` (Clean Deletion):**
  ```json
  {
    "status": "success",
    "message": "Client deleted successfully",
    "deleted_id": "e7c6d1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
  }
  ```
- **Response `400 Bad Request` (Retention Block):**
  ```json
  {
    "detail": "Cannot delete client with 2 associated work orders. Reassign, complete, or archive work orders first."
  }
  ```

#### `GET /api/v1/crm/customers/{id}`
- **Description:** Fetch 360-degree customer record, including financial profile, linked documents, notes, and open tasks.

#### `POST /api/v1/crm/customers/{id}/notes`
- **Description:** Attach an interaction note to a customer profile.

#### `GET /api/v1/crm/tasks`
- **Description:** List tasks assigned to current officer or filtered by customer/status.
#### `POST /api/v1/crm/tasks`
- **Description:** Create a new SLA-bound task.
#### `PATCH /api/v1/crm/tasks/{id}`
- **Description:** Update task status (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`).

---

### 2.5 Financial Calculation Toolkit (`/api/v1/calculator`)

#### `POST /api/v1/calculator/emi`
- **Description:** Computes exact reducing balance EMI for given principal, interest rate, and tenure.
- **Request Body:**
  ```json
  {
    "principal": 1500000.00,
    "annual_interest_rate": 8.75,
    "tenure_months": 60
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "monthly_emi": 30960.31,
      "total_interest_payable": 357618.60,
      "total_payment": 1857618.60,
      "principal": 1500000.00,
      "annual_interest_rate": 8.75,
      "tenure_months": 60
    }
  }
  ```

#### `POST /api/v1/calculator/amortization`
- **Description:** Generates month-by-month repayment schedule.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "summary": { "monthly_emi": 30960.31, "total_interest": 357618.60 },
      "schedule": [
        {
          "month": 1,
          "opening_balance": 1500000.00,
          "emi": 30960.31,
          "principal_paid": 20022.81,
          "interest_paid": 10937.50,
          "closing_balance": 1479977.19
        }
      ]
    }
  }
  ```

#### `POST /api/v1/calculator/sip`
- **Description:** Calculates compound wealth accumulation for standard or step-up monthly SIP investments.
- **Request Body:**
  ```json
  {
    "monthly_investment": 10000.00,
    "expected_return_rate": 12.00,
    "investment_period_years": 10,
    "annual_step_up_percentage": 10.00
  }
  ```

---

### 2.6 Secure Document Management (`/api/v1/documents`)

- `POST /api/v1/documents/upload`: Upload file with `customer_id` and `document_type` via `multipart/form-data`.
- `GET /api/v1/documents/{id}`: Get metadata and verification status.
- `GET /api/v1/documents/{id}/download`: Stream secure file payload with authentication check.
- `POST /api/v1/documents/{id}/verify`: Mark status (`VERIFIED` or `REJECTED` with reason).

---

### 2.7 Analytics & Audit (`/api/v1/dashboard`, `/api/v1/audit`)

- `GET /api/v1/dashboard/metrics`: High-level counts (active customers, pending tasks, loan volume).
- `GET /api/v1/dashboard/portfolio-risk`: Risk distribution (`LOW`, `MEDIUM`, `HIGH`).
- `GET /api/v1/audit/logs`: Filtered audit log query (`actor_id`, `resource_type`, `date_from`, `date_to`).

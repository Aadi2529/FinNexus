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

### 2.1 Core & Health

#### `GET /api/v1/health`
- **Description:** Verifies service health, database connectivity, and Redis responsiveness.
- **Auth:** None (Public).
- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-15T08:00:00Z",
    "services": {
      "database": "connected",
      "redis": "connected"
    },
    "version": "1.0.0"
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

### 2.4 Finance CRM (`/api/v1/crm`)

#### `GET /api/v1/crm/customers`
- **Description:** List customers with filters (`search`, `status`, `assigned_officer_id`, `risk_tier`, `page`, `page_size`).
- **Auth:** `ROLE_ADMIN`, `ROLE_MANAGER`, `ROLE_OFFICER`, `ROLE_AUDITOR`.

#### `POST /api/v1/crm/customers`
- **Description:** Create a new customer profile and associated financial record.
- **Request Body:**
  ```json
  {
    "first_name": "Rahul",
    "last_name": "Sharma",
    "email": "rahul.sharma@example.com",
    "phone": "+919876543210",
    "pan_number": "ABCDE1234F",
    "financial_profile": {
      "employment_type": "SALARIED",
      "monthly_income": 85000.00,
      "monthly_obligations": 20000.00,
      "cibil_score": 765
    }
  }
  ```

#### `GET /api/v1/crm/customers/{id}`
- **Description:** Fetch 360-degree customer record, including financial profile, linked documents, notes, and open tasks.

#### `POST /api/v1/crm/customers/{id}/notes`
- **Description:** Attach an interaction note to a customer profile.
- **Request Body:**
  ```json
  {
    "content": "Customer submitted salary slips for past 3 months. KYC verified."
  }
  ```

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

# Requirements Specification — FinanceFlow

**Document Version:** 1.0.0  
**Phase:** Phase 0 — Project Initialization  
**Status:** Approved Baseline  

---

## 1. Functional Requirements (FR)

### FR-01: Identity, Authentication & Session Security
- **FR-01.1 Registration & Provisioning:** System Administrators can provision staff accounts with designated roles (`ROLE_ADMIN`, `ROLE_MANAGER`, `ROLE_OFFICER`, `ROLE_AUDITOR`).
- **FR-01.2 Authentication:** Users authenticate using email and password. Passwords must be hashed using Argon2id or bcrypt (work factor >= 12).
- **FR-01.3 Token Architecture:** On successful login, the server issues a short-lived JWT access token (15-minute expiry) and a cryptographically secure refresh token (7-day expiry).
- **FR-01.4 Token Revocation:** Logout explicitly blacklists or deletes the active refresh token in Redis. Revoked access tokens are rejected via a token revocation blacklist check.
- **FR-01.5 Role-Based Authorization:** Server-side route dependencies must enforce granular role and permission checks before executing any query or mutation.

### FR-02: User & Profile Governance
- **FR-02.1 Account Lifecycle:** Support user account status transitions (`ACTIVE`, `SUSPENDED`, `INACTIVE`).
- **FR-02.2 Profile Management:** Users can update their contact details, view assigned role capabilities, and update passwords.
- **FR-02.3 Staff Directory:** Managers and Admins can view paginated lists of team members and operational assignments.

### FR-03: Finance CRM (Customer Relationship Management)
- **FR-03.1 Customer Profile Creation:** Capture comprehensive customer financial records:
  - Personal: Full name, email, phone, date of birth, PAN / Tax ID, address.
  - Financial Profile: Employment type (salaried/self-employed), monthly net income, monthly liabilities, credit score (e.g., CIBIL/Experian), risk category (`LOW`, `MEDIUM`, `HIGH`).
- **FR-03.2 Customer Pipeline Stages:** Manage customer lead and relationship lifecycle states (`NEW_LEAD`, `DOCUMENTATION_PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `ACTIVE_LOAN`).
- **FR-03.3 Interaction Notes:** Officers can log rich notes against a customer profile with automated timestamping and author attribution.
- **FR-03.4 Tasks & Operational Reminders:** Officers and Managers can create SLA-bound tasks linked to customer records (e.g., "Collect ITR V", "Verification Call"), with priorities (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) and due dates.
- **FR-03.5 Customer Search & Filtering:** Filter customers by status, assigned officer, risk category, and search by name/PAN/email.

### FR-04: Secure Document Vault
- **FR-04.1 Document Upload:** Support PDF, JPEG, PNG, and TIFF formats for customer documents (Identity Proof, Address Proof, Income Statement, Collateral Document).
- **FR-04.2 File Validation:** Enforce server-side file inspection:
  - File size cap (maximum 10 MB per document).
  - Magic byte / MIME type sniffing to prevent malicious extension spoofing.
- **FR-04.3 Integrity & Storage:** Generate and persist SHA-256 checksums for every uploaded file. Store files with randomized UUID paths outside the public web root.
- **FR-04.4 Verification Workflow:** Compliance Auditors and Managers can mark documents as `PENDING_REVIEW`, `VERIFIED`, or `REJECTED` with rejection reason logs.
- **FR-04.5 Secure Download:** Provide time-limited signed URL or streaming endpoints with mandatory authorization checks.

### FR-05: Financial Calculation & Toolkit Engine
- **FR-05.1 Standard & Reducing Balance EMI Calculation:**
  - Formula: $E = P \cdot r \cdot \frac{(1+r)^n}{(1+r)^n - 1}$, where $P$ is principal, $r$ is monthly rate, and $n$ is tenure in months.
  - Return exact EMI, total interest payable, and total loan payment.
- **FR-05.2 Complete Amortization Schedule:**
  - Generate an ordered month-by-month repayment schedule containing: Month index, Opening Principal, EMI, Principal Component, Interest Component, and Closing Balance.
- **FR-05.3 Systematic Investment Plan (SIP) Calculation:**
  - Standard SIP Formula: $M = P \cdot \frac{(1+i)^n - 1}{i} \cdot (1+i)$.
  - Step-Up SIP capability: Incorporate an annual percentage increase in monthly contributions.
  - Provide total invested amount, estimated returns, and total maturity valuation.
- **FR-05.4 Numerical Precision:** Enforce Python `Decimal` arithmetic on backend to avoid IEEE 754 floating-point inaccuracies.

### FR-06: Dashboard & Operations Analytics
- **FR-06.1 Pipeline Metrics:** Total active customers, pending verification count, approval rates, and total simulated loan inquiries.
- **FR-06.2 Portfolio Risk Distribution:** Breakdown of customer portfolio by risk tiers (`LOW`, `MEDIUM`, `HIGH`).
- **FR-06.3 Task SLA Monitor:** Count of pending, overdue, and completed officer tasks.
- **FR-06.4 Recent Activity Stream:** Chronological feed of recent CRM updates and document uploads.

### FR-07: Immutable Audit Logging
- **FR-07.1 Comprehensive Action Tracking:** Log all state changes across Users, Customers, Tasks, and Documents.
- **FR-07.2 Audit Schema:** Capture `event_id`, `actor_id`, `action_type` (CREATE, UPDATE, DELETE, ACCESS, VERIFY), `resource_type`, `resource_id`, `timestamp`, `ip_address`, and `change_delta` (JSON snapshot of modified fields).
- **FR-07.3 Immutability:** Audit records must never be modified or deleted through the API (`APPEND-ONLY`).

### FR-08: AI Document Processing (Explicitly Deferred)
- **FR-08.1 Optical Character Recognition (OCR):** Automated text parsing of PAN cards and Aadhaar identity cards.
- **FR-08.2 Document Classification:** Deep learning model to categorize uploaded files automatically.
- **Status:** Scheduled for Post-MVP evaluation after core modules achieve 100% test pass rate.

---

## 2. Non-Functional Requirements (NFR)

### NFR-01: Performance & Latency
- API response times for financial calculations must remain under 50ms at p95.
- Standard CRUD database operations must respond under 150ms at p95 under normal load (up to 50 concurrent requests).
- Database queries must leverage proper B-Tree indexes on foreign keys and search fields.

### NFR-02: Security & Protection
- Adhere to OWASP Top 10 web application security principles.
- Enforce strict CORS policies restricting API traffic to approved frontend origins.
- Set standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`).
- Never leak stack traces, database credentials, or secret keys in client-facing error responses.

### NFR-03: Data Integrity & Transactions
- Relational integrity enforced through foreign key constraints, cascading delete prevention, and `NOT NULL` rules.
- Financial updates and multi-record actions must run inside atomic database transactions (`session.commit()` with rollback on error).

### NFR-04: Maintainability & Code Quality
- Backend code must follow PEP 8 standards with type annotations verified by static linters.
- Frontend code must follow modern React standards (functional components, custom hooks, prop destructuring, semantic HTML).
- Zero monolithic 1000-line files; maintain modular organization with clean separation between controllers, services, repositories, and presentation components.

### NFR-05: Usability & User Experience
- Clean, responsive dashboard layout using Tailwind CSS.
- Color palette tailored for financial clarity: slate darks, crisp neutral card surfaces, indigo primary branding, emerald positive returns/approvals, amber warnings, and rose rejections/delinquencies.
- Instant user feedback on interactive calculations with reactive chart/schedule visualizations.

### NFR-06: Testability & Quality Assurance
- Automated tests across all pyramid layers:
  - Unit tests for all mathematical algorithms, validation models, and utilities.
  - Integration tests for API routes with live database sessions.
  - End-to-end (E2E) browser tests with Playwright covering critical user workflows.
- Minimum code coverage target: 85% for calculation and core business logic.

### NFR-07: Portability & Deployment
- 100% reproducible local and CI environment via Docker Compose.
- Zero host-dependent file paths or hardcoded URLs.
- Environment variables configured via `.env` files matching `.env.example`.

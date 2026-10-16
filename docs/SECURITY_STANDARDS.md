# Security Standards & Compliance Policy — FinanceFlow

**Document Version:** 1.0.0  
**Phase:** Phase 0 — Project Initialization  
**Status:** Approved Baseline  
**Compliance Standard:** OWASP Top 10 (2021), ISO/IEC 27001 Financial Guidelines

---

## 1. Authentication & Session Governance

### 1.1 Token Architecture
FinanceFlow employs a dual-token JWT architecture with server-side revocation:
- **Access Token:**
  - Format: Signed JWT (Algorithm: `HS256` or `RS256`).
  - Lifespan: Exactly 15 minutes (900 seconds).
  - Claims: `sub` (User UUID), `email`, `roles` (list of strings), `exp`, `iat`, `jti` (unique token ID).
- **Refresh Token:**
  - Format: Cryptographically secure 256-bit random hex string.
  - Storage: Persisted in PostgreSQL as a SHA-256 hash.
  - Lifespan: Exactly 7 days.
  - Invalidation: One-time use rotation. When a refresh token is exchanged, it is revoked and replaced.
- **Revocation Store (Redis):**
  - Upon user logout or administrative session termination, the `jti` of the active access token is published to a Redis set with a TTL matching the token's remaining lifespan.
  - Every incoming authenticated request checks Redis to verify the token has not been blacklisted.

### 1.2 Password Security
- **Hashing Algorithm:** Argon2id (Memory: 64MB, Iterations: 3, Parallelism: 4) or bcrypt with work factor >= 12.
- **Complexity Requirements:** Minimum 8 characters, containing at least one uppercase letter, one lowercase letter, one digit, and one special character.
- **Rate Limiting:** IP and account-based throttling on `/api/v1/auth/login` (maximum 5 failed attempts per 5 minutes before temporary lock).

### 1.3 Implemented Database-Level Protections (Phase 2 Baseline)
- **Zero Plaintext Credentials:** The `users` table contains `hashed_password VARCHAR(255)`. No plaintext password column exists in any model.
- **Token Hashing at Rest:** `refresh_tokens.token_hash` stores a SHA-256 digest (`VARCHAR(64)`), ensuring database leaks do not expose live session tokens.
- **Audit Log Preservation:** `audit_logs.actor_id` uses `ON DELETE SET NULL`. Audit history can never be deleted by cascade when a user account is purged.
- **Operational Attribution Preservation:** `customer_notes.author_id` and `tasks.assigned_to_id` use `ON DELETE RESTRICT` to prevent orphaned modifications.
- **File Invariant Safeguards:** Document payloads are stored outside the database on disk or object store; only metadata, MIME types, and SHA-256 hashes are persisted in `documents`. Check constraint `chk_documents_file_size_positive` guarantees zero-byte corrupted records cannot be registered.
- **Numerical Financial Bounds:** `financial_profiles` enforces `monthly_income >= 0`, `monthly_obligations >= 0`, and bureau range `cibil_score BETWEEN 300 AND 900` directly at the database engine level.

---


## 2. Server-Side Role-Based Access Control (RBAC)

Authorization is strictly enforced in the FastAPI controller layer using Python dependencies (`Depends(require_roles([...]))`). Frontend role checks are treated purely as UI/UX conveniences.

### Permission Matrix

| Resource & Action | `ROLE_ADMIN` | `ROLE_MANAGER` | `ROLE_OFFICER` | `ROLE_AUDITOR` |
| :--- | :---: | :---: | :---: | :---: |
| **User Administration** | Read / Write | Read Only | None | None |
| **System Settings** | Read / Write | None | None | None |
| **Audit Logs** | Full Read | None | None | Full Read |
| **CRM Customer Creation** | Full Access | Full Access | Full Access | None |
| **CRM Customer Update** | Full Access | Full Access | Assigned Only | None |
| **CRM Customer Delete** | Full Access | Soft Delete | None | None |
| **Document Upload** | Allowed | Allowed | Allowed | Denied |
| **Document Verification** | Allowed | Allowed | Denied | Allowed |
| **Document Download** | Allowed | Allowed | Assigned Only | Allowed |
| **Financial Calculators** | Allowed | Allowed | Allowed | Allowed |
| **Operational Analytics**| Global | Branch | Personal | Global Read |

---

## 3. Input Validation & Injection Defenses

### 3.1 SQL Injection Prevention
- All database queries are generated strictly via **SQLAlchemy 2.0 Core and ORM** with bound parameters.
- Raw string concatenation in SQL queries (`f"SELECT * FROM ... WHERE id = '{id}'"`) is strictly prohibited and flagged by static analysis rules.

### 3.2 Request Sanitization & Type Safety
- **Pydantic v2** validation models inspect and sanitize all request bodies, query strings, and path parameters before execution reaches service handlers.
- Numeric financial values must use `Decimal` or strict bounded floats to prevent overflow and NaN attacks.

### 3.3 Cross-Site Scripting (XSS) & Header Defenses
- React automatically escapes interpolated JSX variables, preventing DOM-based script injection.
- Security Headers enforced via FastAPI middleware:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 4. Secure Document Handling Policy

Customer identity and financial documents present the highest regulatory risk in FinOps platforms:
1. **MIME Sniffing & Magic Bytes:** Never trust client-supplied `Content-Type` headers or file extensions. The backend inspects the initial byte headers (magic bytes) to guarantee only genuine PDF, JPEG, and PNG files are processed.
2. **Path Traversal Prevention:** Files are never written to disk using their original filenames. Instead, each file is assigned an unpredictable UUIDv4 (e.g., `storage/documents/3f8b...pdf`).
3. **Storage Outside Web Root:** The file storage directory is located completely outside the public web server directory. File downloads are served exclusively through streaming endpoints that verify authorization.
4. **Integrity Verification:** A SHA-256 cryptographic hash is calculated during upload stream processing and stored in the database. When retrieving the file, the hash can be verified to detect disk corruption or tampering.

---

## 5. Secrets Management & Environment Security

1. **Zero Secrets in Repository:** API keys, database credentials, JWT secret keys, and encryption seeds must never be committed to Git.
2. **Environment Configuration:** The platform reads all configuration via `backend/app/core/config.py` using `pydantic-settings` from local `.env` files.
3. **Template Provided:** A comprehensive `.env.example` file is maintained with placeholder keys and descriptive documentation for developers.
4. **Automated Scanning:** Pre-commit hooks and GitHub Actions workflows enforce secret scanning against leaked tokens.

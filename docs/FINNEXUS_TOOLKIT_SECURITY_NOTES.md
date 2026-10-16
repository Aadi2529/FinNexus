# FINNEXUS TOOLKIT — SECURITY & PRIVACY SPECIFICATION
## Enterprise Identity Document Safeguards, Zero-Leak Architecture & Threat Modeling

**Version:** 1.0.0  
**Project:** FinNexus Enterprise Suite  
**Module:** Toolkit Document Processing Core  
**Date:** October 2026  
**Classification:** Confidential / Internal Security Blueprint  

---

## 1. Threat Landscape & Regulatory Context

Indian identity documents—primarily **Aadhaar** (issued by the Unique Identification Authority of India - UIDAI) and **Permanent Account Number (PAN)** (issued by the Income Tax Department through NSDL/UTIITSL)—contain critical Personally Identifiable Information (PII) including full legal names, demographic details, dates of birth, biometric IDs, and unique identifiers.

Processing these documents within an enterprise financial and CRM platform mandates strict alignment with:
1. **The Aadhaar Act, 2016** & UIDAI Data Security Regulations (prohibiting unauthorized storage, reproduction, or unprotected exposure of Aadhaar numbers and biometric data).
2. **Digital Personal Data Protection Act (DPDPA), 2023** (strict data minimization, purpose limitation, and storage limitation).
3. **Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011**.

---

## 2. Core Architectural Security Principles

### 2.1 Zero Database Persistence for Identity Documents
- **Rule**: Raw Aadhaar PDFs, PAN PDFs, derived decryption keys, and cropped identity card images are **NEVER** persisted into the PostgreSQL relational database.
- **Verification**: Database schemas (`app/db/models/documents.py`, `app/db/models/crm.py`) remain completely untouched by identity card operations.
- The PostgreSQL database continues to store only standard compliance metadata records when explicitly registered in the long-term vault (`/toolkit/documents/upload`), with SHA-256 digests.

### 2.2 Server-Side Only Password Derivation
- Government PDF password conventions are derived entirely inside isolated server-side functions (`derive_aadhaar_password`, `derive_pan_password`).
- **No Password Echo**:
  - The derived password is never returned in HTTP responses.
  - The derived password is never written to standard output, log streams, or error messages.
  - When decryption fails, the API responds with a generic, actionable message:
    `"Document is encrypted and password verification failed. Please verify that client details match the issuing authority records."`

### 2.3 Cryptographic Session Isolation (`storage/toolkit_temp`)
- Each processing request creates an unpredictable directory: `storage/toolkit_temp/{prefix}_{uuid4_hex}/`.
- Temporary directory IDs are 128-bit cryptographically random hex strings (e.g. `aadhaar_8f12a4b9c1d044e1834...`).
- Cross-tenant or cross-user directory access is impossible because session keys are non-enumerable.

### 2.4 Strict Anti-Path Traversal & Parameter Sanitization
- File retrieval via `/api/v1/toolkit/download/{job_id}/{filename}` and `/api/v1/toolkit/preview/{job_id}/{filename}` applies two-phase defensive verification:
  1. **Regex Validation**:
     - `job_id`: Enforced strictly to `^[a-zA-Z0-9_-]+$`.
     - `filename`: Enforced strictly to `^[a-zA-Z0-9._-]+$`. Any request containing `..`, `/`, `\`, null bytes, or control characters is rejected with HTTP 400 Bad Request.
  2. **Resolved Path Anchoring**:
     - The target filesystem path is canonicalized via `.resolve()`.
     - The canonical path must start with the canonical `storage/toolkit_temp` base directory:
       `assert str(target_file).startswith(str(base_dir))`

### 2.5 Cache-Control & Downstream Header Hygiene
- Downloaded documents and preview responses carry explicit non-caching HTTP headers:
  ```http
  Cache-Control: private, no-store, max-age=0, must-revalidate
  Pragma: no-cache
  ```
- Prevents shared proxies, corporate gateways, browser history caches, and CDNs from storing unencrypted personal identity documents.

### 2.6 Automatic Lifecycle Housekeeping
- Temporary files have an automatic time-to-live (TTL).
- `cleanup_expired_jobs(max_age_seconds=3600)` is triggered periodically and on incoming processing requests to remove directories older than 1 hour.

---

## 3. Data Flow Diagram: Sensitive Identity Processing

```
+-------------------------------------------------------------------------+
|                              User Browser                               |
|   (Client Name, DOB, Normal/Masked PDF, or PAN PDF via SSL/TLS)         |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTPS POST multipart/form-data
                                     v
+-------------------------------------------------------------------------+
|                     FastAPI Backend (app.api.toolkit)                   |
| 1. Authenticate JWT Bearer Token (Reject unauthenticated requests)      |
| 2. Verify File Magic Bytes (%PDF / \x89PNG / \xff\xd8\xff)               |
| 3. Normalize Name & Date of Birth                                       |
| 4. Derive UIDAI or PAN Password in Memory (No Logs / No DB)             |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|             PyMuPDF Cryptographic Engine (document_processor.py)        |
| 1. doc.authenticate(password)                                           |
| 2. Locate UIDAI / PAN Card coordinates (regex/geometry bbox)            |
| 3. Set page cropbox -> export _cropped.pdf                              |
| 4. Rasterize at 300 DPI -> export .jpg                                  |
| 5. Clean unencrypted export -> _unlocked.pdf                            |
| 6. Package in-session ZIP -> _processed_files.zip                      |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|          Ephemeral Private Disk (storage/toolkit_temp/{job_id})         |
| 1. Strict file permissions (0600)                                       |
| 2. Non-enumerable random UUID directory path                            |
| 3. TTL retention cleanup (max 3600 seconds)                             |
+------------------------------------+------------------------------------+
                                     |
                                     | Stream via FileResponse
                                     v
+-------------------------------------------------------------------------+
|                  Client Download / Image Preview Area                   |
| (Streamed directly to authenticated user with Cache-Control: no-store)   |
+-------------------------------------------------------------------------+
```

---

## 4. Summary of Cryptographic & Compliance Tests

All security controls were tested and verified via `tests/test_toolkit_suite.py`:
- **Password Derivation Tests**: Validates that passwords match UIDAI and Income Tax specifications across varied whitespace and capitalization formats.
- **Decryption Failure Tests**: Confirms that invalid passwords return HTTP 400 without leaking the derived password or exposing internal stack traces.
- **Path Traversal Attacks**: Attempts to read `../../etc/passwd` or escape `storage/toolkit_temp` are verified to be strictly blocked.
- **MIME & Magic-Byte Validation**: File signatures are verified using binary header inspection rather than trusting user-provided file extensions.

# 12 — FinNexus Business & Technical Glossary

This glossary defines domain-specific financial terminology, Indian regulatory concepts, and software architecture terms used across the FinNexus platform.

---

## 1. Indian Financial & Regulatory Terminology

### Aadhaar / e-Aadhaar
A 12-digit unique identity number issued by UIDAI to Indian residents. e-Aadhaar refers to the password-protected digital PDF downloaded from the UIDAI portal. Password format is typically the first 4 letters of the name in capital letters followed by the birth year (`YYYY`).

### PAN (Permanent Account Number)
A 10-character alphanumeric identifier (`[A-Z]{5}[0-9]{4}[A-Z]{1}`) issued by the Indian Income Tax Department. Essential for banking, mutual funds, and taxation operations.

### CIBIL Score
A 3-digit credit rating ranging from 300 to 900 calculated by TransUnion CIBIL. Scores above 750 represent prime creditworthiness for unsecured and secured loans.

### FOIR (Fixed Obligation to Income Ratio)
A key debt-to-income metric used by Indian underwriters to evaluate maximum loan eligibility:
$$\text{FOIR} = \frac{\text{Total Monthly Debt Obligations}}{\text{Monthly Net Income}} \times 100$$
Typically capped between 40% and 65% depending on borrower income tier.

### MFU (Mutual Fund Utilities)
A shared infrastructure created by SEBI-registered Asset Management Companies (AMCs) in India to simplify mutual fund transactions across multiple fund houses.

### CAN (Common Account Number)
A unique reference number issued by MFU mapping an investor's mutual fund folios, bank accounts, and nominees across all fund houses.

### Payeezz Mandate
An electronic or physical auto-debit bank mandate registered via MFU allowing investors to execute SIPs and lump-sum investments across mutual funds without entering net banking credentials for each transaction.

### Cashless Claim
An insurance claim settlement mechanism where the insurer pays the hospital or garage directly without requiring the policyholder to pay out-of-pocket first.

---

## 2. FinNexus Product & Operational Terminology

### Customer 360
A unified dossier consolidating a client's biographical information, PAN/Aadhaar identity, financial profile (income, CIBIL, obligations), KYC documents, interaction notes, assigned tasks, and active work orders into a single view.

### Work Category
A standardized operational catalog entry (e.g. `Work: MFU`, `Work: Insurance`, `Work: Insurance Claim`) defining preset checklist templates cloned when creating work orders.

### Work Order
A tracking container (`WO-YYYYMMDD-XXXX`) representing an end-to-end client service engagement (e.g. loan disbursement, CAN creation). Contains priority level, deadline, assigned officer, checklist milestones, reminder recipients, and an immutable history log.

### Preset Checklist Template
A sequential list of operational steps associated with a Work Category. In FinNexus, administrators can reorder these steps vertically using drag handles with persistent sequential ordering.

### Supervisor Completion Override
A governance bypass allowing supervisors (`ADMIN`, `SUPER_ADMIN`, `MANAGER`) to force-complete a work order with incomplete checklist items, requiring a mandatory written justification recorded in the immutable audit log.

---

## 3. Software Architecture & Technical Terminology

### ASGI (Asynchronous Server Gateway Interface)
The standard Python specification for asynchronous web servers and applications (e.g. Uvicorn + FastAPI), enabling high-concurrency non-blocking I/O.

### JWT (JSON Web Token)
A compact, URL-safe means of representing claims between two parties. FinNexus uses HS256-signed JWTs containing `sub`, `email`, `roles`, and `jti` claims for stateless authentication.

### JTI (JWT ID)
A unique UUID claim inside each JWT. FinNexus tracks revoked JTIs in Redis with an expiration TTL, enabling immediate session invalidation on logout.

### Refresh Token Rotation
A security pattern where each token refresh operation revokes the supplied refresh token and issues a new one, mitigating token replay attacks.

### Monorepo
A software development strategy where code for multiple applications (`dashboard`, `crm`, `toolkit`, `insurance-engine`, `backend`) resides in a single version-controlled repository.

### PyMuPDF (`fitz`)
High-performance C-level Python bindings for the MuPDF rendering library, used in FinNexus for millisecond-level PDF unlocking, high-resolution rasterization, and geometric cropping.

### `@dnd-kit`
A lightweight, modular drag-and-drop toolkit for React that provides smooth sortable list interactions with full keyboard and touch accessibility.

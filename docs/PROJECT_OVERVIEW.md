# Project Overview — FinanceFlow

**Document Version:** 1.0.0  
**Phase:** Phase 0 — Project Initialization  
**Status:** Approved Baseline  
**Audience:** Academic Evaluators, Industry Interviewers, Core Engineering Team

---

## 1. Executive Summary

**FinanceFlow** is a modern, industry-grade financial operations (FinOps) platform engineered as a fourth-year capstone field project. It addresses the operational bottlenecks experienced by Non-Banking Financial Companies (NBFCs), digital lending desks, and retail financial advisory firms. 

FinanceFlow bridges the gap between fragmented customer relationship management (CRM) software, offline spreadsheets used for loan amortization/SIP planning, unmonitored local KYC document storage, and regulatory audit compliance.

Built using an asynchronous **FastAPI (Python)** backend, a reactive **Vite + React.js (JavaScript ES Modules)** frontend, **PostgreSQL** for relational ACID persistence, and **Redis** for stateful token governance, FinanceFlow emphasizes production realism: strict server-side authorization, tamper-resistant audit logs, exact financial calculations, and verifiable end-to-end testing.

---

## 2. Industry Context & Academic Placement Goals

In modern financial institutions, operational efficiency and compliance rigor dictate commercial viability:
1. **The Placement Objective:** Showcase senior-level software engineering craft—demonstrating modular monolithic architecture, clean code practices, strict separation of concerns, comprehensive automated test suites (unit, integration, and E2E), and version-controlled database migrations rather than academic toy scripts.
2. **The Problem:** Financial operations officers constantly juggle multiple disparate tools:
   - Generic CRMs that lack financial attributes (CIBIL scores, debt-to-income ratios, collateral records).
   - Spreadsheet workbooks for loan repayment scheduling and investment projections that are prone to formula errors.
   - Unencrypted file folders for sensitive customer identity proofs (Aadhaar/PAN/Tax returns).
   - Total lack of real-time operational traceability or immutable audit logging needed for financial compliance audits.

---

## 3. Product Scope & Scope Boundaries

FinanceFlow establishes clear product boundaries to guarantee delivery of a reliable, high-integrity platform within an intensive two-week MVP roadmap.

### In-Scope Core Capabilities (MVP)

1. **Identity & Access Management (IAM):**
   - JWT-based authentication with access and refresh token lifecycle.
   - Token revocation and blacklisting via Redis.
   - Role-Based Access Control (RBAC) across distinct financial operational roles: Admin, Branch Manager, Loan Officer, and Compliance Auditor.
2. **User & Staff Governance:**
   - User account lifecycle, activation/suspension, and profile management.
3. **Finance CRM & Pipeline Tracking:**
   - 360-degree customer financial profiles (KYC data, employment status, credit rating, income brackets).
   - Customer relationship timeline: interaction notes, follow-up activities, and SLA-bound tasks.
4. **Financial Calculation & Projections Engine:**
   - Standard and reducing-balance Equated Monthly Installment (EMI) engine.
   - Complete month-by-month loan amortization schedule generator (principal breakdown, interest component, balance).
   - Systematic Investment Plan (SIP) compound wealth projection engine with annual step-up calculation capabilities.
5. **Secure Document Management Vault:**
   - Multi-type customer document storage (identity proofs, income statements, bank statements, collateral titles).
   - Server-side MIME validation, SHA-256 checksum verification, and tamper-resistant storage abstractions.
   - Document access permissions and verification status workflows.
6. **Executive Dashboard & Portfolio Analytics:**
   - Aggregated pipeline statistics, customer acquisition velocities, loan inquiry volumes, and task completion metrics.
7. **Tamper-Evident Audit Logging:**
   - Comprehensive system audit trail recording every state change (actor, timestamp, IP address, action, target entity, pre/post state delta).

### Deferred Scope (Post-MVP Roadmap)

1. **AI Document Extraction & Classification:**
   - Automated OCR extraction of PAN/Aadhaar/Tax documents and computer-vision classification.
   - *Rationale:* AI capabilities require a rock-solid, secure document vault and tested data pipeline before model integration can deliver real value without risking hallucinated compliance violations.
2. **Third-Party Payment Gateway Integration:**
   - Live payment settlement (Razorpay/Stripe).
3. **Multi-Tenancy Microservices:**
   - Splitting domains into distributed microservices or Kubernetes clusters is explicitly prohibited to prevent artificial architectural overhead.

---

## 4. User Personas & Permissions Overview

| Persona | Role Identifier | Operational Responsibilities | Core System Permissions |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `ROLE_ADMIN` | System configuration, staff provisioning, global role assignments, security monitoring. | Full CRUD on users, audit log inspection, global configuration. |
| **Branch / Operations Manager** | `ROLE_MANAGER` | Oversees pipeline, assigns customer leads, monitors team SLA performance and loan pipeline. | Read/write CRM, assign tasks, view branch analytics and reports. |
| **Loan Officer / Relationship Mgr** | `ROLE_OFFICER` | Customer onboarding, KYC document collection, running EMI calculators, customer follow-ups. | CRUD on assigned customers, upload documents, create notes/tasks, run calculators. |
| **Compliance Auditor** | `ROLE_AUDITOR` | Regulatory oversight, KYC compliance verification, audit trail review, risk tracking. | Read-only access to customer files and documents, full read access to audit logs. |

---

## 5. Architectural Principles

1. **Modular Monolith First:** Maintain unified deployment simplicity while enforcing clean module boundaries inside both backend (`app/modules/*`) and frontend (`src/modules/*` or `src/pages/*`).
2. **Server-Side Authority:** Frontend controls (hiding buttons, route guards) are treated strictly as UX conveniences. All authorization, data validation, and business invariants are rigorously enforced at the API controller and service layer.
3. **Deterministic Financial Math:** Calculations (EMI, amortization, SIP) must employ standard rounding and exact numeric conventions (Python `Decimal` for currency precision, never raw floating-point rounding errors).
4. **Data Integrity via Migrations:** No dynamic or ad-hoc database mutations in production. All schema changes are governed through tracked, reversible Alembic migrations.
5. **Traceability & Zero Mocking:** Development must rely on real, working integrations. Synthetic data is used purely for reproducible seeds and fixtures.

---

## 6. Documentation Governance

All engineering changes must adhere to the **FinanceFlow Documentation Sync Policy**:
- Any schema change must update `DATABASE_DESIGN.md` and generate an Alembic migration.
- Any new or modified endpoint must update `API_DESIGN.md`.
- Architectural choices must be recorded as an ADR in `DECISIONS.md`.
- Each phase must conclude with a dedicated implementation log under `docs/implementation/` before marking progress in `DEVELOPMENT_STATUS.md`.

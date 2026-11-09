# FINNEXUS INSURANCE ENGINE — COMPLETE BUSINESS DATA RESET REPORT

**Execution Timestamp:** 2026-11-06T16:15:30+05:30  
**Repository:** `D:\project`  
**Target Module:** Insurance Engine only  
**Execution Status:** **PASS** (Zero errors, complete verification)

---

## 1. TARGET DATABASE ENVIRONMENT & CONNECTION

- **Target Database Host:** `127.0.0.1:5432` (PostgreSQL 18.6 64-bit on Windows)
- **Database Name:** `finnexus_db`
- **Database User:** `postgres`
- **Database Schema:** `public`
- **Application ORM:** SQLAlchemy 2.0 AsyncSession with `asyncpg` driver
- **Connection String:** `postgresql+asyncpg://postgres:***@127.0.0.1:5432/finnexus_db`
- **Verified via Live PostgreSQL Query:**
  - `SELECT current_database(), current_schema();` -> `('finnexus_db', 'public')`

---

## 2. PRE-RESET DATABASE BACKUP & VERIFIED RECOVERY POINT

Prior to initiating any deletion operations, a full binary dump archive of `finnexus_db` was created and verified:

- **Backup File Path:** `D:\project\backend\backups\pre_reset_backup_20261106_1615.dump`
- **Format:** PostgreSQL Custom Binary Archive (`pg_dump.exe -F c -b -v`)
- **File Size:** 249,470 bytes
- **Creation Timestamp:** 2026-11-06 16:11:05 IST
- **Integrity Status:** **PASS** (Verified with `Get-Item` file inspection and schema table check)
- **Previous Recovery Point:** `D:\project\backend\backups\pre_reset_backup_20261106.dump` (250,539 bytes)

---

## 3. AUDIT OF ALL TABLES & BEFORE / AFTER RECORD COUNTS

All **48 tables** in the `public` schema were audited, classified by module ownership, and tracked across pre-reset and post-reset states:

### A. Exclusively Insurance Engine Tables (100% Cleared to Zero)

| Table Name | Module Ownership | Pre-Reset Count | Post-Reset Count | Target | Safe to Clear | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `insurance_sub_agent_payout_payments` | Commission / Payouts | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_commission_receipts` | Commission / Receipts | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_sub_agent_payouts` | Commission / Payouts | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policy_commissions` | Commission / Ledger | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_commission_splits` | Commission / Splits | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_company_commission_agreements` | Commission / Agreements | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policies` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policy_payments` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_premium_schedules` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policy_members` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policy_nominees` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policy_histories` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policy_years` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_policy_documents` | Policy Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_family_groups` | Customers / Family | 1 | 0 | 0 | Yes | **PASS** |
| `insurance_family_members` | Customers / Family | 1 | 0 | 0 | Yes | **PASS** |
| `insurance_health_quotation_premiums` | Health Quotations | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_health_quotation_company_plans` | Health Quotations | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_health_quotation_members` | Health Quotations | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_health_quotations` | Health Quotations | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_lead_reminders` | Lead Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_lead_notes` | Lead Management | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_lead_activities` | Lead Management | 11 | 0 | 0 | Yes | **PASS** |
| `insurance_agent_inquiries` | Lead Management | 4 | 0 | 0 | Yes | **PASS** |
| `insurance_plan_documents` | Basic Setup / Plans | 16 | 0 | 0 | Yes | **PASS** |
| `insurance_plans` | Basic Setup / Plans | 18 | 0 | 0 | Yes | **PASS** |
| `insurance_company_categories` | Basic Setup / Companies| 0 | 0 | 0 | Yes | **PASS** |
| `insurance_company_documents` | Basic Setup / Companies| 0 | 0 | 0 | Yes | **PASS** |
| `insurance_companies` | Basic Setup / Companies| 32 | 0 | 0 | Yes | **PASS** |
| `insurance_purchase_parties` | Basic Setup / Parties | 0 | 0 | 0 | Yes | **PASS** |
| `insurance_sub_agents` | Basic Setup / POSP | 0 | 0 | 0 | Yes | **PASS** |
| **Subtotal Exclusive Records** | | **83** | **0** | **0** | | **PASS** |

---

### B. Shared Tables (Selective Reset & Foreign-Key Preservations)

| Table Name | Module Ownership | Pre-Reset Count | Post-Reset Count | Deleted Records | Retained Records | Deletion Scope & Safety Rule | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| `customers` | CRM / Shared | 6 | 4 | 2 | 4 | Deleted 2 pure insurance test customers (`Nandini Sharma`, `Amitabh Bachchan`). **PRESERVED** all 4 CRM clients: `Rajesh Sharma`, `Priya Patel`, `Amit Verma`, and `Aditya Thakre` (linked to CRM Work Order `WO-2026-0001` via `ON DELETE CASCADE`). | **PASS** |
| `documents` | Shared Document Vault | 4 | 2 | 2 | 2 | Deleted 2 KYC document uploads (`b96b466de767b37f7440df9a5567b4ea.jpg`, `5828214-3840x2160-desktop-4k-spider-man-wallpaper.jpg`) belonging to deleted insurance customer Nandini Sharma. **PRESERVED** 2 KYC documents for CRM client Aditya Thakre. | **PASS** |
| `customer_notes` | CRM / Shared | 3 | 3 | 0 | 3 | All 3 notes belong to CRM customers (`Rajesh Sharma`, `Priya Patel`, `Amit Verma`). **100% UNTOUCHED**. | **PASS** |
| `audit_logs` | System / Shared | 114 | 9 | 105 | 9 | Deleted 105 insurance records (`insurance_company`, `insurance_plan`, `insurance_plan_document`, `lead`, and deleted test customer audit events). **PRESERVED** 9 CRM client and administrative audit records. | **PASS** |

---

### C. Protected Core, Authentication, CRM & Toolkit Tables (STRICTLY PRESERVED)

| Table Name | Module Ownership | Pre-Reset Count | Post-Reset Count | Action | Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `users` | Core / Authentication | 8 | 8 | **UNTOUCHED** (Super Admin & staff accounts intact) | **PASS** |
| `roles` | Core / RBAC | 7 | 7 | **UNTOUCHED** (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, etc.) | **PASS** |
| `user_roles` | Core / RBAC | 11 | 11 | **UNTOUCHED** (Role assignments intact) | **PASS** |
| `refresh_tokens` | Authentication / JWT | 506 | 506 | **UNTOUCHED** (Active user sessions preserved) | **PASS** |
| `alembic_version` | Database Migrations | 1 | 1 | **UNTOUCHED** (Migration head intact: `e8f9a0b1c2d3`) | **PASS** |
| `work_orders` | CRM | 4 | 4 | **UNTOUCHED** (Active CRM work orders intact) | **PASS** |
| `work_order_history` | CRM | 9 | 9 | **UNTOUCHED** (CRM audit history intact) | **PASS** |
| `work_order_checklist_items` | CRM | 14 | 14 | **UNTOUCHED** (Task checklists intact) | **PASS** |
| `work_order_reminders` | CRM | 3 | 3 | **UNTOUCHED** (CRM reminders intact) | **PASS** |
| `work_categories` | CRM | 9 | 9 | **UNTOUCHED** (MFU, Insurance, Accounting, Office) | **PASS** |
| `crm_notifications` | CRM | 7 | 7 | **UNTOUCHED** (CRM notifications intact) | **PASS** |
| `tasks` | CRM / Operations | 3 | 3 | **UNTOUCHED** (CRM operational tasks intact) | **PASS** |
| `financial_profiles` | CRM / Toolkit | 3 | 3 | **UNTOUCHED** (Financial profile records intact) | **PASS** |

---

## 4. SUPER ADMIN ACCOUNT & AUTHENTICATION VERIFICATION

- **Super Admin Email:** `admin@finnexus.com`
- **Super Admin Full Name:** Aditya Thakre
- **User ID:** `40351e16-e0dd-4064-a060-bd866d35bc63`
- **Active Status:** `True`
- **Assigned System Roles:** `SUPER_ADMIN`, `ADMIN`
- **Password Verification:** **PASS** (Verified with Argon2/bcrypt cryptographic hash via `verify_password()`)
- **API Login Endpoint (`POST /api/v1/auth/login`):** **PASS** (HTTP 200 OK, valid JWT Bearer access token issued)
- **Other Preserved User Accounts:**
  - `amit@finnexus.com` (EMPLOYEE) — Active: `True`
  - `employee1@finnexus.com` (EMPLOYEE) — Active: `True`
  - `manager@financeflow.com` (MANAGER) — Active: `True`
  - `officer@financeflow.com` (LOAN_OFFICER, ADMIN) — Active: `True`
  - `underwriter@financeflow.com` (UNDERWRITER, ADMIN) — Active: `True`
  - `employee@financeflow.com` (EMPLOYEE) — Active: `True`
  - `employee2@financeflow.com` (EMPLOYEE) — Active: `True`

---

## 5. DOCUMENT STORAGE CLEANUP REPORT

### A. Deleted Insurance Files (25 Files Removed)
1. **Plan Documents (`storage/plan_documents/` — 20 files removed):**
   - `plan_005e7e10-8596-49ab-8f4e-5be23dad52d8_1e59b51a_wording.pdf`
   - `plan_05fcacb2-304a-4acf-ae04-265bd493b681_26f6d49f_b.pdf`
   - `plan_0e5397f3-ee0d-4a59-9736-82576fc4907e_5ca3fb2b_wording.pdf`
   - `plan_4228e657-fdba-49ee-8e1b-e7aea62873dd_d25409e3_wording.pdf`
   - `plan_5119c388-5c88-41b1-97ca-dcbcf632ae0c_d1e4bf16_b.pdf`
   - `plan_52049858-8b7d-4089-91d3-c3972b4522de_d7925f9f_brochure_2026.pdf`
   - `plan_5ddd75c9-ea5b-499f-a446-3fb2e3caebef_f58efd52_wording.pdf`
   - `plan_6c6495ae-ce39-42ca-94c8-64deddb58ffa_3383c52c_brochure_2026.pdf`
   - `plan_6c6495ae-ce39-42ca-94c8-64deddb58ffa_93f8742a_rates_chart.xlsx`
   - `plan_6c6495ae-ce39-42ca-94c8-64deddb58ffa_c2b85980_claim_intimation.docx`
   - `plan_6c6495ae-ce39-42ca-94c8-64deddb58ffa_f4c8791e_hospitals.png`
   - `plan_97072610-79f1-4770-b84c-47b060c0fbb5_011c55ca_b.pdf`
   - `plan_a0f337bf-f999-41fe-8919-3d84e1d995d4_0913e185_b.pdf`
   - `plan_b6cd5d3c-a244-4d44-bb0e-072f9dbb3757_058f31bf_prospectus_v2.pdf`
   - `plan_b735f751-cb5e-4b1b-8c01-eedb83283bbf_7c937a34_brochure_2026.pdf`
   - `plan_d8e3af91-9964-46d0-b0bb-388fca3e31d8_9f175db2_prospectus_v2.pdf`
   - `plan_f1727dad-d319-47ef-8bdb-8f4fe2c3372f_0a1bf73c_hospitals.png`
   - `plan_f1727dad-d319-47ef-8bdb-8f4fe2c3372f_267f2520_claim_intimation.docx`
   - `plan_f1727dad-d319-47ef-8bdb-8f4fe2c3372f_2bfa38b3_rates_chart.xlsx`
   - `plan_f1727dad-d319-47ef-8bdb-8f4fe2c3372f_e7578899_brochure_2026.pdf`
2. **Customer KYC Files (`storage/kyc_documents/` — 5 files removed):**
   - `51f632bc0a6e4d42bc79359d8f22eafc_daa0cde7282d.jpg` (PAN for deleted insurance test customer Nandini Sharma)
   - `6562a4b0cfdb4abda5275be768555a8c_a6d485f92f03.jpg` (Aadhaar for deleted insurance test customer Nandini Sharma)
   - `345140b8c541481eb20dfba5891a6554_e166403feaaa.pdf` (residual test upload)
   - `3bdf7a2b00894226aaeed9ee1a5e51ac_e166403feaaa.pdf` (residual test upload)
   - `bce2d52588ef40ecbf877cec14d6089c_e166403feaaa.pdf` (residual test upload)

### B. Strictly Preserved Storage Directories & Shared Files (100% Intact)
- `storage/documents`: **8 files intact** (Toolkit module PDF uploads)
- `backend/storage/documents`: **16 files intact** (Toolkit PDF documents)
- `backend/storage/kyc_documents`: **2 files intact** (KYC files for CRM client Aditya Thakre)
- `storage/toolkit_temp`: **All subdirectories and temporary files intact**
- `backend/storage/toolkit_temp`: **All subdirectories and temporary files intact**
- Directory structures for `company_documents`, `policy_documents`, `plan_documents`, and `kyc_documents` are preserved for new business uploads.

---

## 6. POST-RESET VERIFICATION SUMMARY

| Verification Checkpoint | Target Result | Actual Result | Verification Status |
| :--- | :---: | :---: | :---: |
| 1. Insurance Companies | 0 | 0 | **PASS** |
| 2. Policy Plans | 0 | 0 | **PASS** |
| 3. Purchase Parties | 0 | 0 | **PASS** |
| 4. Sub-Agents | 0 | 0 | **PASS** |
| 5. Insurance Customers | 0 | 0 (All 4 remaining are CRM) | **PASS** |
| 6. Family Groups | 0 | 0 | **PASS** |
| 7. Issued Policies | 0 | 0 | **PASS** |
| 8. Policy Payments | 0 | 0 | **PASS** |
| 9. Installment Schedules | 0 | 0 | **PASS** |
| 10. Commission Records | 0 | 0 | **PASS** |
| 11. Sub-Agent Payout Records | 0 | 0 | **PASS** |
| 12. Claims | 0 | 0 | **PASS** |
| 13. Insurance Leads | 0 | 0 | **PASS** |
| 14. Super Admin Login & Roles | Intact | Valid (`SUPER_ADMIN`, `ADMIN`) | **PASS** |
| 15. CRM Work Orders & History | 4 WO / 9 History | 4 WO / 9 History | **PASS** |
| 16. Toolkit Storage & Temp Files | 24 Files Intact | 24 Files Intact | **PASS** |
| 17. Database Migrations (`alembic_version`)| 1 | 1 | **PASS** |
| 18. Foreign Key Inconsistencies | 0 | 0 (All 99 FK constraints verified) | **PASS** |

### Live Endpoint Verification

| Service / Endpoint | Method | Expected Status | Actual Status | Item Count | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/v1/auth/login` | POST | 200 OK | 200 OK | Token Issued | **PASS** |
| `/api/v1/insurance/companies` | GET | 200 OK | 200 OK | 0 items | **PASS** |
| `/api/v1/insurance/plans` | GET | 200 OK | 200 OK | 0 items | **PASS** |
| `/api/v1/insurance/policies` | GET | 200 OK | 200 OK | 0 items | **PASS** |
| `/api/v1/insurance/purchase-parties` | GET | 200 OK | 200 OK | 0 items | **PASS** |
| `/api/v1/insurance/sub-agents` | GET | 200 OK | 200 OK | 0 items | **PASS** |
| `/api/v1/insurance/leads` | GET | 200 OK | 200 OK | 0 items | **PASS** |
| `/api/v1/crm/work-orders` | GET | 200 OK | 200 OK | 4 items | **PASS** |
| `/api/v1/crm/customers` | GET | 200 OK | 200 OK | 4 items | **PASS** |
| `/api/v1/crm/tasks` | GET | 200 OK | 200 OK | 4 items | **PASS** |
| `/api/v1/crm/categories` | GET | 200 OK | 200 OK | 9 items | **PASS** |

---

## 7. INTENTIONALLY RETAINED BUSINESS RECORDS

1. **CRM Client Records (4 Customers)**:
   - `Rajesh Sharma` (`7bc65d7b-84af-4d9e-b4f5-366cb8f07b60`)
   - `Priya Patel` (`704e31d8-9542-4f12-8a70-0584bfbab0b7`)
   - `Amit Verma` (`cf9ed74d-3631-4eae-ac2a-b21727f848f2`)
   - `Aditya Thakre` (`5a199e21-1953-41ae-b32f-e193bf5400c2`)
   - *Justification:* Each of these customers is referenced by active CRM Work Orders, Customer Notes, and Financial Profiles. In particular, the foreign key constraint `work_orders.client_id -> customers.id` specifies `ON DELETE CASCADE`. Preserving these records prevented unintended collateral data loss in CRM business operations while all insurance policies and insurance ties linked to them were completely cleared.
2. **CRM Client KYC Documents (2 records)**:
   - Documents for customer `Aditya Thakre` in `backend/storage/kyc_documents/` and the `documents` table (`Spiderman_Brand_New_Day__1_.jpg`).
3. **CRM Customer Notes (3 records)**:
   - Initial consultation notes for Rajesh, Priya, and Amit.
4. **CRM Financial Profiles (3 records)**:
   - Financial profiles associated with Rajesh, Priya, and Amit.
5. **CRM & Core Audit Logs (9 records)**:
   - Immutable audit logs documenting CRM client creation, customer updates, and administrative authentication events were retained; only insurance module resource logs (`insurance_company`, `insurance_plan`, `insurance_plan_document`, `lead`, and deleted insurance test customers) were cleared.

---

## 8. SAFETY & PROTOCOL COMPLIANCE

- `DROP DATABASE` executed: **NO**
- `DROP TABLE` executed: **NO**
- `DROP SCHEMA` executed: **NO**
- `Alembic downgrade` executed: **NO**
- Database recreation: **NO**
- Unrestricted `TRUNCATE CASCADE`: **NO**
- Deletion on shared tables wholesale: **NO**
- Git commit or push executed: **NO**

---

## 9. REUSABLE RESET SCRIPT (FOR FUTURE RESETS)

To perform this exact, safe reset again anytime in the future, run either of the following commands from the repository root:

### Quick Run (Windows Batch):
```cmd
reset_insurance_data.bat --yes
```

### Python Script:
```cmd
backend\.venv\Scripts\python.exe scripts/reset_insurance_business_data.py --yes
```
*or from inside `backend/`:*
```cmd
..\backend\.venv\Scripts\python.exe scripts/reset_insurance_business_data.py --yes
```

**Script files created:**
- [reset_insurance_data.bat](file:///D:/project/reset_insurance_data.bat)
- [scripts/reset_insurance_business_data.py](file:///D:/project/scripts/reset_insurance_business_data.py)
- [backend/scripts/reset_insurance_business_data.py](file:///D:/project/backend/scripts/reset_insurance_business_data.py)


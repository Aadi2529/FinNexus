# COMMISSION DUMMY DATA CLEANUP AUDIT
**Date:** November 1, 2026  
**Database:** PostgreSQL (`finnexus_db` on port 5432)  
**Alembic Revision:** `d0e1f2a3b4c5`  
**Backup Archive:** `backend/backups/commission_tables_pre_cleanup_backup_20261101.json`

---

## 1. PRE-CLEANUP INVENTORY

A complete audit of `finnexus_db` before cleanup revealed the following record counts across related tables:

- `insurance_policy_commissions`: **13 records**
- `insurance_commission_receipts`: **4 records**
- `insurance_policies`: **11 records**
- `insurance_company_commission_agreements`: **5 records**
- `insurance_commission_splits`: **3 records**
- `insurance_companies`: **25 records**
- `insurance_plans`: **21 records**
- `insurance_sub_agents`: **3 records**

---

## 2. DETAILED RECORD AUDIT & CLASSIFICATION

Every commission record was audited against policy linkages, customer identities, insurance carriers, creation timestamps, and financial history.

### Category A: Genuine Historical Records (TO PRESERVE)

| Commission ID | Policy # | Customer | Insurer | Plan | Type | Gross (₹) | TDS (₹) | Net (₹) | Status | Receipts | Created At | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `e5f743d8-3c04-4b83-80b6-f7810d22fcc7` | `POL-HLTH-2026-70921` | Aditya Thakre | Niva Bupa Health Insurance | Reassure 2.0 | FIRST_YEAR | 2,250.00 | 225.00 | 2,025.00 | APPROVED | 0 | 2026-11-01 16:05:49 | **GENUINE_HISTORICAL_RECORDS** |
| `ebc0ee69-55ea-421f-8913-25b9f4771716` | `POL-HLTH-2026-47144` | Priya Deshmukh | Tata Aig | Medicare Select | FIRST_YEAR | 1,525.20 | 152.52 | 1,372.68 | APPROVED | 0 | 2026-11-01 16:56:11 | **GENUINE_HISTORICAL_RECORDS** |

*Verification:*
- Both policies were issued as real customer policies prior to the automated test runs.
- Both commissions are linked to real customers (`Aditya Thakre`, `Priya Deshmukh`) and established carriers (`Niva Bupa`, `Tata Aig`).
- Both records will remain **100% intact and untouched**.

---

### Category B: Confirmed Dummy / Test Records (PROPOSED DELETIONS)

The following 11 commission records were created during automated test execution (`test_insurance_commission_accounting_module.py` and `test_policy_documents_and_plan_inheritance.py`) between 17:38 and 17:44 on November 1, 2026:

| Commission ID | Policy # | Customer | Insurer | Type | Gross (₹) | Net (₹) | Status | Test Run Origin / Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `6fa0a2a3-56f1-4033-a976-d87060e010a8` | `POL-TEST-E2372C` | Rohan Verma | Test Carrier TEST-COMP-6153 | FIRST_YEAR | 1,500.00 | 1,350.00 | APPROVED | Test Suite 1 initial run (`test_first_year_...`) |
| `630790a5-edd4-46ab-ad00-a746dee7b03e` | `POL-TEST-3E5357` | Siddharth Rao | Test Carrier TEST-COMP-56BF | FIRST_YEAR | 1,500.00 | 1,350.00 | REVERSED | Test Suite 1 second run (Has 2 test receipts) |
| `a185a31d-048d-42ce-adbf-90108ec5ecd3` | `POL-TEST-3E5357` | Siddharth Rao | Test Carrier TEST-COMP-56BF | RENEWAL | 750.00 | 675.00 | PENDING | Test Suite 1 second run renewal hook |
| `44081039-5bcb-46cd-8412-d614fdb9d2a3` | `POL-A-F5538E` | PolicyUserF5538E TestClient | Carrier Inherit F5538E | FIRST_YEAR | 2,250.00 | 2,025.00 | PENDING | Policy issuance hook in document regression test |
| `0b3ec86f-3581-4f11-a0f2-be8a100ba10f` | `POL-B-F5538E` | PolicyUserF5538E TestClient | Carrier Inherit F5538E | FIRST_YEAR | 1,200.00 | 1,080.00 | PENDING | Policy issuance hook in document regression test |
| `4886e2fa-e80a-4110-80cb-acd511c5f689` | `POL-DL-333FCA` | PolicyUser333FCA TestClient | Carrier Inherit 333FCA | FIRST_YEAR | 1,800.00 | 1,620.00 | PENDING | Policy issuance hook in document regression test |
| `5d49fd96-5c1a-49d9-8b0e-9efd6c4d00bb` | `POL-SPEC-4C1566` | PolicyUser4C1566 TestClient | Carrier Inherit 4C1566 | FIRST_YEAR | 3,000.00 | 2,700.00 | PENDING | Policy issuance hook in document regression test |
| `bca8d908-ce34-48f7-b179-7c4054bc4a79` | `POL-VAL1-F7855D` | PolicyUserF7855D TestClient | Carrier Inherit F7855D | FIRST_YEAR | 1,500.00 | 1,350.00 | PENDING | Policy issuance hook in document regression test |
| `e5b63828-c3be-4da3-9bbc-2492a4fea895` | `POL-VAL2-F7855D` | PolicyUserF7855D TestClient | Carrier Inherit F7855D | FIRST_YEAR | 1,500.00 | 1,350.00 | PENDING | Policy issuance hook in document regression test |
| `659f676f-6a8a-4a73-86fa-a2a04ffecc92` | `POL-TEST-8A9F8F` | Siddharth Rao | Test Carrier TEST-COMP-36A3 | FIRST_YEAR | 1,500.00 | 1,350.00 | REVERSED | Final test run (Has 2 test receipts) |
| `3064a6d3-aae9-4dbf-a987-a981a48c4020` | `POL-TEST-8A9F8F` | Siddharth Rao | Test Carrier TEST-COMP-36A3 | RENEWAL | 750.00 | 675.00 | PENDING | Final test run renewal hook |

---

### Category C: Associated Test Receipt Records (PROPOSED DELETIONS)

The 4 receipts in `insurance_commission_receipts` are solely synthetic test deposits generated during automated test runs against test commissions `630790a5-edd4-46ab-ad00-a746dee7b03e` and `659f676f-6a8a-4a73-86fa-a2a04ffecc92`:

1. `157fe4b5-4e3a-4a77-b7ee-5295bd07f06d`: ₹800.00 (UTR: `UTR-PARTIAL-800`, Bank: HDFC Bank Ltd)
2. `587a7dcb-b3e1-4193-85b2-7f8d5edec7c5`: ₹550.00 (UTR: `UTR-FINAL-550`, Bank: HDFC Bank Ltd)
3. `58b835b1-d34f-460f-871c-c8d1de3fc2a2`: ₹800.00 (UTR: `UTR-PARTIAL-800`, Bank: HDFC Bank Ltd)
4. `0e4fc24f-dad3-49dd-9a14-e60d239ffe94`: ₹550.00 (UTR: `UTR-FINAL-550`, Bank: HDFC Bank Ltd)

---

### Category D: Ambiguous Records Requiring Manual Review

**Count: 0**  
Every single record in `insurance_policy_commissions` and `insurance_commission_receipts` has been unambiguously attributed to either the 2 original genuine policies or the automated test execution.

---

## 3. PROPOSED CLEANUP PLAN

1. Execute a transactional deletion of the 4 test receipt records from `insurance_commission_receipts`.
2. Execute a transactional deletion of the 11 confirmed dummy commission records from `insurance_policy_commissions`.
3. Preserve all 11 policies in `insurance_policies` (per rule: *"Do not delete entire policies to clean commission entries"*).
4. Preserve all customers, companies, plans, agreements, and splits.
5. Re-verify the 2 genuine historical commission entries:
   - `e5f743d8-3c04-4b83-80b6-f7810d22fcc7` (`POL-HLTH-2026-70921`, Gross: ₹2,250.00)
   - `ebc0ee69-55ea-421f-8913-25b9f4771716` (`POL-HLTH-2026-47144`, Gross: ₹1,525.20)
6. Verify total genuine Gross Commission: **₹3,775.20**.

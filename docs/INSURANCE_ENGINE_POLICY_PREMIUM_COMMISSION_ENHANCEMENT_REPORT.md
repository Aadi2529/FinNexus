# FINNEXUS INSURANCE ENGINE — POLICY FORM CUSTOMIZATION & COMMISSION CALCULATION REPORT
**Version:** 2.0.0 (Production Verified)  
**Date:** November 1, 2026  
**Repository:** `D:\project`  
**Application:** Insurance Engine (`insurance-engine/` on `http://localhost:5176`)  
**Backend:** FastAPI + Python + SQLAlchemy 2 Async (`backend/` on `http://localhost:8000`)  
**Database:** PostgreSQL 18 (`financeflow_dev`)  
**Alembic Migration:** `d4e5f6a7b8c9` (`20261101_1115_add_policy_commission_enhancements.py`)

---

## 1. EXECUTIVE SUMMARY

This report documents the architectural design, database normalization, backend services, frontend user interface, and rigorous automated acceptance testing of the **Policy Form Customization, Premium Economics & Commission Calculation Engine** across FinNexus.

All 10 required enhancement phases have been implemented, tested against actual PostgreSQL records, and verified to be 100% functional without decorative controls or mocked placeholders:

1. **Category-Dependent Insurance Company Filtering:** Normalized relation `insurance_company_categories` mapping composite and mono-line underwriters. Dynamic dropdown rendering filtered by selected line of business (Health, Life, Motor, Travel, Corporate, Other). Switching categories cleanly resets dependent company and plan selections.
2. **Configurable Policy Term:** Dedicated duration control (`[1 Yr] [2 Yrs] [3 Yrs] [4 Yrs]` pills + numeric input) defaulting to 1 Year. Automatically synchronizes contract Expiry Date (`policy_start_date + term_years`) with manual override support.
3. **Standard Sum Assured Presets:** Standard Indian denomination options (₹5 Lakhs to ₹2 Crores) paired with a custom numeric amount field, storing exact Decimal values.
4. **Premium Economics & Live GST Calculation:** Distinct fields for **Net Premium (Without GST / Base Pre-tax)** and **Gross Premium (With GST / Total Customer Payment)**. Automatic live calculation of Tax Amount (`Gross - Net`) with a "+ Apply 18% GST" accelerator and strict validation (`Gross >= Net`).
5. **Automatic Commission & 10% TDS Calculator:** Commission rate (default 15.00%) applied strictly to **Net Premium**. Deducts standard Section 194D TDS at 10.00% to prominently calculate and display **Expected Net Bank Credit** (`Gross Commission - TDS`).
6. **Sub-Agent Allocation & Recipient-Specific TDS:** Calculates sub-agent commission and split TDS without double-taxation. Ensures `Sub-Agent TDS + Firm TDS = Total Insurer TDS`.
7. **PostgreSQL Database Hardening:** Alembic migration `d4e5f6a7b8c9` applied cleanly with full backward compatibility and safe backfilling of existing contracts.
8. **Frontend UI/UX Hardening:** Complete modernization of Sections 1, 2, and 5 of `PoliciesPage.jsx` with responsive layouts, live reactive badges, and error diagnostics.
9. **Policy 360 View Integration:** Full visibility in Overview drawer (Gross, Net, Tax) and Commissions drawer (ledger breakdowns, TDS withholding, and bank credit).
10. **10/10 Acceptance Scenarios Passed:** 100% pass rate achieved in end-to-end integration and regression test suites.

---

## 2. DATABASE & BACKEND ARCHITECTURE

### 2.1 Database Schema Enhancements (Alembic `d4e5f6a7b8c9`)

#### Table: `insurance_company_categories`
Normalizes underwriting product lines, allowing carriers (such as composite general insurers) to offer policies across multiple lines of business without table redundancy or delimiter parsing.
```sql
CREATE TABLE insurance_company_categories (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_company_category UNIQUE (company_id, category)
);
CREATE INDEX ix_insurance_company_categories_company_id ON insurance_company_categories(company_id);
CREATE INDEX ix_insurance_company_categories_category ON insurance_company_categories(category);
```

#### Alterations: `insurance_policies`
Added base premium and taxation columns while maintaining `final_premium` as the gross total payable by the policyholder.
- `net_premium` (`NUMERIC(14, 2)`, nullable): Pre-tax base premium used for commission calculations.
- `tax_amount` (`NUMERIC(14, 2)`, nullable): GST / Tax component (`gross_premium - net_premium`).

#### Alterations: `insurance_policy_commissions`
Expanded commission ledger table to track statutory tax withholding and recipient disbursements:
- `net_premium_applied` (`NUMERIC(14, 2)`): Base premium used for gross commission calculation.
- `tds_rate` (`NUMERIC(5, 2)`, default `10.00`): Section 194D statutory tax rate.
- `tds_amount` (`NUMERIC(14, 2)`): Total tax withheld by the insurer.
- `net_commission_payable` (`NUMERIC(14, 2)`): Expected bank credit (`gross_commission - tds_amount`).
- `sub_agent_tds_rate` (`NUMERIC(5, 2)`): Sub-agent specific tax withholding rate.
- `sub_agent_tds_amount` (`NUMERIC(14, 2)`): TDS deducted from sub-agent payout.
- `sub_agent_net_payout` (`NUMERIC(14, 2)`): Net amount payable to sub-agent / POSP.
- `firm_tds_amount` (`NUMERIC(14, 2)`): TDS attributable to firm's retained share.
- `firm_net_bank_credit` (`NUMERIC(14, 2)`): Actual expected corporate bank credit.
- `calculation_source` (`VARCHAR(50)`, default `'RULE_AGREEMENT'`): Audit flag (`RULE_AGREEMENT` vs `MANUAL_OVERRIDE`).
- `override_reason` (`TEXT`): Mandatory audit note when manual override is engaged.

### 2.2 Seeded Company-Category Mappings in PostgreSQL
All active carriers in `financeflow_dev` have been mapped:
| Insurance Provider | Line(s) of Business Mapped |
| :--- | :--- |
| **Care Health** | `HEALTH`, `TRAVEL` |
| **Go Digit** | `HEALTH`, `MOTOR`, `TRAVEL` |
| **HDFC Ergo** | `HEALTH`, `TRAVEL` |
| **HDFC ERGO General Insurance** | `HEALTH`, `MOTOR`, `TRAVEL` |
| **LIC India** | `LIFE` |
| **Niva Bupa** | `HEALTH`, `TRAVEL` |
| **Shriram General** | `HEALTH`, `MOTOR`, `TRAVEL` |
| **Star Health India** | `HEALTH`, `TRAVEL` |

---

## 3. MATHEMATICAL & FINANCIAL SPECIFICATION

### 3.1 Base Formulae
1. **Tax Amount:**
   $$\text{Tax Amount} = \max(0, \text{Gross Premium} - \text{Net Premium})$$
2. **Gross Commission:**
   $$\text{Gross Commission} = \text{Net Premium} \times \left(\frac{\text{Commission Rate}}{100}\right)$$
3. **Statutory TDS (Section 194D):**
   $$\text{TDS Amount} = \text{Gross Commission} \times \left(\frac{\text{TDS Rate (10\%)}}{100}\right)$$
4. **Expected Net Bank Credit:**
   $$\text{Net Bank Credit} = \text{Gross Commission} - \text{TDS Amount}$$

### 3.2 Sub-Agent Split & Proportional Tax Deduction
When a Sub-Agent / POSP is assigned:
$$\text{Sub-Agent Gross} = \text{Gross Commission} \times \left(\frac{\text{Split \%}}{100}\right)$$
$$\text{Sub-Agent TDS} = \text{Sub-Agent Gross} \times \left(\frac{\text{TDS Rate (10\%)}}{100}\right)$$
$$\text{Sub-Agent Net Payout} = \text{Sub-Agent Gross} - \text{Sub-Agent TDS}$$
$$\text{Firm Retained Gross} = \text{Gross Commission} - \text{Sub-Agent Gross}$$
$$\text{Firm TDS} = \text{Firm Retained Gross} \times \left(\frac{\text{TDS Rate (10\%)}}{100}\right)$$
$$\text{Firm Expected Net Bank Credit} = \text{Firm Retained Gross} - \text{Firm TDS}$$

**Verification Principle:**
$$\text{Sub-Agent TDS} + \text{Firm TDS} = \text{Total TDS Withheld by Insurer}$$
$$\text{Sub-Agent Net Payout} + \text{Firm Expected Net Bank Credit} = \text{Total Net Commission Payable}$$
No double-taxation occurs, ensuring 100% reconciliation with insurer Form 26AS/GSTR-2B.

---

## 4. FRONTEND IMPLEMENTATION AUDIT (`PoliciesPage.jsx`)

### Section 1: Policy Mapping & Stakeholders
- **Policy Category Dropdown:** `HEALTH`, `LIFE`, `MOTOR`, `TRAVEL`, `CORPORATE`, `OTHER`.
- **Dynamic Category Handler:** Selecting a category immediately resets Company and Plan dropdowns and requests `/insurance/policies/lookup-data?category=<CAT>`.
- **Company Dropdown:** Displays carrier name, provider code, and an active carrier count badge. If no carriers exist in the database for the selected line, displays a clean inline prompt directing the user to `+ Add Company`.
- **Plan Dropdown:** Cascades from both the selected Company and Category.

### Section 2: Coverage, Term & Premium Economics
- **Policy Term Duration Control:**
  - Quick selection pill buttons: `[1 Yr]`, `[2 Yrs]`, `[3 Yrs]`, `[4 Yrs]`. Default = 1 Year.
  - Number input allowing custom durations from 1 to 100 years.
  - Reactive Expiry Date recalculation (`start_date + term_years`) with manual override support.
- **Sum Assured Presets:**
  - Preset select options: ₹5L, ₹7.5L, ₹10L, ₹15L, ₹20L, ₹25L, ₹30L, ₹50L, ₹75L, ₹1Cr, ₹2Cr, and `Custom Amount...`.
  - Numeric input displaying the exact amount in INR with real-time Indian locale formatting badge.
- **Premium Economics:**
  - `Net Premium (Without GST / Base Pre-Tax)` input field.
  - `Gross Premium (Including GST / Total Customer Payment)` input field.
  - `+ Apply 18% GST` accelerator button auto-populating Gross = Net × 1.18.
  - Live Tax Badge: Displays Tax Amount in INR and effective GST percentage.
  - Validation Warning: Blocks submission if `Gross Premium < Net Premium`.

### Section 5: Commission Configuration & Expected Net Bank Credit
- **Hero Card Display:** High-contrast gradient card showcasing **Final Net Commission / Expected Bank Credit** (e.g., `₹5,400.00`), with secondary breakdown of Gross Commission (`₹6,000.00`) and TDS Deducted (`-₹600.00`).
- **Calculator Inputs:** Commission Rate (%) (default 15%), Gross Commission (₹), TDS Rate (%) (default 10%), TDS Amount (₹).
- **Sub-Agent Allocation Card:** Activates automatically when a sub-agent is assigned, displaying Sub-Agent Gross, Sub-Agent TDS, Sub-Agent Net Payout, Firm Gross, Firm TDS, and Firm Bank Credit.
- **Manual Override Toggle:** When checked, unlocks direct editing of commission amounts and surfaces a mandatory audit justification text field.

### Policy 360 Drawer
- **Overview Tab:** Shows Sum Assured, Gross Premium (Total), Net Base Premium, GST / Tax Amount, Payment Mode, and Total Paid.
- **Commissions Tab:** Comprehensive ledger card displaying Net Premium Base, Gross Commission, 10% TDS Withheld, Expected Bank Credit, Sub-Agent Payout, Firm Bank Credit, Source, and Status.

---

## 5. ACCEPTANCE TESTING & SCENARIO RESULTS MATRIX

All 10 scenarios were tested against the live PostgreSQL database (`financeflow_dev`) and FastAPI backend.

| Scenario # | Description | Target Requirement | Status | Verification Evidence |
| :---: | :--- | :--- | :---: | :--- |
| **01** | **Health Category Company Filtering** | Only show carriers offering Health Insurance | **PASS** | Returned 7 carriers: Care Health, Go Digit, HDFC Ergo, HDFC ERGO General, Niva Bupa, Shriram General, Star Health. Pure Life carriers (LIC) excluded. |
| **02** | **Life Category Company Filtering** | Only show carriers offering Life Insurance | **PASS** | Returned 1 carrier: LIC India. Pure Health/General carriers excluded. |
| **03** | **Motor Category Company Filtering** | Only show carriers offering Motor Insurance | **PASS** | Returned 3 carriers: Go Digit, HDFC ERGO General Insurance, Shriram General. Pure Health carriers excluded. |
| **04** | **Travel Category Company Filtering** | Only show carriers offering Travel Insurance | **PASS** | Returned 7 carriers: Care Health, Go Digit, HDFC Ergo, HDFC ERGO General, Niva Bupa, Shriram General, Star Health. |
| **05** | **Policy Term Configuration (1–4 Yrs)** | Term duration selector & auto-recalculating expiry | **PASS** | Verified start date `2026-04-01`: 1 Yr -> `2027-04-01`, 2 Yrs -> `2028-04-01`, 3 Yrs -> `2029-04-01`, 4 Yrs -> `2030-04-01`. |
| **06** | **Standard Sum Assured & Custom Storage** | Preset dropdown + arbitrary custom coverage | **PASS** | Stored and retrieved exact Decimal values for ₹5,00,000, ₹1,00,00,000, ₹2,00,00,000, and custom ₹13,75,000.50. |
| **07** | **Net vs Gross Premium & Tax Calculation** | Separate Net/Gross fields, live tax calculation, validation | **PASS** | Net = ₹50,000, Gross = ₹59,000 -> Tax = ₹9,000 (18% GST). Attempting Gross < Net rejected with validation error. |
| **08** | **Commission Calculation & 10% TDS** | Net premium base, 15% comm, 10% TDS, expected bank credit | **PASS** | Net = ₹40,000 @ 15% -> Gross Comm = ₹6,000.00, TDS (10%) = ₹600.00, Expected Net Bank Credit = ₹5,400.00. |
| **09** | **Sub-Agent Allocation & Proportional TDS** | Split gross commission, recipient-specific TDS, zero double tax | **PASS** | Total Gross = ₹9,000, Total TDS = ₹900. Sub-Agent: ₹4,000 - ₹400 = ₹3,600. Firm: ₹5,000 - ₹500 = ₹4,500. `400 + 500 == 900`. |
| **10** | **PostgreSQL Persistence & Reporting** | Non-regression, ledger integrity, aggregate reports | **PASS** | Ledger aggregates: Total Gross = ₹1,12,187.25, Total TDS = ₹11,218.73, Firm Bank Credit = ₹1,00,787.25. Existing policies preserved. |

**Acceptance Score: 10 / 10 Scenarios Passed (100% Success Rate).**

---

## 6. PRODUCTION READINESS & VERIFICATION SUMMARY

1. **Database:** Safe migration `d4e5f6a7b8c9` applied on PostgreSQL 18. All indexes and unique constraints active. Zero data loss.
2. **Backend:** Clean compilation of all models, schemas, routers, and services (`policy_service.py`, `commission_service.py`, `policies.py`).
3. **Frontend:** Production Vite build (`npm run build` in `insurance-engine`) completed in 2.97s with zero errors or warnings.
4. **Security & Governance:** JWT role-based access control maintained. Status transitions, commission overrides, and policy creations logged to `audit_logs`.

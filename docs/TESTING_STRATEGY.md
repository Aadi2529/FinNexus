# Testing Strategy & Quality Assurance — FinanceFlow

**Document Version:** 1.0.0  
**Phase:** Phase 0 — Project Initialization  
**Status:** Approved Baseline  
**Target Coverage:** >= 85% Core Business Logic & Financial Engines

---

## 1. Testing Philosophy & Test Pyramid

FinanceFlow adopts a rigorous testing pyramid to ensure that financial accuracy, role security, and user interactions operate without failure.

```
       / \
      / E2E \         Playwright (Critical User Flows in Headless Chrome)
     /-------\
    / Integr. \       Pytest + AsyncClient + Test Database (API & Auth & DB Constraints)
   /-----------\
  /  Unit Tests \     Pytest & Vitest (Math Formulas, Pydantic DTOs, React Components)
 /---------------\
```

---

## 2. Test Suites & Frameworks

### 2.1 Backend Unit & Integration Tests (Pytest)
- **Framework:** `pytest`, `pytest-asyncio`, `httpx` (AsyncClient).
- **Location:** `backend/app/tests/`.
- **Target Areas:**
  - **Financial Math:** Test EMI, amortization, and SIP algorithms against official banking calculation benchmarks (including edge cases: zero interest rates, high tenures, leap years, step-up increments).
  - **Schema Validation:** Verify Pydantic v2 validation errors on malformed payloads (negative incomes, invalid email/PAN formats).
  - **Authentication & RBAC:** Verify token generation, signature validation, expired token rejection, Redis blacklist checks, and role guard enforcement.
  - **Database Persistence:** Test SQLAlchemy 2.0 models, foreign key cascades, and unique constraint enforcement using a dedicated test PostgreSQL or SQLite database.

### 2.2 Frontend Unit & Component Tests (React Testing Library)
- **Framework:** `vitest`, `@testing-library/react`, `@testing-library/user-event`.
- **Location:** `frontend/src/__tests__/` or colocated `*.test.jsx`.
- **Target Areas:**
  - **UI Components:** Verify button states, modal dialog triggers, form validation messages, and accessible attributes (`aria-*`).
  - **Custom Hooks:** Test `useAuth`, `useCalculator`, and debounced search hooks in isolation.
  - **Contexts:** Test authentication state transitions (login, logout, session expiration).

### 2.3 End-to-End Browser Tests (Playwright)
- **Framework:** `@playwright/test`.
- **Location:** `tests/e2e/`.
- **Critical User Journeys Tested:**
  1. **Authentication Flow:** User logs in with valid credentials, receives tokens, navigates to Dashboard, and logs out.
  2. **Loan Officer Pipeline Flow:** Officer logs in -> creates new customer with financial profile -> attaches an interaction note -> assigns an SLA task -> verifies customer displays in CRM directory.
  3. **Financial Toolkit Flow:** Officer navigates to EMI Calculator -> inputs principal, interest, and tenure -> generates amortization schedule -> exports or verifies output table.
  4. **Document Vault Flow:** Officer uploads sample KYC PDF -> verifies document appears in pending list -> Auditor logs in and approves the document.

---

## 3. Test Data Management & Fixtures

1. **Synthetic Data Policy:** All tests must use synthetic, generated data. Real customer names, real PAN numbers, or real identity proofs must never be used.
2. **Deterministic Seeds:** Financial calculation unit tests use fixed, deterministic numerical seeds to ensure reproducibility across machines.
3. **Pytest Fixtures:**
   - `db_session`: Yields a clean transaction per test and rolls it back automatically.
   - `client`: Provides an unauthenticated `httpx.AsyncClient`.
   - `auth_headers`: Helper fixture returning valid Bearer JWT headers for `ROLE_ADMIN`, `ROLE_OFFICER`, and `ROLE_AUDITOR`.

---

## 4. Continuous Integration (CI) Workflow

Every Pull Request and commit to `main` triggers automated GitHub Actions checks:
1. **Lint & Style Check:** Flake8 / Black for Python, ESLint for React.
2. **Backend Unit & Integration:** Runs `pytest --cov=app --cov-report=xml`.
3. **Frontend Tests:** Runs `npm run test:unit`.
4. **Build Verification:** Executes `npm run build` to verify Vite bundle compilation without errors.
5. **E2E Smoke Tests:** Playwright executes core smoke tests against containers spun up in CI.

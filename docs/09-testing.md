# 09 — FinNexus Testing & Quality Assurance

## 1. Testing Strategy & Test Infrastructure

FinNexus employs an automated testing strategy designed around **deterministic in-memory isolation**, **zero-side-effect test databases**, and **high-speed asynchronous execution**.

### 1.1 In-Memory Test Engine (`sqlite+aiosqlite`)
Rather than risking truncation or corruption of live PostgreSQL databases, backend integration tests execute against an ephemeral, in-memory SQLite database:
```python
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="function")
async def test_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    ...
    async with session_maker() as session:
        await seed_initial_data(session)
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```
- **Isolated Lifecycles**: Every test function executes against fresh, clean tables populated with canonical seed catalogs.
- **Fast Execution**: Over 50 integration assertions complete in under 90 seconds.

### 1.2 ASGI Test Client (`HTTPX`)
Tests bind directly to the FastAPI ASGI application via `httpx.ASGITransport(app=app)`. Network socket overhead is eliminated; HTTP calls invoke ASGI handlers directly in-memory.

---

## 2. Backend Test Suites Inventory

Located under [`backend/tests/`](file:///d:/project/backend/tests/):

| Test File | Focus Area | Scenarios Verified | Verified Execution Time |
|---|---|---|:---:|
| [`test_category_checklist_reordering.py`](file:///d:/project/backend/tests/test_category_checklist_reordering.py) | Drag-and-drop checklist reordering | 10 scenarios: drag last to first, drag first to last, middle reorder, step additions, step deletions, multi-attribute updates, persistence across re-fetch, legacy categories without positions, 403 unauthorized checks, and work order auto-seeding. | **PASSED** (67.5s) |
| [`test_crm_rbac.py`](file:///d:/project/backend/tests/test_crm_rbac.py) | Security and RBAC barriers | 15 scenarios: 401 unauthenticated, Super Admin control, Admin branch operations, Employee creation limits, 403 edit/delete/reassign blocks, checklist permissions, supervisor override, audit logging, and token tampering. | **PASSED** |
| [`test_crm_clients.py`](file:///d:/project/backend/tests/test_crm_clients.py) | Customer 360 dossiers | Customer creation, PAN uniqueness, phone validation, financial profile calculations, and soft archive toggling. | **PASSED** |
| [`test_crm_work_orders.py`](file:///d:/project/backend/tests/test_crm_work_orders.py) | Work order lifecycle | Order creation, sequential order numbering (`WO-YYYYMMDD-XXXX`), and checklist item cloning. | **PASSED** |
| [`test_crm_scheduling_and_pipeline.py`](file:///d:/project/backend/tests/test_crm_scheduling_and_pipeline.py) | Work order scheduling | Due date validation, multi-recipient reminders, calendar matrix, and status progression. | **PASSED** |
| [`test_crm_module_integration.py`](file:///d:/project/backend/tests/test_crm_module_integration.py) | CRM cross-module flows | Customer dossiers, interaction notes, SLA tasks, and work orders in a continuous workflow. | **PASSED** |
| [`test_toolkit_suite.py`](file:///d:/project/backend/tests/test_toolkit_suite.py) | Document processor & calculators | 23 assertions: Aadhaar auto-crop, PAN auto-crop, password unlock, PDF merger, images-to-PDF, EMI, SIP, and eligibility calculations. | **PASSED** |
| [`test_health.py`](file:///d:/project/backend/tests/test_health.py) | Health probes | `/live` probe, `/ready` probe (DB + Redis connectivity), and comprehensive system diagnostics. | **PASSED** |
| [`test_database_models.py`](file:///d:/project/backend/tests/test_database_models.py) | ORM relational integrity | Primary keys, unique indexes, check constraints (CIBIL range, positive income), cascading deletes, and default timestamps. | **PASSED** |
| [`test_enterprise_platform.py`](file:///d:/project/backend/tests/test_enterprise_platform.py) | Platform-wide contracts | CORS headers, HTTP security headers, error format consistency, and OpenAPI schema validity. | **PASSED** |
| [`test_migrations.py`](file:///d:/project/backend/tests/test_migrations.py) | Alembic migrations | Upward migration execution and clean downward rollback. | **PASSED** |
| [`test_user_management_and_cleanup.py`](file:///d:/project/backend/tests/test_user_management_and_cleanup.py) | User governance & cleanup | Super Admin provisioning, dynamic staff registration, role assignment, and demo data cleanup. | **PASSED** |

---

## 3. Frontend Unit & Build Testing

### 3.1 Toolkit Unit Tests
- **File**: [`toolkit/tests/dateFormatter.test.js`](file:///d:/project/toolkit/tests/dateFormatter.test.js)
- **Coverage**: Validates date normalization regex across Indian formats:
  - `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY` $\rightarrow$ Standardized `DD/MM/YYYY`.
  - Leap year edge cases (`29/02/2024`).
  - Rejection of invalid dates (`31/04/2023`, `99/99/9999`).

### 3.2 Frontend Production Builds
Executed via `npm run build` in each workspace:
```bash
npm run build:crm
npm run build:dashboard
npm run build:toolkit
npm run build:insurance
```
- **CRM Production Build Result**: `vite build` completed in **2.78s** with 0 errors. Chunks rendered cleanly with minified CSS (45.4 kB) and JS bundle.

---

## 4. Test Execution Commands

### Run Complete Checklist Reordering Suite
```powershell
backend\.venv\Scripts\pytest backend\tests\test_category_checklist_reordering.py -v
```

### Run Full RBAC Security Suite
```powershell
backend\.venv\Scripts\pytest backend\tests\test_crm_rbac.py -v
```

### Run Toolkit & Document Processing Tests
```powershell
backend\.venv\Scripts\pytest backend\tests\test_toolkit_suite.py -v
```

### Run Health & Platform Enterprise Tests
```powershell
backend\.venv\Scripts\pytest backend\tests\test_health.py backend\tests\test_enterprise_platform.py -v
```

---

## 5. Testing Gap Analysis & Future Recommendations

| Area | Current Status | Identified Gap | Recommendation |
|---|---|---|---|
| **E2E Browser Automation** | Manual verification + API tests | Automated Playwright / Cypress browser tests across all 4 SPAs are not yet in CI. | Integrate Playwright headless tests simulating drag-and-drop actions across browser viewports. |
| **Large File Load** | Verified up to 25 MB | Stress tests on concurrent 50 MB PDF document merge operations. | Add locust or k6 performance tests under high concurrent upload load. |
| **Cross-Origin Cookie Storage** | LocalStorage used for tokens | LocalStorage shared on localhost; production multi-subdomain setups benefit from `HttpOnly` secure cookies. | Evaluate partitioned secure cookies for enterprise SSO deployments. |

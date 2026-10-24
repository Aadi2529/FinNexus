# 11 — FinNexus Developer Onboarding & Contribution Guide

## 1. Welcome to FinNexus

This guide is designed to help a software engineer joining the FinNexus team become productive on day one.

### 1.1 The Core Mental Model
To understand FinNexus, keep these three structural principles in mind:
1. **One Backend, Four Interfaces**: All business logic, persistence, and cryptographic verification live in `backend/app`. The four frontend folders (`dashboard`, `crm`, `toolkit`, `insurance-engine`) are lightweight React SPAs that communicate via HTTP REST to `http://localhost:8000/api/v1`.
2. **Tokens are Key to Everything**: Every request passes an access token in the `Authorization` header. The backend dependency `get_current_user` validates the JWT, checks Redis to ensure it wasn't revoked on logout, and resolves the user's roles.
3. **Checklists Drive Operations**: In CRM, work is structured as Work Orders created under Work Categories. Categories define the preset milestones (which can be dragged and dropped to reorder). Work orders clone these milestones and track completion percentage.

---

## 2. Tracing a Request End-to-End

To see how the platform connects together, trace a **Work Order Update**:

```
[User clicks 'Save' in crm/src/pages/WorkOrderDetailPage.jsx]
   │
   ▼
[crm/src/services/api.js: crmAPI.updateWorkOrder(id, payload)]
   │
   ▼
[HTTP PUT /api/v1/crm/work-orders/{id}]
   │
   ▼
[backend/app/main.py: CORSMiddleware evaluates Origin header]
   │
   ▼
[backend/app/core/dependencies.py: get_current_user decodes JWT & checks Redis]
   │
   ▼
[backend/app/core/dependencies.py: require_roles(["ADMIN", "MANAGER", ...])]
   │
   ▼
[backend/app/api/crm.py: update_work_order handler executes]
   │
   ▼
[SQLAlchemy session updates work_orders row & inserts into work_order_history]
   │
   ▼
[backend/app/schemas/crm.py: WorkOrderSchema serializes model to JSON]
   │
   ▼
[HTTP 200 OK returned to browser -> React state updates UI]
```

---

## 3. Step-by-Step Feature Implementation Workflows

### 3.1 How to Add a New API Endpoint

1. **Define Pydantic Request/Response Schemas**:
   In `backend/app/schemas/<module>.py`, create validation models:
   ```python
   class LeadAssignmentRequest(BaseModel):
       officer_id: uuid.UUID
       notes: str | None = None
   ```
2. **Implement Route Handler in `backend/app/api/<module>.py`**:
   ```python
   @router.post("/customers/{customer_id}/assign", response_model=CustomerSchema)
   async def assign_customer_lead(
       customer_id: uuid.UUID,
       payload: LeadAssignmentRequest,
       current_user: User = Depends(require_roles(["ADMIN", "MANAGER"])),
       session: AsyncSession = Depends(get_db_session),
   ) -> CustomerSchema:
       ...
   ```
3. **Register Service Function (if complex domain logic)** in `backend/app/services/`.
4. **Expose in Frontend API Client**:
   In `crm/src/services/api.js`:
   ```javascript
   assignCustomer: (id, payload) => fetchWithAuth(`/crm/customers/${id}/assign`, {
     method: 'POST',
     body: JSON.stringify(payload),
   }),
   ```
5. **Write an Automated Integration Test**:
   In `backend/tests/test_crm_clients.py`:
   ```python
   @pytest.mark.asyncio
   async def test_assign_customer_lead(client: AsyncClient):
       ...
   ```

---

### 3.2 How to Modify Database Models & Create Alembic Migrations

1. **Update SQLAlchemy Models**:
   Modify entity classes in `backend/app/db/models/`.
2. **Generate Autocommit Migration**:
   ```powershell
   cd d:\project\backend
   .\.venv\Scripts\Activate.ps1
   alembic revision --autogenerate -m "add_lead_source_field"
   ```
3. **Inspect the Generated Migration File**:
   Check `backend/alembic/versions/` to verify `upgrade()` and `downgrade()` logic.
4. **Apply Migration**:
   ```powershell
   alembic upgrade head
   ```

---

### 3.3 How to Add a New Drag-and-Drop Sortable Step in Frontend

When working with `@dnd-kit` in `crm/src/pages/CategoriesPage.jsx`:
- Always generate stable unique IDs via `generateStepId()`.
- **Never** use array index keys for sortable items.
- Ensure the drag handle button alone receives `{...attributes} {...listeners}`.
- Attach `touch-none` to drag handles to avoid touch scrolling conflicts.

---

## 4. Coding Conventions & Quality Standards

### 4.1 Python (Backend)
- **Target Version**: Python 3.12+.
- **Formatter & Linter**: Ruff (`ruff check .` and `ruff format .`).
- **Typing**: Use standard Python 3.10+ union types (`int | None`, `list[dict]`).
- **Docstrings**: Provide triple-quoted docstrings on all routers, dependencies, and complex helpers.
- **Async Safety**: Always use `await` on database operations (`session.execute`, `session.flush`, `session.commit`).

### 4.2 JavaScript & React (Frontend)
- **Functional Components**: Use arrow functions or standard function components with hooks.
- **Styling**: Tailwind utility classes only. Adhere to the glassmorphic dark/teal palette (`bg-slate-900`, `bg-teal-600`, `border-slate-200/90`).
- **Icons**: Import exclusively from `lucide-react`.

---

## 5. Pull Request & Verification Checklist

Before opening a pull request, verify that:
- [ ] Backend test suites pass: `pytest backend/tests/test_category_checklist_reordering.py backend/tests/test_crm_rbac.py`.
- [ ] Frontend builds pass without errors: `npm run build:crm`.
- [ ] No hardcoded secrets, passwords, or private tokens are committed.
- [ ] Database schema changes include a corresponding Alembic migration.
- [ ] New API endpoints include Pydantic request/response schemas and docstrings.

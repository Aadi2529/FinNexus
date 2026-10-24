# 04 — FinNexus Function & Class Reference

This document provides a technical reference of business-critical functions, classes, and services verified in the FinNexus codebase.

---

## 1. Authentication & Security Services

### 1.1 `hash_password(plain_password: str) -> str`
- **File**: [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py#L38)
- **Purpose**: Generates a secure cryptographic hash for user passwords. Utilizes Argon2id where available with automatic fallback to Bcrypt (`bcrypt.gensalt(12)`).
- **Parameters**: `plain_password` (str) — Raw user password.
- **Returns**: `str` — Formatted hashed string including algorithm, salt, and parameters.
- **Side Effects**: None (pure cryptographic computation).
- **Related Tests**: [`backend/tests/test_crm_rbac.py`](file:///d:/project/backend/tests/test_crm_rbac.py).

### 1.2 `verify_password(plain_password: str, hashed_password: str) -> bool`
- **File**: [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py#L55)
- **Purpose**: Verifies whether a supplied plain password matches the stored cryptographic hash using constant-time comparison to prevent timing attacks.
- **Parameters**:
  - `plain_password` (str)
  - `hashed_password` (str)
- **Returns**: `bool` — `True` if valid, `False` otherwise.
- **Related Tests**: [`backend/tests/test_user_management_and_cleanup.py`](file:///d:/project/backend/tests/test_user_management_and_cleanup.py).

### 1.3 `create_access_token(user_id: str, email: str, roles: list[str], full_name: str | None = None) -> tuple[str, str, datetime]`
- **File**: [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py#L65)
- **Purpose**: Assembles JWT claims and signs an access token using HMAC-SHA256.
- **Parameters**:
  - `user_id` (str) — Stringified UUID of the authenticated user.
  - `email` (str) — Normalized email address.
  - `roles` (list[str]) — List of assigned role names (e.g. `["ADMIN", "SUPER_ADMIN"]`).
  - `full_name` (str | None) — Display name.
- **Returns**: `tuple[str, str, datetime]` — `(encoded_jwt, jti_uuid_str, expiration_datetime)`.
- **Business Rules**: Injects a unique `jti` (JWT ID) into claims enabling selective token revocation. Expiry is set to `settings.ACCESS_TOKEN_EXPIRE_MINUTES` (default 15 minutes).

### 1.4 `generate_refresh_token() -> tuple[str, str, datetime]`
- **File**: [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py#L90)
- **Purpose**: Generates a 64-character high-entropy cryptographic hex token (`secrets.token_hex(32)`), its SHA-256 hash for database storage, and expiration timestamp (default 7 days).
- **Returns**: `tuple[str, str, datetime]` — `(raw_token, token_hash, expires_at)`.
- **Database Effects**: The raw token is returned only to the client; only `token_hash` is written to `refresh_tokens`.

### 1.5 `blacklist_token_jti(jti: str, remaining_seconds: int) -> None`
- **File**: [`backend/app/core/security.py`](file:///d:/project/backend/app/core/security.py#L110)
- **Purpose**: Records a revoked access token's JTI in Redis with a TTL equal to its remaining lifespan, ensuring immediate session termination on logout.
- **Database/Redis Effects**: Executes `SETEX blacklist:{jti} remaining_seconds "revoked"`.

### 1.6 `require_roles(required_roles: list[str])`
- **File**: [`backend/app/core/dependencies.py`](file:///d:/project/backend/app/core/dependencies.py#L65)
- **Purpose**: Dependency factory returning an async role-verification function.
- **Parameters**: `required_roles` (list[str]) — Allowed role names (e.g. `["ADMIN", "SUPER_ADMIN"]`).
- **Exceptions**: Raises `HTTPException(403, detail="Insufficient role privileges")` if the authenticated user's roles do not intersect `required_roles`.
- **Related Tests**: [`backend/tests/test_crm_rbac.py`](file:///d:/project/backend/tests/test_crm_rbac.py#L180).

---

## 2. CRM & Work Order Services

### 2.1 `_normalize_checklist_template(template: list[dict] | None) -> list[dict] | None`
- **File**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L1729)
- **Purpose**: Sanitizes checklist template steps submitted from the drag-and-drop UI, guaranteeing sequential 0-based `position` integers matching the submitted array sequence.
- **Parameters**: `template` (list[dict] | None) — Raw checklist step dictionaries from request body.
- **Returns**: `list[dict] | None` — Clean list with sanitized titles and normalized `position: 0, 1, 2...`.
- **Callers**: `create_work_category` (line 1756), `update_work_category` (line 1797).
- **Related Tests**: [`backend/tests/test_category_checklist_reordering.py`](file:///d:/project/backend/tests/test_category_checklist_reordering.py).

### 2.2 `create_work_order(payload: WorkOrderCreate, current_user: User, session: AsyncSession) -> WorkOrderSchema`
- **File**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L680)
- **Purpose**: Creates an operational work order. Generates sequential order numbers, clones category checklist templates, and logs creation audit events.
- **Business Logic**:
  1. Generates `order_number` formatted as `WO-YYYYMMDD-XXXX`.
  2. If `payload.checklist_items` is empty, auto-seeds checklist steps from `category.checklist_template` in sequential position order.
  3. Inserts a record into `work_order_history` with action `CREATED`.
  4. If `assigned_to_id` is specified, generates an in-app `CrmNotification`.
- **Database Operations**: `INSERT INTO work_orders`, `INSERT INTO work_order_checklist_items`, `INSERT INTO work_order_history`, `INSERT INTO crm_notifications`.
- **Exceptions**: Raises `HTTP 404` if client or category not found; `HTTP 400` if due date in past.

### 2.3 `override_work_order_completion(work_order_id: uuid.UUID, payload: OverrideRequest, current_user: User, session: AsyncSession) -> WorkOrderSchema`
- **File**: [`backend/app/api/crm.py`](file:///d:/project/backend/app/api/crm.py#L975)
- **Purpose**: Permits supervisors (`ADMIN`, `SUPER_ADMIN`, `MANAGER`) to force-complete a work order even if certain checklist milestones remain incomplete.
- **Validation**: Requires `payload.reason` with a minimum length of 10 characters.
- **Database Operations**: Updates `work_orders.status = 'COMPLETED'`, `completed_at = now()`, `progress_percent = 100`. Writes an immutable record to `work_order_history` documenting actor ID, override reason, and incomplete items bypass.
- **Related Tests**: [`backend/tests/test_crm_rbac.py`](file:///d:/project/backend/tests/test_crm_rbac.py#L480).

---

## 3. Document Processing Engine

### 3.1 `process_aadhaar_document(file_bytes: bytes, filename: str, password: str | None = None, client_name: str | None = None) -> ProcessedDocumentResult`
- **File**: [`backend/app/services/document_processing/aadhaar_service.py`](file:///d:/project/backend/app/services/document_processing/aadhaar_service.py#L45)
- **Purpose**: Complete end-to-end processing pipeline for Indian Aadhaar cards.
- **Pipeline Stages**:
  1. **Decryption**: If PDF is encrypted, attempts `password` followed by heuristic permutations via `attempt_pdf_unlock`.
  2. **Crop Calculation**: Computes bounding box using fixed ratios:
     - `top = 0.72`, `left = 0.08`, `bottom = 0.07`, `right = 0.08`.
  3. **High-Res Rendering**: Renders cropped card pixmap via PyMuPDF at 300 DPI (`zoom = 300 / 72 ≈ 4.166`).
  4. **Output Naming**: Formats standardized filename via `build_output_filename(client_name, "Aadhaar")`.
  5. **Export**: Compiles final cropped PDF/A and base64 PNG preview.
- **Exceptions**: `PasswordRequiredError`, `InvalidDocumentFormatError`, `ProcessingTimeoutError`.
- **Related Tests**: [`backend/tests/test_toolkit_suite.py`](file:///d:/project/backend/tests/test_toolkit_suite.py#L80).

### 3.2 `process_pan_document(file_bytes: bytes, filename: str, client_name: str | None = None) -> ProcessedDocumentResult`
- **File**: [`backend/app/services/document_processing/pan_service.py`](file:///d:/project/backend/app/services/document_processing/pan_service.py#L30)
- **Purpose**: End-to-end processing pipeline for Indian Permanent Account Number (PAN) cards.
- **Crop Geometry**: Fixed ratios `top = 0.77`, `left = 0.11`, `bottom = 0.05`, `right = 0.49`.
- **Output**: Generates high-resolution cropped PDF and preview.
- **Related Tests**: [`backend/tests/test_toolkit_suite.py`](file:///d:/project/backend/tests/test_toolkit_suite.py#L140).

### 3.3 `merge_pdf_documents(file_list: list[tuple[str, bytes]]) -> bytes`
- **File**: [`backend/app/services/document_processing/pdf_export.py`](file:///d:/project/backend/app/services/document_processing/pdf_export.py#L110)
- **Purpose**: Combines arbitrary numbers of uploaded PDF documents into a unified, linearized PDF stream using PyPDF/PyMuPDF.
- **Validation**: Inspects PDF headers (`%PDF-`), validates page trees, strips orphaned annotations, and compresses output streams.

---

## 4. Financial Calculators

### 4.1 `calculate_loan_emi(principal: Decimal, annual_interest_rate: Decimal, tenure_months: int) -> dict`
- **File**: [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py#L85)
- **Formula**:
  $$EMI = \frac{P \times r \times (1 + r)^n}{(1 + r)^n - 1}$$
  where $P$ is principal, $r = \frac{\text{annual\_rate}}{12 \times 100}$, and $n$ is tenure in months.
- **Outputs**: Monthly EMI, total interest payable, total payment, and full month-by-month amortization schedule (principal component, interest component, remaining balance).

### 4.2 `calculate_sip_returns(monthly_investment: Decimal, annual_return_rate: Decimal, tenure_years: int) -> dict`
- **File**: [`backend/app/api/toolkit.py`](file:///d:/project/backend/app/api/toolkit.py#L150)
- **Formula**: Standard compound future value formula for annuity due:
  $$FV = P \times \frac{(1 + i)^n - 1}{i} \times (1 + i)$$
  where $i = \frac{\text{annual\_rate}}{12 \times 100}$ and $n = \text{years} \times 12$.
- **Outputs**: Total invested amount, estimated future returns, and final maturity wealth corpus.

---

## 5. Frontend Sortable Checklist Component

### 5.1 `SortableChecklistStep({ step, index, onRemove })`
- **File**: [`crm/src/pages/CategoriesPage.jsx`](file:///d:/project/crm/src/pages/CategoriesPage.jsx#L42)
- **Purpose**: Reusable drag-and-drop sortable row component wrapped with `@dnd-kit/sortable`.
- **Props**:
  - `step`: Object containing `{ id: string, title: string, position: number }`.
  - `index`: 0-based numeric index for the step number badge.
  - `onRemove`: Callback function `(stepId: string) => void`.
- **Interaction Rules**:
  - Drag listeners (`{...attributes}`, `{...listeners}`) bound exclusively to the `GripVertical` handle button.
  - Title text retains native text selection (`select-text`).
  - Delete button executes without drag interference.
  - Active dragging applies `opacity-30 bg-teal-50 border-dashed border-teal-400`.

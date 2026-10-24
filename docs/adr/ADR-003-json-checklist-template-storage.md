# ADR-003: JSON Column Storage with Sequential Position Normalization for Work Category Templates

## Status
`ACCEPTED` (Implemented & Verified)

## Context
In CRM, Work Categories serve as templates containing predefined checklist milestones (e.g. "Do Physical KYC Client", "Payeezz Physical / Online", "Bank Addition"). When a work order is created under a category, it clones these checklist steps into concrete work order items.

Administrators need to reorder, add, or delete checklist milestones dynamically via drag-and-drop. Creating a normalized relational table for template items would require multi-table joins and migrations on every schema tweak, whereas an unstructured JSON array might suffer from index drift or unsorted responses.

## Decision
1. Store checklist templates as a native `JSON` column on `work_categories.checklist_template`.
2. Each item is stored as an object: `{"id": "...", "title": "...", "position": 0, "description": "..."}`.
3. Enforce position normalization in the backend (`_normalize_checklist_template` in `backend/app/api/crm.py`) during `POST /categories` and `PUT /categories/{id}`, guaranteeing 0-based sequential integers matching the submitted array sequence.
4. Enforce Pydantic validation on output (`sort_checklist_template` in `WorkCategorySchema`) so API responses are always sorted by `position`.
5. Frontend uses `@dnd-kit/sortable` with persistent UUID/timestamp IDs (not array indexes) to enable smooth drag-and-drop reordering.

## Consequences
### Positive
- Zero database migrations required when template step formats change.
- JSON structure natively preserves array ordering and arbitrary metadata.
- Work order creation simply iterates over the category's `checklist_template` in order to instantiate `WorkOrderChecklistItem` records.
- Backward compatible with existing seed data and categories created without explicit positions.

### Negative
- Relational integrity (e.g. foreign keys on individual template items) cannot be enforced by the database engine; normalization relies on the application tier.

## Evidence
- [`backend/app/db/models/crm.py`](../../backend/app/db/models/crm.py): `WorkCategory.checklist_template: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)`.
- [`backend/app/api/crm.py`](../../backend/app/api/crm.py): `_normalize_checklist_template` helper in `create_work_category` and `update_work_category`.
- [`backend/app/schemas/crm.py`](../../backend/app/schemas/crm.py): `WorkCategorySchema.sort_checklist_template` validator.
- [`crm/src/pages/CategoriesPage.jsx`](../../crm/src/pages/CategoriesPage.jsx): `@dnd-kit` sortable list with drag handles and persistent step IDs.
- [`backend/tests/test_category_checklist_reordering.py`](../../backend/tests/test_category_checklist_reordering.py): 10 verification scenarios.

# FinNexus Architecture & Workflow Diagrams

This directory contains standalone, editable Mermaid diagram definitions representing the verified implementation of the FinNexus platform.

## Diagram Catalog

| Diagram File | Category | Description | Corresponding Documentation |
|---|---|---|---|
| [`01-system-context-architecture.mmd`](./01-system-context-architecture.mmd) | System Architecture | Monorepo topology, 4 frontend apps, shared FastAPI backend, PostgreSQL, and Redis | [`docs/02-architecture.md`](../02-architecture.md) |
| [`02-authentication-sso-flow.mmd`](./02-authentication-sso-flow.mmd) | Security & Access | Dual-token authentication, token refresh rotation, and Redis JTI revocation | [`docs/08-auth-rbac-security.md`](../08-auth-rbac-security.md) |
| [`03-work-order-lifecycle.mmd`](./03-work-order-lifecycle.mmd) | Business Process | Work Order state machine, checklist progression, supervisor overrides, and audit trails | [`docs/05-feature-flows.md`](../05-feature-flows.md) |
| [`04-database-entity-relationship.mmd`](./04-database-entity-relationship.mmd) | Data Architecture | Complete Entity-Relationship Diagram (ERD) covering all 16 database tables | [`docs/06-database-schema.md`](../06-database-schema.md) |
| [`05-document-processing-pipeline.mmd`](./05-document-processing-pipeline.mmd) | Toolkit Processing | Aadhaar and PAN auto-crop, password decryption, and PDF generation pipeline | [`docs/05-feature-flows.md`](../05-feature-flows.md) |

## How to View and Edit

These diagrams use standard [Mermaid](https://mermaid.js.org/) syntax and can be rendered:
- Directly within GitHub markdown preview.
- In VS Code / IDE with the "Markdown Preview Mermaid Support" extension.
- Online using the [Mermaid Live Editor](https://mermaid.live).
- Embedded within documentation markdown files using ````mermaid ... ```` blocks.

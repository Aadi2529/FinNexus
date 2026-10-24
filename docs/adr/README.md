# Architecture Decision Records (ADR)

This directory documents the architecturally significant decisions made during the evolution of the FinNexus platform. Each record follows the Michael Nygard template format.

## ADR Format

Each ADR contains:
- **Title**: Numbered identifier and decision summary.
- **Status**: `PROPOSED`, `ACCEPTED`, `SUPERSEDED`, or `DEPRECATED`.
- **Context**: The forces, requirements, and constraints that motivated the decision.
- **Decision**: The architectural choice that was made.
- **Rationale**: Why this option was chosen over alternatives.
- **Consequences**: Positive and negative outcomes or trade-offs.
- **Evidence**: Source code files, migrations, and tests verifying this decision.

## Discovered Architecture Decision Records

| ADR ID | Title | Status | Date Verified |
|---|---|---|---|
| [`ADR-001`](./ADR-001-monorepo-multi-spa-architecture.md) | Monorepo Structure with 4 Independent SPAs and Shared Backend | `ACCEPTED` | October 2026 |
| [`ADR-002`](./ADR-002-dual-token-auth-redis-blacklist.md) | Dual-Token Authentication with SHA-256 Hashed Refresh Tokens & Redis JTI Blacklist | `ACCEPTED` | October 2026 |
| [`ADR-003`](./ADR-003-json-checklist-template-storage.md) | JSON Column Storage with Sequential Position Normalization for Work Category Templates | `ACCEPTED` | October 2026 |
| [`ADR-004`](./ADR-004-fixed-ratio-card-cropping.md) | Fixed Geometric Aspect-Ratio Cropping for Identity Cards (Aadhaar & PAN) | `ACCEPTED` | October 2026 |
| [`ADR-005`](./ADR-005-sqlalchemy-async-unified-backend.md) | Single Unified FastAPI Async Backend with AsyncPG and Psycopg Fallbacks | `ACCEPTED` | October 2026 |

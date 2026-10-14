# FinanceFlow — Finance Operations Platform

[![CI Pipeline](https://github.com/organization/financeflow/actions/workflows/ci.yml/badge.svg)](https://github.com/organization/financeflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Node: 20+](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-teal.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)

FinanceFlow is an industry-inspired, placement-oriented financial operations (FinOps) platform developed as a fourth-year college capstone field project. It unifies customer relationship management (CRM), financial calculation engines (reducing-balance EMI and SIP compound projections), compliant KYC document vaults, and role-based audit logging into a cohesive, production-grade modular monolith.

---

## 1. Project Navigation & Documentation

All technical specifications, architectural decisions, and operational guides are organized under the [`docs/`](docs/) directory:

| Document | Purpose & Description |
| :--- | :--- |
| **[`PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md)** | Mission, business problem, user personas, and executive scope. |
| **[`REQUIREMENTS.md`](docs/REQUIREMENTS.md)** | Functional (FR) and non-functional (NFR) specifications. |
| **[`ARCHITECTURE.md`](docs/ARCHITECTURE.md)** | Modular monolith design, tier boundaries, and system diagrams. |
| **[`IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)** | 2-week MVP roadmap, phase gates, and critical path. |
| **[`DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md)** | PostgreSQL schema, ER diagrams, indexes, and Alembic migration rules. |
| **[`API_DESIGN.md`](docs/API_DESIGN.md)** | RESTful contract, OpenAPI spec, error envelopes, and endpoint signatures. |
| **[`SECURITY_STANDARDS.md`](docs/SECURITY_STANDARDS.md)** | AuthN/AuthZ, JWT revocation, password hashing, and OWASP defenses. |
| **[`TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md)** | Pytest, React Testing Library, and Playwright E2E test suites. |
| **[`CHANGELOG.md`](docs/CHANGELOG.md)** | Chronological log of releases and changes following Keep a Changelog. |
| **[`DECISIONS.md`](docs/DECISIONS.md)** | Architecture Decision Records (ADRs) tracking key architectural choices. |
| **[`DEVELOPMENT_STATUS.md`](docs/DEVELOPMENT_STATUS.md)** | Real-time status matrix, risk register, and phase checklists. |
| **[`docs/implementation/`](docs/implementation/)** | Detailed phase-by-phase execution and verification records. |

---

## 2. Technology Stack

### Frontend
- **Framework:** React.js (v18+)
- **Language:** JavaScript (Strict ES Modules, standard syntax)
- **Build Tool:** Vite
- **Routing:** React Router DOM (v6+)
- **Styling:** Tailwind CSS (Curated slate & financial emerald palette)
- **Testing:** Vitest / React Testing Library, Playwright E2E

### Backend
- **Framework:** FastAPI (ASGI asynchronous Python framework)
- **Language:** Python (3.11+ / 3.14 compatible)
- **Validation:** Pydantic v2
- **ORM / Persistence:** SQLAlchemy 2.x (Modern declarative 2.0 style)
- **Database Migrations:** Alembic
- **Testing:** Pytest, pytest-asyncio, httpx

### Database & Infrastructure
- **Primary Database:** PostgreSQL 16+
- **Cache & Token Store:** Redis 7+
- **Containerization:** Docker & Docker Compose
- **Continuous Integration:** GitHub Actions

---

## 3. High-Level Modular Architecture

```
financeflow/
├── backend/                   # FastAPI Modular Monolith Application
│   ├── app/
│   │   ├── core/              # Config, Security, Database session, Logging
│   │   ├── modules/
│   │   │   ├── identity/      # Authentication, JWT, Tokens, Passwords
│   │   │   ├── users/         # User accounts, Roles, RBAC permissions
│   │   │   ├── crm/           # Customers, Financial Profiles, Notes, Tasks
│   │   │   ├── documents/     # Secure file storage, Metadata, Validation
│   │   │   ├── finance/       # EMI, Amortization, and SIP calculation engines
│   │   │   ├── analytics/     # Aggregations, Pipeline metrics, Dashboards
│   │   │   └── audit/         # Immutable audit logging engine
│   │   ├── main.py            # ASGI application entrypoint
│   │   └── tests/             # Unit and integration test suites
│   ├── alembic/               # Database migration scripts
│   ├── requirements.txt       # Production & development dependencies
│   └── Dockerfile.backend
├── frontend/                  # React + Vite Single Page Application
│   ├── src/
│   │   ├── components/        # Reusable UI component library
│   │   ├── pages/             # Feature views and layout routes
│   │   ├── context/           # Auth and App state contexts
│   │   ├── services/          # API client services
│   │   └── utils/             # Calculation helpers and formatters
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile.frontend
├── docker-compose.yml         # Local container orchestration
└── docs/                      # Architectural and engineering documentation
```

---

## 4. Current Status

The project is currently at **Phase 0: Project Initialization Completed**. See [`docs/DEVELOPMENT_STATUS.md`](docs/DEVELOPMENT_STATUS.md) for full phase-by-phase details and the verified environment findings.

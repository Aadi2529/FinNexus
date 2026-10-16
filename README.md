# FinNexus — Enterprise Financial Operations Platform

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.14-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Architecture](https://img.shields.io/badge/Architecture-Modular_Monorepo-indigo)](#5-architecture-overview)

FinNexus is a modular, production-grade financial operations (FinOps) platform. It unifies client relationship management (Borrower 360 CRM & Work Orders), financial calculation engines (reducing-balance EMI amortization and SIP compound wealth projections), a compliant document-processing suite (Aadhaar/PAN card maskers, image-to-PDF compilers, and PDF mergers), and actuarial insurance underwriting into a cohesive multi-application monorepo.

The platform is designed around four decoupled React single-page applications (SPAs) coordinated through a shared authentication and session model, powered by an asynchronous Python FastAPI backend with PostgreSQL persistence and Redis caching.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Key Modules](#2-key-modules)
- [3. Verified Features](#3-verified-features)
- [4. Technology Stack](#4-technology-stack)
- [5. Architecture Overview](#5-architecture-overview)
- [6. Project Structure](#6-project-structure)
- [7. Prerequisites](#7-prerequisites)
- [8. Installation and Setup](#8-installation-and-setup)
- [9. Environment Variables](#9-environment-variables)
- [10. Running the Project](#10-running-the-project)
- [11. Testing](#11-testing)
- [12. API Documentation](#12-api-documentation)
- [13. Security and Privacy](#13-security-and-privacy)
- [14. Current Development Status](#14-current-development-status)
- [15. Roadmap](#15-roadmap)
- [16. Screenshots](#16-screenshots)
- [17. Known Limitations](#17-known-limitations)
- [18. Contributing](#18-contributing)
- [19. License](#19-license)

---

## 1. Project Overview

FinNexus streamlines operations across commercial lending, financial advisory, and risk underwriting teams by eliminating fragmented spreadsheets and disjointed third-party utilities. 

### Core Purpose & Scope
- **Unified Borrower 360:** Consolidates borrower demographic profiles, KYC identity references, financial indicators, and work order audit histories into a single view.
- **Auditable Work Order Lifecycle:** Manages operations through a 5-stage workflow (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `ON_HOLD`) with sequential numbering, checklist validation, and supervisor override tracking.
- **Secure Document Processing:** Features on-premise, privacy-focused document utilities that redact sensitive identifiers (e.g., masking the first 8 digits of Aadhaar numbers and redacting PAN cards) without leaking raw files to unverified external cloud services.
- **Actuarial & Wealth Engines:** Delivers mathematical precision for loan amortization schedules (reducing-balance EMI) and compound investment wealth modeling (SIP accumulation).
- **Subdomain-Aware Architecture:** Operates as a set of focused single-page applications connected to a single high-performance API backend.

---

## 2. Key Modules

The project consists of four independent frontend applications and a shared backend:

| Module | Location & Port | Status | Verified Functionality |
| :--- | :--- | :--- | :--- |
| **FinNexus Dashboard** | `dashboard/`<br>`http://localhost:5173` | **Implemented** | Central Single Sign-On (SSO) landing portal, application switcher launcher, and Super Admin user management modal (create, view, and assign roles to staff). |
| **FinNexus CRM** | `crm/`<br>`http://localhost:5174` | **Implemented** | Complete Borrower 360 customer management, active/archived client toggles, Work Order lifecycle tracking with custom categories, stage overrides, notes timeline, and Kanban task scheduling. |
| **FinNexus Toolkit** | `toolkit/`<br>`http://localhost:5175` | **Implemented** | High-precision document-processing suite: Aadhaar masking/redaction with front/back cropping, PAN card masking & verification, multi-image to PDF converter, multi-PDF merger, reducing-balance EMI calculator, and SIP compounding engine. Supports drag-and-drop file uploads with magic-byte validation and automated ephemeral cleanup. |
| **FinNexus Insurance Engine** | `insurance-engine/`<br>`http://localhost:5176` | **Implemented** | Actuarial policy tariff catalog, risk quotient calculations, 18% statutory GST computations, and premium quotation breakdowns. |
| **FastAPI Backend** | `backend/`<br>`http://localhost:8000` | **Implemented** | Asynchronous modular monolith exposing RESTful API endpoints for health probes, authentication, CRM operations, document transformations, and insurance calculations. |

> **Note on Module Implementation:**
> All four frontend applications and the backend API are fully functional and verified in the codebase. Direct external bureau API integrations (e.g., live Experian/CIBIL credit bureau webhooks) and payment gateway checkouts (e.g., Razorpay/Stripe) are currently architected with mock/internal handlers, with live carrier connections planned for future phases.

---

## 3. Verified Features

Every capability listed below is backed by operational application code and automated tests in the repository:

### Work Order & Pipeline Management
- **Sequential Identification:** Automatically assigns human-readable numbers in `WO-YYYYMMDD-XXXX` format.
- **5-Stage State Machine:** Enforces transitions across `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, and `ON_HOLD`.
- **Priority Governance:** Four operational priority tiers (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) with visual badging.
- **Explicit Scheduling & Reminders:** Configurable target completion dates, scheduled start dates, estimated hours, and automated reminder date notifications.
- **Stage Override Governance:** Enforces supervisor override notes and records timestamps in an immutable stage history audit trail.
- **Checklist Validation:** Category-specific requirement checklists (e.g., MFU, Insurance, Accounting, Office Work) validated before completion.

### Task Pipeline
- **Kanban-Style Workflow:** Visual columns tracking task lifecycle status.
- **Category Classification:** Categorization by work stream with priority filtering.
- **Work Order Linkage:** Bidirectional association linking tasks directly to parent work orders and client profiles.

### Client Management (Borrower 360)
- **KYC Profiling:** Records contact information, date of birth, PAN number, and SHA-256 hashed Aadhaar references.
- **Financial Profiling:** Tracks employment type, monthly income, recorded CIBIL credit score, and system risk ratings.
- **Non-Destructive Archiving:** Safe active/archived state toggles that prevent data loss and preserve historical work orders.
- **Work Order History:** Reverse-lookup displaying all active, completed, and historic work orders for each borrower.

### Role-Based Access Control (RBAC) & Governance
- **Granular Roles:** Enforces access across `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE` / `LOAN_OFFICER`, `UNDERWRITER`, and `VIEWER`.
- **Cryptographic Security:** Passwords hashed with Argon2id; authentication handled via JWT access (15-minute expiry) and refresh (7-day expiry) tokens.
- **Token Blacklisting:** Revocation store backed by Redis with automatic fallback to a thread-safe in-memory cache.
- **FastAPI Dependency Guards:** Endpoint-level permission verification (`get_current_active_user`, role verification dependencies).

### Document Processing Suite (Toolkit)
- **Aadhaar Card Masker & Redactor:** Extracts and crops front and back sections, merges them into a clean printable page, and applies solid black-box redaction over the first 8 digits. Supports password derivation for protected e-Aadhaar PDFs.
- **PAN Card Masker & Validator:** Automatically detects card bounding boxes, validates PAN formatting against official regex syntax (`[A-Z]{5}[0-9]{4}[A-Z]{1}`), crops the card, and masks sensitive identifiers.
- **Images-to-PDF Converter:** Compiles multiple image files (PNG, JPEG) into a single optimized PDF document with client-side drag-and-drop reordering.
- **PDF Merger:** Merges multiple PDF files into a single consolidated document.
- **Security & Ephemeral Cleanup:** Validates file magic bytes (`%PDF`, `\x89PNG`, `\xff\xd8\xff`) to block malicious payloads; processes all files in isolated UUID directories with automated background cleanup.

### Financial Calculators
- **Reducing-Balance EMI Engine:** Computes monthly installments, total interest, and total payable amounts with complete month-by-month amortization schedules using high-precision decimal arithmetic.
- **SIP Compounding Engine:** Models future wealth accumulation based on monthly investment amounts, investment horizons, and expected return rates, producing year-by-year principal vs. interest breakdown tables.

---

## 4. Technology Stack

### Frontend Architecture
- **Framework:** React 18.2+ (ES Modules)
- **Build Tool:** Vite 5.x
- **Routing:** React Router DOM v6
- **Styling:** Tailwind CSS 3.4+ with custom color palettes
- **Icons:** Lucide React
- **File Upload:** Native HTML5 Drag-and-Drop and File API

### Backend Architecture
- **Framework:** FastAPI 0.115+ (ASGI async architecture)
- **Language:** Python 3.11+ (Python 3.12 and 3.14 verified)
- **Data Validation:** Pydantic v2
- **ORM / Persistence:** SQLAlchemy 2.0 (Modern async declarative)
- **Database Migrations:** Alembic 1.13+
- **ASGI Server:** Uvicorn 0.30+

### Cryptography & Document Processing
- **Password Hashing:** Argon2id (`argon2-cffi` 23.x), Bcrypt
- **Token Generation:** PyJWT 2.8+
- **PDF & Image Processing:** PyMuPDF (`fitz` 1.25+), PyPDF 6.0+, Pillow (`PIL` 11.0+)

### Database & Infrastructure
- **Primary Database:** PostgreSQL 16+ (`asyncpg` 0.29+ async driver, `psycopg` 3.2+ sync migration driver)
- **Cache & Token Store:** Redis 7+ (with automatic fallback to thread-safe in-memory cache)
- **Containerization:** Docker & Docker Compose
- **Orchestration:** Monorepo root workspace (`npm` workspaces + `concurrently` 8.2+)
- **Testing:** Pytest 8.2+, `pytest-asyncio`, `httpx`

---

## 5. Architecture Overview

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Client Layer (Browser)"]
        UI_Dash["Dashboard SPA\n(:5173 / dashboard.finnexus.com)"]
        UI_CRM["CRM SPA\n(:5174 / crm.finnexus.com)"]
        UI_Tool["Toolkit SPA\n(:5175 / toolkit.finnexus.com)"]
        UI_Ins["Insurance SPA\n(:5176 / insurance.finnexus.com)"]
    end

    subgraph Gateway["FastAPI Modular Monolith (:8000 / api.finnexus.com)"]
        CORS["CORS & Origin Firewall"]
        AuthM["Auth & Security Middleware\n(Argon2id + JWT)"]
        
        subgraph APIRouters["API Routers (/api/v1)"]
            R_Health["/health\n(Liveness & Readiness)"]
            R_Auth["/auth\n(Login, Refresh, Users)"]
            R_CRM["/crm & /work-orders\n(Clients, WOs, Tasks)"]
            R_Tool["/toolkit\n(Docs, EMI, SIP)"]
            R_Ins["/insurance\n(Quotes, Tariffs)"]
        end

        subgraph ServiceLayer["Service Engines"]
            DocProc["Document Processor\n(PyMuPDF / Pillow)"]
            Cleanup["Ephemeral File Cleanup\n(UUID Directories)"]
            CalcEng["Financial Math Engines\n(Decimal EMI & SIP)"]
        end

        SQLA["SQLAlchemy 2.0 Async Session Pool"]
    end

    subgraph StorageLayer["Persistence & Infrastructure"]
        Postgres[(PostgreSQL 16+\nUsers, Clients, Work Orders,\nTasks, History, Audit Logs)]
        RedisCache[(Redis 7+\nToken Blacklist & Cache\nFallback: Thread-safe Memory)]
        TempDisk[("Ephemeral Storage\nstorage/documents/\n(Auto-Purged)")]
    end

    UI_Dash -->|REST / JSON| CORS
    UI_CRM -->|REST / JSON| CORS
    UI_Tool -->|Multipart / Form-Data| CORS
    UI_Ins -->|REST / JSON| CORS

    CORS --> AuthM
    AuthM --> R_Health
    AuthM --> R_Auth
    AuthM --> R_CRM
    AuthM --> R_Tool
    AuthM --> R_Ins

    R_Auth --> SQLA
    R_Auth -.->|Token Revocation| RedisCache
    R_CRM --> SQLA
    R_Ins --> SQLA

    R_Tool --> DocProc
    R_Tool --> CalcEng
    DocProc <--> TempDisk
    Cleanup -.->|Periodic Purge| TempDisk

    SQLA <--> Postgres
```

---

## 6. Project Structure

```
FinNexus/
├── backend/                             # FastAPI Backend Service
│   ├── alembic/                         # Database migration scripts
│   │   ├── versions/                    # Schema revision scripts
│   │   └── env.py                       # Migration execution harness
│   ├── app/
│   │   ├── api/                         # REST route definitions
│   │   │   ├── auth.py                  # Login, refresh, staff user management
│   │   │   ├── crm.py                   # Customers, Work Orders, Tasks, Categories
│   │   │   ├── health.py                # Liveness & readiness probes
│   │   │   ├── insurance.py             # Policies, tariffs, premium quotes
│   │   │   ├── router.py                # Central API router mounting /api/v1
│   │   │   └── toolkit.py               # Document processing & financial tools
│   │   ├── core/                        # Configuration & security utilities
│   │   │   ├── config.py                # Pydantic Settings & environment parsing
│   │   │   ├── dependencies.py          # FastAPI dependencies & RBAC guards
│   │   │   ├── redis.py                 # Redis client & memory fallback
│   │   │   └── security.py              # Argon2id hashing & JWT handling
│   │   ├── db/                          # Database connection & models
│   │   │   ├── models/                  # SQLAlchemy declarative models
│   │   │   │   ├── audit.py             # Audit logging model
│   │   │   │   ├── auth.py              # User, Role, UserRole models
│   │   │   │   ├── crm.py               # Customer, WorkOrder, Task models
│   │   │   │   └── documents.py         # Document registry model
│   │   │   ├── cleanup.py               # Ephemeral storage cleaner
│   │   │   ├── seed.py                  # Idempotent database seeder
│   │   │   └── session.py               # Async SQLAlchemy engine & session factory
│   │   ├── schemas/                     # Pydantic request/response schemas
│   │   ├── services/                    # Business logic
│   │   │   └── document_processor.py    # PyMuPDF/Pillow document masking engine
│   │   └── main.py                      # ASGI application entrypoint
│   ├── tests/                           # Pytest automated test suite (116 tests)
│   ├── Dockerfile.backend               # Backend container recipe
│   ├── pyproject.toml                   # Python project metadata
│   ├── pytest.ini                       # Pytest test discovery configuration
│   └── requirements.txt                 # Pinned Python package dependencies
├── dashboard/                           # FinNexus Dashboard SPA (Port 5173)
│   ├── src/                             # React application source
│   ├── package.json                     # Dashboard frontend dependencies
│   └── vite.config.js                   # Vite dev server configuration
├── crm/                                 # FinNexus CRM SPA (Port 5174)
│   ├── src/                             # Borrower 360, Work Orders, Tasks
│   ├── package.json                     # CRM frontend dependencies
│   └── vite.config.js                   # Vite dev server configuration
├── toolkit/                             # FinNexus Toolkit SPA (Port 5175)
│   ├── src/                             # Aadhaar/PAN tools, PDF tools, Calculators
│   ├── package.json                     # Toolkit frontend dependencies
│   └── vite.config.js                   # Vite dev server configuration
├── insurance-engine/                    # FinNexus Insurance SPA (Port 5176)
│   ├── src/                             # Risk quoting & policy tariffs
│   ├── package.json                     # Insurance frontend dependencies
│   └── vite.config.js                   # Vite dev server configuration
├── docs/                                # Technical specifications & architecture
│   ├── API_DESIGN.md                    # REST contracts & OpenAPI schema
│   ├── ARCHITECTURE.md                  # Monorepo architecture & data flow
│   ├── DATABASE_DESIGN.md               # PostgreSQL schema & relationships
│   ├── SECURITY_STANDARDS.md            # OWASP guidelines, RBAC & crypto rules
│   └── TESTING_STRATEGY.md              # Automated test guidelines
├── docker-compose.yml                   # Container orchestration (5 services)
└── package.json                         # Root monorepo workspace orchestration
```

---

## 7. Prerequisites

Before setting up FinNexus, verify that the following software is installed on your workstation:

| Prerequisite | Minimum Version | Verified Version | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18.0.0+` | `v24.21.0` | Node.js v20+ LTS recommended. |
| **npm** | `v9.0.0+` | `v11.19.0` | Bundled with Node.js. |
| **Python** | `3.11.0+` | `3.14.8` | Python 3.11, 3.12, or 3.14 (64-bit). |
| **PostgreSQL** | `16.0+` | `18.0` | Local service or Docker container. |
| **Redis** | `7.0+` | `7.2` | Optional for local dev (in-memory fallback active). |
| **Git** | `2.30.0+` | `2.43.0` | Version control. |

---

## 8. Installation and Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/organization/finnexus.git
cd finnexus
```

### Step 2: Install Frontend Dependencies
From the monorepo root, install all node modules across all four applications:
```bash
npm install
```

### Step 3: Set Up Python Backend Virtual Environment

#### On Windows (PowerShell):
```powershell
# Navigate to the backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install pinned dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

#### On Linux / macOS (Bash):
```bash
# Navigate to the backend directory
cd backend

# Create virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Upgrade pip and install pinned dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment Files
Copy the example environment templates to `.env` in both the backend and frontend directories:

```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configurations
cp dashboard/.env.example dashboard/.env
cp crm/.env.example crm/.env
cp toolkit/.env.example toolkit/.env
cp insurance-engine/.env.example insurance-engine/.env
```
*(On Windows PowerShell, use `Copy-Item backend\.env.example backend\.env`)*

### Step 5: Run Database Migrations
With your PostgreSQL server running and the target database created, apply Alembic migrations:
```bash
# Run from within the backend directory with virtualenv active
alembic upgrade head
```

### Step 6: Seed Initial System Data
Initialize system roles, canon work categories, and the initial Super Admin account:
```bash
# Run from within the backend directory with virtualenv active
python -m app.db.seed
```

---

## 9. Environment Variables

All sensitive values must be provided through environment variables. **Never commit actual passwords, private keys, or credentials.**

### Backend Configuration (`backend/.env`)

| Variable Name | Description | Example / Placeholder Value |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Runtime mode (`development`, `production`, `test`) | `development` |
| `PORT` | ASGI listening port | `8000` |
| `DEBUG` | Enable debug logs and detailed error envelopes | `true` |
| `PROJECT_NAME` | Platform branding identifier | `FinNexus` |
| `API_V1_PREFIX` | Versioned route mounting prefix | `/api/v1` |
| `DB_HOST` | PostgreSQL hostname or IP | `127.0.0.1` |
| `DB_PORT` | PostgreSQL listening port | `5432` |
| `DB_NAME` | Database name | `finnexus_dev` |
| `DB_USER` | Database user account | `postgres` |
| `DB_PASSWORD` | Database user password | `<your_secure_db_password>` |
| `DB_SCHEMA` | Active PostgreSQL schema | `public` |
| `DATABASE_URL` | Optional async database URL (overrides DB_* if set) | `postgresql+asyncpg://user:pass@host:5432/db` |
| `SYNC_DATABASE_URL` | Sync database URL used by Alembic migrations | `postgresql+psycopg://user:pass@host:5432/db` |
| `REDIS_HOST` | Redis cache hostname | `127.0.0.1` |
| `REDIS_PORT` | Redis cache port | `6379` |
| `REDIS_PASSWORD` | Optional Redis authentication password | `""` |
| `JWT_ACCESS_SECRET` | Secret key for signing 15-min JWT access tokens | `<generate_min_32_character_secret>` |
| `JWT_ACCESS_EXPIRES_IN`| Lifespan of JWT access tokens | `15m` |
| `JWT_REFRESH_SECRET` | Secret key for signing 7-day JWT refresh tokens | `<generate_min_32_character_secret>` |
| `JWT_REFRESH_EXPIRES_IN`| Lifespan of JWT refresh tokens | `7d` |
| `CORS_ORIGINS` | JSON list of allowed frontend origin URLs | `["http://localhost:5173","http://localhost:5174","http://localhost:5175","http://localhost:5176"]` |
| `SUPER_ADMIN_EMAIL` | Email for initial system bootstrap account | `admin@finnexus.com` |
| `SUPER_ADMIN_PASSWORD` | Initial password for bootstrap account | `<choose_strong_admin_password>` |

### Frontend Configuration (`.env` per application)

| Variable Name | Description | Default Local Port |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Root URL to backend API | `http://localhost:8000/api/v1` |
| `VITE_DASHBOARD_URL` | URL to FinNexus Dashboard SPA | `http://localhost:5173` |
| `VITE_CRM_URL` | URL to FinNexus CRM SPA | `http://localhost:5174` |
| `VITE_TOOLKIT_URL` | URL to FinNexus Toolkit SPA | `http://localhost:5175` |
| `VITE_INSURANCE_URL` | URL to FinNexus Insurance Engine SPA | `http://localhost:5176` |

---

## 10. Running the Project

### Running in Development Mode

#### Terminal 1 — Backend Server
Activate your virtual environment and launch the FastAPI development server:
```powershell
# Windows PowerShell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
```bash
# Linux / macOS
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Terminal 2 — All Frontend Applications (Concurrent)
From the repository root, start all four SPAs simultaneously:
```bash
npm run dev
```

This concurrently starts:
- **Dashboard:** `http://localhost:5173`
- **CRM:** `http://localhost:5174`
- **Toolkit:** `http://localhost:5175`
- **Insurance Engine:** `http://localhost:5176`

#### Running Frontends Individually
You can also run any specific frontend independently:
```bash
npm run dev:dashboard   # Launches only Dashboard (port 5173)
npm run dev:crm         # Launches only CRM (port 5174)
npm run dev:toolkit     # Launches only Toolkit (port 5175)
npm run dev:insurance   # Launches only Insurance Engine (port 5176)
```

### Running with Docker Compose
If you prefer running the full platform via Docker:
```bash
# Build and launch all 5 containers (PostgreSQL, Redis, Backend, and Frontends)
docker-compose up -d

# View container logs
docker-compose logs -f backend

# Stop all containers
docker-compose down
```

---

## 11. Testing

The repository contains an automated test suite with 116 tests covering API endpoints, role-based authorization, database models, document processing, and health probes.

### Running Backend Tests
Activate the virtual environment in the `backend/` directory, then run:

```bash
# Run the entire test suite
pytest tests -v

# Run tests with short progress summary
pytest tests -q

# Run specific functional suites
pytest tests/test_health.py                         # Health & readiness probes
pytest tests/test_crm_rbac.py                       # Role-based access control
pytest tests/test_crm_clients.py                    # Customer 360 & KYC tests
pytest tests/test_crm_scheduling_and_pipeline.py    # Work order scheduling & reminders
pytest tests/test_toolkit_suite.py                  # Document masking & PDF engines
pytest tests/test_user_management_and_cleanup.py    # User admin & storage cleanup
```

### Verifying Frontend Production Builds
To confirm that all frontend bundles build without syntax or bundling errors:
```bash
# From repository root:
npm run build
```

Or build individual applications:
```bash
npm run build:dashboard
npm run build:crm
npm run build:toolkit
npm run build:insurance
```

---

## 12. API Documentation

When the backend is running, FastAPI automatically serves interactive OpenAPI documentation:

| Interface | URL | Description |
| :--- | :--- | :--- |
| **Swagger UI** | `http://localhost:8000/docs` | Interactive API explorer allowing live request testing with JWT authentication. |
| **ReDoc** | `http://localhost:8000/redoc` | Clean, responsive technical reference documentation. |
| **OpenAPI JSON** | `http://localhost:8000/api/v1/openapi.json` | Raw OpenAPI 3.1 specification for code generation and schema validation. |

### Core API Route Prefixes

```
/api/v1
├── /health           # Health inspection probes (/live, /ready, /health)
├── /auth             # Authentication, token refresh, staff user management
├── /crm              # Borrower 360, financial metrics, and customer notes
├── /clients          # Direct client CRUD, archival, and KYC lookups
├── /work-orders      # Work order lifecycle, stage overrides, notes, scheduling
├── /tasks            # Kanban task pipeline, stage transitions, categories
├── /toolkit          # Document maskers, PDF mergers, EMI & SIP calculators
└── /insurance        # Insurance products, risk quotations, statutory GST
```

---

## 13. Security and Privacy

FinNexus is designed around strict privacy and defensive engineering standards:

### 1. Authentication & Session Governance
- **Argon2id Password Hashing:** User passwords are never stored in plaintext and are hashed using Argon2id with high salt entropy.
- **Dual-Token Architecture:** Issues short-lived access tokens (15-minute validity) paired with long-lived refresh tokens (7-day validity).
- **Token Invalidation:** Supports explicit token revocation upon logout via a token blacklist store.

### 2. Role-Based Access Control (RBAC)
- All privileged routes enforce role validation at the dependency level.
- Staff members cannot access operations outside their assigned permissions (e.g., standard employees cannot trigger stage overrides or create administrative users).

### 3. Document Privacy & PII Protection
- **Ephemeral Storage:** Uploaded files for Aadhaar and PAN processing are saved to temporary, UUID-isolated workspace directories and deleted immediately after processing.
- **Automated Retention Cleanup:** An automated background cleanup worker (`app/db/cleanup.py`) detects and purges abandoned jobs older than the retention threshold.
- **Identity Masking:** Aadhaar numbers are redacted by black-box masking the first 8 digits; only the last 4 digits remain visible for audit reference. Aadhaar numbers are stored as SHA-256 hashes in the database.
- **Magic-Byte Upload Inspection:** Uploaded files are validated using binary magic bytes (`%PDF`, `\x89PNG`, `\xff\xd8\xff`) rather than trusting user-supplied file extensions or MIME types.

### 4. Network & Input Sanitization
- **Strict CORS Controls:** Frontend origins must match explicit configuration entries. Wildcard origins (`*`) with credential support are blocked.
- **Pydantic Validation:** All request payloads are strictly validated against Pydantic v2 schemas to prevent injection attacks and malformed input.

---

## 14. Current Development Status

The current operational state of the FinNexus codebase:

| Subsystem / Capability | Status | Implementation Details |
| :--- | :---: | :--- |
| **Monorepo & Subdomain Structure** | **Completed** | 4 decoupled React SPAs with individual Vite configurations and root orchestration. |
| **Authentication & SSO Launcher** | **Completed** | Central login, JWT session handling, and application switcher navigation. |
| **User Administration** | **Completed** | Super Admin modal for creating, updating, and viewing staff accounts. |
| **Borrower 360 CRM** | **Completed** | Client CRUD, active/archived state toggles, and work order reverse-lookups. |
| **Work Order Scheduling System** | **Completed** | 5-stage state machine, scheduling, reminders, and supervisor overrides. |
| **Kanban Task Pipeline** | **Completed** | Visual task boards, category classification, and stage transitions. |
| **Aadhaar Masking & Redactor** | **Completed** | PDF unlock, auto-crop, front/back merge, and 8-digit black-box redaction. |
| **PAN Card Masking & Validator** | **Completed** | Card auto-crop, regex pattern verification, and identifier masking. |
| **Image-to-PDF & PDF Merger** | **Completed** | Multi-image compilation and multi-file PDF consolidation. |
| **EMI & SIP Calculators** | **Completed** | Decimal-precision amortization schedules and compound growth projections. |
| **Insurance Quotation Engine** | **Completed** | Actuarial risk assessment, statutory 18% GST calculation, and policy catalog. |
| **Automated Test Suite** | **Completed** | 116 automated backend tests passing via Pytest. |
| **External Credit Bureau APIs** | *Planned* | Direct API connectors for live Experian/CIBIL credit report pulls. |
| **Cloud Object Storage (S3/GCS)** | *Planned* | S3/Blob storage provider adapters for permanent document archiving. |
| **External SMS/Email Relays** | *Planned* | Twilio and SendGrid dispatchers for work order reminder notifications. |

---

## 15. Roadmap

Planned enhancements for future versions:

### Phase 1: Storage & Background Processing
- [ ] Implement AWS S3 / Azure Blob Storage adapter with pre-signed upload URLs.
- [ ] Integrate Celery or Temporal for asynchronous distributed background job execution.
- [ ] Add virus scanning integration (e.g., ClamAV) for uploaded documents.

### Phase 2: Integrations & Notifications
- [ ] Connect live CIBIL / Experian bureau APIs for automated credit score retrieval.
- [ ] Integrate Twilio and SendGrid dispatchers for customer SMS and email notifications.
- [ ] Add webhook support for third-party loan origination and core banking systems.

### Phase 3: Analytics & Reporting
- [ ] Implement customizable dashboard widgets with drag-and-drop layouts.
- [ ] Add financial reporting exports in Excel, CSV, and formatted PDF formats.
- [ ] Implement payment gateway integrations (Razorpay / Stripe) for policy premium collections.

---

## 16. Screenshots

> *Replace the image paths below with actual screenshots of your running FinNexus deployment.*

### FinNexus Dashboard & SSO Launcher
```markdown
![FinNexus Dashboard](docs/screenshots/dashboard.png)
```
*Central landing portal featuring the application switcher and staff user management.*

### FinNexus CRM — Borrower 360 & Work Orders
```markdown
![FinNexus CRM](docs/screenshots/crm.png)
```
*Client management profile, active work order tracking, and task pipeline.*

### FinNexus Toolkit — Document Processing Suite
```markdown
![FinNexus Toolkit](docs/screenshots/toolkit.png)
```
*Privacy-focused Aadhaar/PAN masking, PDF merger, and financial calculators.*

### FinNexus Insurance Engine
```markdown
![FinNexus Insurance](docs/screenshots/insurance.png)
```
*Actuarial risk quoting, statutory GST calculations, and policy catalog.*

---

## 17. Known Limitations

The following limitations reflect the current state of the implementation:
1. **Local Ephemeral File Storage:** Uploaded documents processed by the Toolkit are written to a temporary local disk directory (`storage/documents/`) before cleanup. In multi-server or containerized deployments with horizontal scaling, a shared volume or cloud object storage (S3/GCS) is required.
2. **Credit Bureau Scores:** CIBIL credit scores are currently recorded through staff data entry rather than direct bureau API pulls.
3. **Notification Delivery:** Work order reminders and system alerts are written to the database notifications table; external dispatch to SMS or email requires integration with an external relay provider.
4. **Redis Cache:** Redis is optional for single-instance local development (the backend automatically falls back to an internal thread-safe memory cache), but horizontal scaling across multiple ASGI processes requires a shared Redis instance for token blacklisting.

---

## 18. Contributing

Contributions are welcome. Please adhere to the following workflow:

1. **Fork the Repository** and create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Code Standards & Linting:**
   - Format Python code with **Ruff**:
     ```bash
     cd backend && ruff check . && ruff format .
     ```
   - Verify frontend formatting:
     ```bash
     npm run build
     ```
3. **Run Automated Tests:** Ensure all existing and new tests pass:
   ```bash
   pytest backend/tests
   ```
4. **Commit Guidelines:** Use clear, conventional commit messages:
   ```bash
   git commit -m "feat(crm): add work order reminder date validation"
   ```
5. **Submit a Pull Request** describing your changes, testing approach, and related issue numbers.

---

## 19. License

No license has been specified for this project. All rights are reserved by the repository owner.

# 10 — FinNexus Setup, Configuration & Troubleshooting Guide

## 1. System Prerequisites

Before configuring FinNexus, ensure your host environment meets these requirements:

| Tool / Runtime | Minimum Version | Recommended Version | Verification Command |
|---|---|---|---|
| **Python** | 3.12.0 | 3.12.x / 3.13.x | `python --version` |
| **Node.js** | 20.0.0 | 20.18.x LTS / 22.x | `node --version` |
| **npm** | 10.0.0 | 10.8.x | `npm --version` |
| **PostgreSQL** | 15.0 | 16.x Alpine | `psql --version` |
| **Redis** | 6.2 | 7.x Alpine | `redis-cli --version` |
| **Docker & Compose** | 24.0 | 26.x+ with Compose v2 | `docker compose version` |

---

## 2. Environment Configuration Reference

### 2.1 Backend Environment (`backend/.env`)

Create `backend/.env` using the template below (or copy from `backend/.env.example`):

```bash
# --- Core Environment ---
PROJECT_NAME="FinNexus"
VERSION="0.4.0"
ENVIRONMENT=development           # development | staging | production
DEBUG=true

# --- Networking & API ---
API_V1_PREFIX=/api/v1
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=["http://localhost:5173","http://localhost:5174","http://localhost:5175","http://localhost:5176","http://127.0.0.1:5173","http://127.0.0.1:5174","http://127.0.0.1:5175","http://127.0.0.1:5176"]

# --- Database Connections ---
# Primary Async driver (used by FastAPI):
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/financeflow_dev
# Sync driver (used by Alembic migrations):
SYNC_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/financeflow_dev

# --- Redis Caching & Revocation ---
REDIS_URL=redis://localhost:6379/0

# --- Security & JWT Cryptography ---
# CRITICAL: In production, generate with: openssl rand -hex 32
SECRET_KEY=dev-secret-key-change-in-production-must-be-at-least-32-bytes!
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# --- Seed Super Admin Account ---
SUPER_ADMIN_EMAIL=admin@finnexus.com
SUPER_ADMIN_PASSWORD=Admin@12345
SUPER_ADMIN_FIRST_NAME=Aditya
SUPER_ADMIN_LAST_NAME=Thakre
```

### 2.2 Frontend Environment Configuration
Each frontend application expects environment variables for cross-app linking:

```bash
# dashboard/.env, crm/.env, toolkit/.env, insurance-engine/.env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_DASHBOARD_URL=http://localhost:5173
VITE_CRM_URL=http://localhost:5174
VITE_TOOLKIT_URL=http://localhost:5175
VITE_INSURANCE_URL=http://localhost:5176
```

---

## 3. Step-by-Step Installation

### Step 1. Clone & Set Up Backend Virtual Environment
```powershell
cd d:\project\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 2. Install All Frontend Dependencies (Monorepo)
From the repository root:
```powershell
cd d:\project
npm install
```
This automatically installs dependencies across `dashboard`, `crm`, `toolkit`, and `insurance-engine`.

### Step 3. Initialize PostgreSQL & Redis (Docker)
If local PostgreSQL/Redis instances are not installed, start them using Docker Compose:
```powershell
docker compose up -d postgres redis
```

### Step 4. Run Migrations & Seed Baseline Data
```powershell
cd d:\project\backend
.\.venv\Scripts\Activate.ps1

# Run Alembic migrations up to head
alembic upgrade head

# Seed Master Roles, Super Admin, and Canonical Work Categories
python -m app.db.seed
```

---

## 4. Application Startup

### Option A: Local Development (Recommended)

1. **Terminal 1: Start Shared Backend**:
   ```powershell
   cd d:\project\backend
   .\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
2. **Terminal 2: Start All 4 Frontend Applications Concurrently**:
   ```powershell
   cd d:\project
   npm run dev
   ```
   This launches:
   - Dashboard: `http://localhost:5173`
   - CRM: `http://localhost:5174`
   - Toolkit: `http://localhost:5175`
   - Insurance Engine: `http://localhost:5176`

### Option B: Docker Compose Full Stack
```powershell
cd d:\project
docker compose up -d --build
```

---

## 5. Verified Troubleshooting Guide

### 5.1 Issue: Port Conflicts (`EADDRINUSE` or WinError 10048)
- **Symptom**: `listen EADDRINUSE: address already in use 0.0.0.0:5174` or `error: [Errno 10048] address already in use`.
- **Cause**: A previous Vite or Uvicorn instance is still bound to the port.
- **Resolution**:
  ```powershell
  # Find process listening on port 8000 or 5174
  netstat -ano | findstr :8000
  # Terminate process by PID (e.g. PID 12345)
  taskkill /PID 12345 /F
  ```

### 5.2 Issue: Database Connection Refused (`asyncpg.CannotConnectNowError`)
- **Symptom**: `HTTP 503 Service Unavailable: Database service is unavailable`.
- **Cause**: PostgreSQL is not running or credentials in `DATABASE_URL` do not match.
- **Resolution**:
  1. Verify container status: `docker compose ps postgres`.
  2. Test direct connectivity: `docker exec -it financeflow_postgres pg_isready -U postgres`.
  3. Ensure password in `DATABASE_URL` matches `POSTGRES_PASSWORD`.

### 5.3 Issue: Redis Connection Failure during Login
- **Symptom**: `redis.exceptions.ConnectionError: Error 10061 connecting to localhost:6379`.
- **Cause**: Redis server is stopped.
- **Resolution**:
  ```powershell
  docker compose up -d redis
  docker exec -it financeflow_redis redis-cli ping
  # Expected response: PONG
  ```

### 5.4 Issue: CORS Error in Browser Console
- **Symptom**: `Access to fetch has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`.
- **Cause**: Frontend is accessed via an origin not listed in `backend/app/core/config.py` `CORS_ORIGINS`.
- **Resolution**: Ensure the exact protocol, hostname, and port (e.g. `http://localhost:5174`) are included in `CORS_ORIGINS` in `backend/.env`.

### 5.5 Issue: PyMuPDF / fitz Import Error on Windows
- **Symptom**: `ImportError: DLL load failed while importing _fitz`.
- **Cause**: Missing Visual C++ Redistributable runtime on Windows.
- **Resolution**: Install the latest official [Microsoft Visual C++ Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe) and restart your terminal.

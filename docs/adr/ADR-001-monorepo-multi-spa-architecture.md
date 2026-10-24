# ADR-001: Monorepo Structure with 4 Independent SPAs and Shared Backend

## Status
`ACCEPTED` (Implemented & Verified)

## Context
FinNexus serves diverse financial operations roles: executive leaders (Dashboard), relationship officers and loan processors (CRM), back-office operations clerks (Toolkit), and insurance advisors (Insurance Engine). 

Building a monolithic single-page application would cause bundle bloat, tight coupling of unrelated domain dependencies, and complex routing. Conversely, separating into 4 completely independent repositories would lead to duplicated auth/API logic, fragmented deployments, and drift in UI design tokens.

## Decision
Organize FinNexus as an npm-managed monorepo containing:
1. `backend/`: Single shared FastAPI Python backend exposing `/api/v1`.
2. `dashboard/`: Vite + React 18 SPA (Port 5173).
3. `crm/`: Vite + React 18 SPA (Port 5174).
4. `toolkit/`: Vite + React 18 SPA (Port 5175).
5. `insurance-engine/`: Vite + React 18 SPA (Port 5176).
6. Cross-app navigation achieved through a shared `AppSwitcher` UI component and common `localStorage` JWT token storage.

## Consequences
### Positive
- Independent build pipelines (`build:dashboard`, `build:crm`, `build:toolkit`, `build:insurance`).
- Isolated component dependency graphs (e.g. `@dnd-kit` is only installed in `crm`).
- Single deployment surface for database migrations, auth, and business logic.
- Unified development startup via npm root script `npm run dev` running `concurrently`.

### Negative
- Cross-application shared components (like `AppSwitcher`, `TopNavigation`) are currently duplicated across each SPA's `src/components/` directory rather than extracted into an internal npm workspace package.

## Evidence
- [`package.json`](../../package.json): Root workspaces configured as `["dashboard", "crm", "toolkit", "insurance-engine"]`.
- [`docker-compose.yml`](../../docker-compose.yml): Services configured on ports 5173, 5174, 5175, 5176, and 8000.

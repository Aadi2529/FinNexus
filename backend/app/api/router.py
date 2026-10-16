from fastapi import APIRouter

from app.api import auth, crm, health, insurance, toolkit

api_router = APIRouter()

# Mount health endpoints (/api/v1/health/live, /api/v1/health/ready, /api/v1/health)
api_router.include_router(health.router)

# Mount authentication endpoints (/api/v1/auth/login, /api/v1/auth/refresh, etc.)
api_router.include_router(auth.router)

# Mount CRM endpoints (/api/v1/crm/customers, /api/v1/crm/stats, etc.)
api_router.include_router(crm.router)

# Mount direct CRM & Work Order endpoints (/api/v1/clients, /api/v1/work-orders, /api/v1/tasks, etc.)
api_router.include_router(crm.direct_router)

# Mount Finance Toolkit endpoints (/api/v1/toolkit/calculator/emi, etc.)
api_router.include_router(toolkit.router)

# Mount Insurance Engine endpoints (/api/v1/insurance/products, etc.)
api_router.include_router(insurance.router)

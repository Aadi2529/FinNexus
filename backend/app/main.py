"""FastAPI Application Entry Point for FinNexus."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown hooks."""
    # Startup: Resources initialization (pools verified on first query)
    yield
    # Shutdown: Clean up connections if open
    from app.db.session import engine

    await engine.dispose()


def create_application() -> FastAPI:
    """Application factory configuring middleware, routes, and OpenAPI metadata."""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "FinNexus unified financial operations platform API providing "
            "CRM, loan calculators, secure document vaults, and compliance audit logs."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS with explicit environment-controlled origins (no wildcards with credentials)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Mount versioned API routes under /api/v1
    application.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @application.get(
        "/",
        summary="Service Root",
        status_code=status.HTTP_200_OK,
        tags=["General"],
    )
    async def root() -> dict[str, Any]:
        """Root endpoint returning basic platform identification and documentation URLs."""
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "status": "online",
            "documentation": {
                "swagger": "/docs",
                "redoc": "/redoc",
                "openapi": f"{settings.API_V1_PREFIX}/openapi.json",
            },
            "api_v1": settings.API_V1_PREFIX,
        }

    return application


# Global ASGI application instance
app = create_application()

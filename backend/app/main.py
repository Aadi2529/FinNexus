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
    from app.core.redis import close_redis

    await engine.dispose()
    await close_redis()


def create_application() -> FastAPI:
    """Application factory configuring middleware, routes, and OpenAPI metadata."""
    is_production = settings.ENVIRONMENT == "production" and not settings.DEBUG

    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "FinNexus unified financial operations platform API providing "
            "CRM, loan calculators, secure document vaults, and compliance audit logs."
        ),
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else f"{settings.API_V1_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    # Security Headers Middleware
    @application.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response

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

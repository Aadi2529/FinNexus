"""Health, liveness, and readiness probe endpoints."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.core.redis import check_redis_connection
from app.db.session import check_database_connection

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])


@router.get("/live", summary="Liveness Probe", status_code=status.HTTP_200_OK)
async def liveness_check() -> dict[str, Any]:
    """Liveness probe to confirm that the FastAPI ASGI worker is alive and serving

    requests. Does not depend on external services (PostgreSQL, Redis).
    """
    return {
        "status": "alive",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/ready", summary="Readiness Probe")
async def readiness_check(response: Response) -> dict[str, Any]:
    """Readiness probe to verify that core external dependencies (PostgreSQL and

    Redis) are connected and accepting operations.

    Returns HTTP 200 OK when all dependencies respond. Returns HTTP 503 Service
    Unavailable when any dependency fails. Error messages are generic to prevent
    information leakage.
    """
    db_ok, db_msg = await check_database_connection()
    redis_ok, redis_msg = await check_redis_connection()

    all_ready = db_ok and redis_ok

    if not all_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if all_ready else "not_ready",
        "timestamp": datetime.now(UTC).isoformat(),
        "dependencies": {
            "database": db_msg,
            "redis": redis_msg,
        },
    }


@router.get("", summary="Comprehensive Health Status")
async def health_check(response: Response) -> dict[str, Any]:
    """Comprehensive health endpoint matching the FinNexus API standard.

    Returns operational status of the service and dependency health states.
    Returns HTTP 503 if any required dependency is unreachable.
    """
    db_ok, db_msg = await check_database_connection()
    redis_ok, redis_msg = await check_redis_connection()

    is_healthy = db_ok and redis_ok
    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if is_healthy else "degraded",
        "timestamp": datetime.now(UTC).isoformat(),
        "services": {
            "database": db_msg,
            "redis": redis_msg,
        },
        "version": settings.VERSION,
    }

"""Automated test suite for root, liveness, readiness, and health endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient):
    """Verify that root endpoint returns HTTP 200 with service metadata."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "FinNexus"
    assert data["status"] == "online"
    assert data["api_v1"] == "/api/v1"
    assert "documentation" in data
    assert data["documentation"]["swagger"] == "/docs"


@pytest.mark.asyncio
async def test_liveness_endpoint(async_client: AsyncClient):
    """Verify that liveness probe succeeds unconditionally without external dependencies."""
    response = await async_client.get("/api/v1/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert data["service"] == "FinNexus"
    assert "timestamp" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_readiness_endpoint_all_healthy(async_client: AsyncClient, monkeypatch):
    """Verify readiness returns HTTP 200 when both database and redis probes pass."""

    async def mock_db_ok():
        return True, "connected"

    async def mock_redis_ok():
        return True, "connected"

    monkeypatch.setattr("app.api.health.check_database_connection", mock_db_ok)
    monkeypatch.setattr("app.api.health.check_redis_connection", mock_redis_ok)

    response = await async_client.get("/api/v1/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["dependencies"]["database"] == "connected"
    assert data["dependencies"]["redis"] == "connected"


@pytest.mark.asyncio
async def test_readiness_endpoint_db_failure(async_client: AsyncClient, monkeypatch):
    """Verify readiness returns HTTP 503 and generic message when database is unavailable."""

    async def mock_db_fail():
        return False, "Database service is unavailable or non-responsive."

    async def mock_redis_ok():
        return True, "connected"

    monkeypatch.setattr("app.api.health.check_database_connection", mock_db_fail)
    monkeypatch.setattr("app.api.health.check_redis_connection", mock_redis_ok)

    response = await async_client.get("/api/v1/health/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert (
        data["dependencies"]["database"]
        == "Database service is unavailable or non-responsive."
    )
    assert data["dependencies"]["redis"] == "connected"
    # Ensure no internal credentials, ports, or raw tracebacks are leaked
    assert "postgres" not in str(data).lower()
    assert "password" not in str(data).lower()


@pytest.mark.asyncio
async def test_readiness_endpoint_redis_failure(async_client: AsyncClient, monkeypatch):
    """Verify readiness returns HTTP 503 when Redis is unavailable."""

    async def mock_db_ok():
        return True, "connected"

    async def mock_redis_fail():
        return False, "Redis cache service is unavailable or non-responsive."

    monkeypatch.setattr("app.api.health.check_database_connection", mock_db_ok)
    monkeypatch.setattr("app.api.health.check_redis_connection", mock_redis_fail)

    response = await async_client.get("/api/v1/health/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["dependencies"]["database"] == "connected"
    assert (
        data["dependencies"]["redis"]
        == "Redis cache service is unavailable or non-responsive."
    )


@pytest.mark.asyncio
async def test_comprehensive_health_healthy(async_client: AsyncClient, monkeypatch):
    """Verify comprehensive /api/v1/health returns 200 and healthy status when dependencies are up."""

    async def mock_db_ok():
        return True, "connected"

    async def mock_redis_ok():
        return True, "connected"

    monkeypatch.setattr("app.api.health.check_database_connection", mock_db_ok)
    monkeypatch.setattr("app.api.health.check_redis_connection", mock_redis_ok)

    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["database"] == "connected"
    assert data["services"]["redis"] == "connected"


@pytest.mark.asyncio
async def test_comprehensive_health_degraded(async_client: AsyncClient, monkeypatch):
    """Verify comprehensive /api/v1/health returns 503 and degraded status when a dependency fails."""

    async def mock_db_fail():
        return False, "Database service is unavailable or non-responsive."

    async def mock_redis_ok():
        return True, "connected"

    monkeypatch.setattr("app.api.health.check_database_connection", mock_db_fail)
    monkeypatch.setattr("app.api.health.check_redis_connection", mock_redis_ok)

    response = await async_client.get("/api/v1/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"


@pytest.mark.asyncio
async def test_cors_headers_configured(async_client: AsyncClient):
    """Verify that CORS middleware injects proper access control headers for allowed origins."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    response = await async_client.options("/api/v1/health/live", headers=headers)
    assert response.status_code == 200
    assert (
        response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    )
    assert response.headers.get("access-control-allow-credentials") == "true"

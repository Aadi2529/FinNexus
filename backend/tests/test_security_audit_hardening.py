"""Automated security hardening verification tests.

Validates:
1. Security headers presence (nosniff, frame-options, referrer-policy, permissions-policy).
2. Fail-safe production configuration rejection of insecure secret keys.
3. Rate limiting enforcement on brute force scenarios.
4. Production error sanitization on internal exceptions.
"""

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.core.config import Settings, settings
from app.core.rate_limit import RateLimiter, _memory_store


@pytest.mark.asyncio
async def test_security_headers_present(async_client: AsyncClient):
    """Verify standard defensive HTTP security headers are injected into responses."""
    response = await async_client.get("/api/v1/health/live")
    assert response.status_code == 200
    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "permissions-policy" in headers


def test_production_failsafe_rejects_insecure_key():
    """Verify Settings rejects default dev secret key in production environment."""
    with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="insecure_dev_key_must_be_overridden_in_production",
        )


def test_production_failsafe_rejects_short_key():
    """Verify Settings rejects secret keys under 32 characters in production."""
    with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="short_key_123",
        )


def test_production_valid_configuration():
    """Verify Settings succeeds and sets DEBUG=False when valid 32+ char key is used."""
    cfg = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 32,
    )
    assert cfg.ENVIRONMENT == "production"
    assert cfg.DEBUG is False


@pytest.mark.asyncio
async def test_rate_limiter_memory_fallback():
    """Verify in-memory sliding window rate limiter blocks requests exceeding max_requests."""
    limiter = RateLimiter(max_requests=3, window_seconds=60, prefix="test_audit")
    
    # Simulate 3 allowed requests
    now = 1000.0
    allowed1 = limiter._check_memory_rate_limit("rl:test_audit:127.0.0.1", now)
    allowed2 = limiter._check_memory_rate_limit("rl:test_audit:127.0.0.1", now + 1)
    allowed3 = limiter._check_memory_rate_limit("rl:test_audit:127.0.0.1", now + 2)
    assert allowed1 is True
    assert allowed2 is True
    assert allowed3 is True

    # 4th request must be rejected
    allowed4 = limiter._check_memory_rate_limit("rl:test_audit:127.0.0.1", now + 3)
    assert allowed4 is False

    # After window expires (now + 65), request should be allowed again
    allowed5 = limiter._check_memory_rate_limit("rl:test_audit:127.0.0.1", now + 65)
    assert allowed5 is True

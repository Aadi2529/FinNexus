"""Enterprise Redis connection manager, connection pool, and resilient circuit breaker."""

import logging
import threading
import time
from typing import Any

from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

logger = logging.getLogger("financeflow.redis")

# Shared connection pool and client singleton
_redis_pool: ConnectionPool | None = None
_redis_client: Redis | None = None
_pool_lock = threading.Lock()

# Thread-safe circuit breaker state
_circuit_open = False
_last_failure_time = 0.0
_circuit_cooldown = 30.0  # Seconds to wait before testing Redis again after a failure
_circuit_lock = threading.Lock()


def is_redis_available() -> bool:
    """Check if Redis is considered operational without initiating network I/O.
    
    Returns False immediately if circuit breaker is open and within cooldown.
    """
    global _circuit_open, _last_failure_time
    with _circuit_lock:
        if not _circuit_open:
            return True
        now = time.time()
        if (now - _last_failure_time) > _circuit_cooldown:
            # Allow a single probe attempt (half-open state)
            return True
        return False


def record_redis_failure() -> None:
    """Trip the circuit breaker to prevent repeated network delays."""
    global _circuit_open, _last_failure_time
    with _circuit_lock:
        _circuit_open = True
        _last_failure_time = time.time()
        logger.debug("Redis circuit breaker opened. Offline fallback active for %ds.", _circuit_cooldown)


def record_redis_success() -> None:
    """Reset the circuit breaker when Redis responds successfully."""
    global _circuit_open
    with _circuit_lock:
        _circuit_open = False


def get_redis_pool() -> ConnectionPool:
    """Return or initialize the shared Redis connection pool."""
    global _redis_pool
    if _redis_pool is None:
        with _pool_lock:
            if _redis_pool is None:
                _redis_pool = ConnectionPool.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=20,
                    socket_connect_timeout=0.2,
                    socket_timeout=0.3,
                )
    return _redis_pool


async def get_redis_client() -> Redis:
    """Return an asynchronous Redis client instance sharing the global pool."""
    global _redis_client
    if _redis_client is None:
        pool = get_redis_pool()
        _redis_client = Redis(connection_pool=pool)
    return _redis_client


async def close_redis() -> None:
    """Dispose of the Redis client and connection pool during application shutdown."""
    global _redis_client, _redis_pool
    if _redis_client:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None
    if _redis_pool:
        try:
            await _redis_pool.disconnect()
        except Exception:
            pass
        _redis_pool = None


async def check_redis_connection(
    timeout: float = 0.5,
) -> tuple[bool, str]:
    """Perform a fast asynchronous PING probe against Redis with circuit-breaker tracking.

    Returns:
        (True, 'connected') if healthy.
        (False, 'Redis cache service is unavailable or non-responsive.')
        without leaking credentials or connection strings on failure.
    """
    if not is_redis_available():
        return False, "Redis cache service is offline (circuit breaker open)."

    try:
        client = await get_redis_client()
        pong = await client.ping()
        if pong:
            record_redis_success()
            return True, "connected"
        record_redis_failure()
        return False, "Redis cache service failed to acknowledge ping."
    except Exception as exc:
        record_redis_failure()
        logger.debug("Redis health probe failed: %s", type(exc).__name__)
        return False, "Redis cache service is unavailable or non-responsive."

"""Redis connection provider and health probe."""

import logging

from redis.asyncio import Redis, from_url

from app.core.config import settings

logger = logging.getLogger("financeflow.redis")


async def get_redis_client() -> Redis:
    """Return an asynchronous Redis client instance."""
    return from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )


async def check_redis_connection(
    timeout: float = settings.REDIS_HEALTH_TIMEOUT,
) -> tuple[bool, str]:
    """Perform an asynchronous PING probe against Redis.

    Returns:
        (True, 'connected') if healthy.
        (False, 'Redis cache service is unavailable or non-responsive.')
        without leaking credentials or connection strings on failure.
    """
    client: Redis | None = None
    try:
        client = from_url(
            settings.REDIS_URL,
            socket_timeout=timeout,
            socket_connect_timeout=timeout,
        )
        pong = await client.ping()
        if pong:
            return True, "connected"
        return False, "Redis cache service failed to acknowledge ping."
    except Exception as exc:
        logger.warning("Redis health probe failed: %s", type(exc).__name__)
        return False, "Redis cache service is unavailable or non-responsive."
    finally:
        if client:
            await client.aclose()

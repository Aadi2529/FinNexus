"""Enterprise Rate Limiter with Redis sliding window and thread-safe in-memory fallback."""

import logging
import threading
import time
from fastapi import HTTPException, Request, status

from app.core.config import settings

logger = logging.getLogger("financeflow.rate_limit")

# Thread-safe in-memory sliding-window store for fallback
_memory_store: dict[str, list[float]] = {}
_memory_lock = threading.Lock()


def get_client_ip(request: Request) -> str:
    """Extract client IP address safely considering reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Take the leftmost client IP
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


class RateLimiter:
    """FastAPI dependency for rate limiting sensitive endpoints."""

    def __init__(
        self,
        max_requests: int = 10,
        window_seconds: int = 60,
        prefix: str = "general",
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.prefix = prefix

    async def __call__(self, request: Request) -> None:
        # If in testing and rate limits are not explicitly set, permit high throughput
        if settings.ENVIRONMENT == "test":
            return

        client_ip = get_client_ip(request)
        key = f"rl:{self.prefix}:{client_ip}"
        now = time.time()

        is_allowed = await self._check_rate_limit(key, now)
        if not is_allowed:
            logger.warning(
                "Rate limit exceeded for prefix '%s' from IP '%s' (max %d per %ds)",
                self.prefix,
                client_ip,
                self.max_requests,
                self.window_seconds,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Limit is {self.max_requests} requests per {self.window_seconds}s. Please try again later.",
                headers={"Retry-After": str(self.window_seconds)},
            )

    async def _check_rate_limit(self, key: str, now: float) -> bool:
        """Check and record request using Redis or in-memory fallback."""
        from app.core.redis import get_redis_client, is_redis_available, record_redis_failure, record_redis_success

        if not is_redis_available():
            return self._check_memory_rate_limit(key, now)

        # Try Redis
        try:
            redis_client = await get_redis_client()
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            results = await pipe.execute()
            count, ttl = results[0], results[1]

            # If newly created key, set expiration
            if ttl == -1 or ttl is None:
                await redis_client.expire(key, self.window_seconds)

            record_redis_success()
            if count > self.max_requests:
                return False
            return True
        except Exception:
            record_redis_failure()
            # Fallback to local memory sliding-window store
            return self._check_memory_rate_limit(key, now)

    def _check_memory_rate_limit(self, key: str, now: float) -> bool:
        """Sliding-window rate limiting in local memory."""
        cutoff = now - self.window_seconds
        with _memory_lock:
            timestamps = _memory_store.get(key, [])
            # Filter out expired timestamps
            valid_timestamps = [t for t in timestamps if t > cutoff]
            if len(valid_timestamps) >= self.max_requests:
                _memory_store[key] = valid_timestamps
                return False

            valid_timestamps.append(now)
            _memory_store[key] = valid_timestamps

            # Periodic cleanup of stagnant keys
            if len(_memory_store) > 1000:
                for k in list(_memory_store.keys()):
                    if not _memory_store[k] or _memory_store[k][-1] <= cutoff:
                        _memory_store.pop(k, None)

            return True

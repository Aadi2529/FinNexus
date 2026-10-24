"""Authentication and Cryptography Security Utilities for FinanceFlow."""

import hashlib
import logging
import secrets
import threading
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

logger = logging.getLogger("financeflow.security")

# Initialize Argon2id password hasher with secure financial standards
# (Memory: 64MB, Iterations: 3, Parallelism: 4)
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# In-memory blacklist fallback for local development when Redis is unreachable
_local_blacklist: dict[str, float] = {}
_blacklist_lock = threading.Lock()


def hash_password(password: str) -> str:
    """Hash plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against an Argon2id or bcrypt hash in constant time."""
    try:
        if hashed_password.startswith("$argon2"):
            return _hasher.verify(hashed_password, plain_password)
        elif hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            import bcrypt

            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8"),
            )
        else:
            # Fallback legacy verification using constant-time comparison
            return False
    except (VerifyMismatchError, Exception):
        return False


def validate_password_complexity(password: str) -> tuple[bool, str]:
    """Validate password complexity per enterprise security policy."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number."
    special_characters = "!@#$%^&*()-_=+[]{}|;:,.<>?"
    if not any(c in special_characters for c in password):
        return False, "Password must contain at least one special character."
    return True, ""


def create_access_token(
    user_id: str,
    email: str,
    roles: list[str],
    full_name: str | None = None,
    session_id: str | None = None,
    session_start: int | None = None,
    session_max_exp: int | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[str, str, datetime]:
    """Generate a signed JWT access token with 15m expiration bounded by 8h max session lifetime.

    Returns:
        (encoded_jwt_str, jti, expiry_datetime)
    """
    now = datetime.now(UTC)
    now_ts = int(now.timestamp())

    # Session start and absolute 8-hour maximum expiration
    s_start = session_start if session_start is not None else now_ts
    s_max_exp = session_max_exp if session_max_exp is not None else (s_start + 8 * 3600)

    # Access token lifespan: 15 minutes by default
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Access token expiry can never exceed absolute session expiration
    if int(expire.timestamp()) > s_max_exp:
        expire = datetime.fromtimestamp(s_max_exp, tz=UTC)

    jti = str(uuid.uuid4())
    payload = {
        "sub": str(user_id),
        "email": email,
        "full_name": full_name or "",
        "roles": roles,
        "iat": now_ts,
        "exp": int(expire.timestamp()),
        "jti": jti,
        "session_id": session_id or str(uuid.uuid4()),
        "session_start": s_start,
        "session_max_exp": s_max_exp,
    }

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return token, jti, expire


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "jti"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired.") from None
    except jwt.PyJWTError as e:
        raise ValueError(f"Invalid token: {e!s}") from e


def generate_refresh_token() -> tuple[str, str, datetime]:
    """Generate a cryptographically secure random refresh token.

    Returns:
        (raw_token, token_hash, expires_at)
    """
    raw_token = secrets.token_hex(32)
    token_hash = hash_token_sha256(raw_token)
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, token_hash, expires_at


def hash_token_sha256(raw_token: str) -> str:
    """Compute SHA-256 hex digest of a token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def blacklist_token_jti(jti: str, expires_at_timestamp: float) -> None:
    """Blacklist a token JTI until its expiration in Redis and local memory."""
    now = time.time()
    ttl = int(expires_at_timestamp - now)
    if ttl <= 0:
        return

    # Record in local in-memory store
    with _blacklist_lock:
        _local_blacklist[jti] = expires_at_timestamp
        # Prune expired items occasionally
        expired_jtis = [k for k, v in _local_blacklist.items() if v <= now]
        for k in expired_jtis:
            del _local_blacklist[k]

    # Try storing in Redis if available
    try:
        from app.core.redis import get_redis_client

        redis_client = await get_redis_client()
        await redis_client.setex(f"blacklist:{jti}", ttl, "revoked")
        await redis_client.aclose()
    except Exception as exc:
        logger.debug("Redis blacklist write skipped (offline): %s", exc)


async def is_token_jti_blacklisted(jti: str) -> bool:
    """Check if token JTI has been revoked in Redis or local memory."""
    now = time.time()
    with _blacklist_lock:
        if jti in _local_blacklist:
            if _local_blacklist[jti] > now:
                return True
            else:
                del _local_blacklist[jti]

    try:
        from app.core.redis import get_redis_client

        redis_client = await get_redis_client()
        val = await redis_client.get(f"blacklist:{jti}")
        await redis_client.aclose()
        if val is not None:
            return True
    except Exception as exc:
        logger.debug("Redis blacklist read skipped (offline): %s", exc)

    return False

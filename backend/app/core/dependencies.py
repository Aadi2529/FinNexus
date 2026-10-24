"""FastAPI Dependencies for Authentication, Database Sessions, and RBAC."""

import uuid
from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_access_token, is_token_jti_blacklisted
from app.db.models.auth import Role, User, UserRole
from app.db.session import get_db_session

# Security scheme using Bearer token header
security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Validate Bearer JWT access token and return active authenticated user."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_token = credentials.credentials

    try:
        payload = decode_access_token(raw_token)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(err),
            headers={"WWW-Authenticate": "Bearer"},
        ) from err

    # Enforce maximum session lifetime (8 hours from original login)
    session_max_exp = payload.get("session_max_exp")
    session_start = payload.get("session_start")
    import time
    now_ts = int(time.time())

    if session_max_exp is not None and now_ts > session_max_exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Maximum session lifetime of 8 hours exceeded.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if session_start is not None and (now_ts - session_start) > 8 * 3600:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Maximum session lifetime of 8 hours exceeded.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = payload.get("jti")
    if jti and await is_token_jti_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except (ValueError, TypeError) as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed user identifier in token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err

    try:
        stmt = (
            select(User).options(selectinload(User.roles)).where(User.id == user_uuid)
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable during authentication verification.",
        ) from exc

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact an administrator.",
        )

    return user


def get_user_roles(user: User) -> list[str]:
    """Extract list of role names associated with user."""
    return [r.name for r in (user.roles or [])]


def is_super_admin(user: User) -> bool:
    """Check if user holds SUPER_ADMIN role."""
    return "SUPER_ADMIN" in get_user_roles(user)


def is_admin(user: User) -> bool:
    """Check if user holds administrative privileges (SUPER_ADMIN or ADMIN)."""
    roles = get_user_roles(user)
    return "SUPER_ADMIN" in roles or "ADMIN" in roles


def is_manager(user: User) -> bool:
    """Check if user holds manager, administrative, or super-admin privileges."""
    roles = get_user_roles(user)
    return "SUPER_ADMIN" in roles or "ADMIN" in roles or "MANAGER" in roles


def is_employee(user: User) -> bool:
    """Check if user is strictly an operational employee without management oversight."""
    return not is_manager(user)


async def assert_not_last_super_admin(
    session: AsyncSession, target_user_id: uuid.UUID
) -> None:
    """Ensure deactivating, demoting, or deleting the target user does not remove the last active Super Admin.

    Enforced server-side with atomic count query to protect against concurrent requests.
    """
    # Check if target user is currently an active super admin
    target_stmt = (
        select(func.count(User.id))
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            Role.name == "SUPER_ADMIN",
            User.id == target_user_id,
            User.is_active.is_(True),
        )
    )
    is_target_active_super = (await session.execute(target_stmt)).scalar() or 0
    if is_target_active_super > 0:
        count_stmt = (
            select(func.count(User.id))
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.name == "SUPER_ADMIN", User.is_active.is_(True))
        )
        total_active_supers = (await session.execute(count_stmt)).scalar() or 0
        if total_active_supers <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate, demote, or delete the last active Super Admin account.",
            )


def require_roles(
    allowed_roles: list[str], allow_super_admin_bypass: bool = True
) -> Callable[..., Any]:
    """Dependency factory enforcing server-side Role-Based Access Control (RBAC).

    Super Admin accounts bypass role constraints unless specifically restricted.
    """

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_roles = get_user_roles(current_user)

        # Super Admin bypasses general role constraints
        if allow_super_admin_bypass and "SUPER_ADMIN" in user_roles:
            return current_user

        if any(role in user_roles for role in allowed_roles):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Access denied. Requires one of roles: {', '.join(allowed_roles)}. "
                f"Your roles: {', '.join(user_roles) if user_roles else 'None'}."
            ),
        )

    return role_checker


require_super_admin = require_roles(["SUPER_ADMIN"], allow_super_admin_bypass=False)
require_admin_or_super_admin = require_roles(["ADMIN", "SUPER_ADMIN"])
require_manager_or_above = require_roles(["MANAGER", "ADMIN", "SUPER_ADMIN"])

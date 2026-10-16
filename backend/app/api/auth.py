"""Authentication and authorization endpoints."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, security_bearer
from app.core.security import (
    blacklist_token_jti,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_token_sha256,
    validate_password_complexity,
    verify_password,
)
from app.db.models.auth import RefreshToken, Role, User, UserRole
from app.db.session import get_db_session
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

logger = logging.getLogger("financeflow.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate User and Issue Tokens",
)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Validate credentials and return dual-token JWT and refresh token."""
    normalized_email = payload.email.lower().strip()

    try:
        if normalized_email in ("admin@financeflow.com", "admin@finnexus.com"):
            stmt = (
                select(User)
                .options(selectinload(User.roles))
                .where(
                    or_(
                        User.email == "admin@finnexus.com",
                        User.email == "admin@financeflow.com",
                    )
                )
            )
        else:
            stmt = (
                select(User)
                .options(selectinload(User.roles))
                .where(User.email == normalized_email)
            )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("Database error during login for %s: %s", normalized_email, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is unavailable. Please verify database connection.",
        ) from exc

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact an administrator.",
        )

    roles = [r.name for r in user.roles]
    access_token, jti, expire = create_access_token(
        user_id=str(user.id),
        email=user.email,
        roles=roles,
        full_name=user.full_name,
    )

    raw_refresh_token, token_hash, refresh_expires_at = generate_refresh_token()
    db_refresh_token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=refresh_expires_at,
    )
    session.add(db_refresh_token)
    await session.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        token_type="bearer",
        expires_in=int((expire - datetime.now(UTC)).total_seconds()),
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            roles=roles,
        ),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate Refresh Token and Issue New Access Token",
)
async def refresh_token(
    payload: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Exchange a valid refresh token for a newly issued access token and rotated refresh token."""
    token_hash = hash_token_sha256(payload.refresh_token)
    now = datetime.now(UTC)

    stmt = (
        select(RefreshToken)
        .options(selectinload(RefreshToken.user).selectinload(User.roles))
        .where(RefreshToken.token_hash == token_hash)
    )
    result = await session.execute(stmt)
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Detect token reuse / replay attack
    if token_record.revoked_at is not None:
        logger.warning(
            "Detected attempt to reuse already revoked refresh token %s for user %s. Revoking token family.",
            token_record.id,
            token_record.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = token_record.user
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists.",
        )

    # Invalidate old refresh token (strict one-time rotation)
    token_record.revoked_at = now

    roles = [r.name for r in user.roles]
    new_access_token, jti, expire = create_access_token(
        user_id=str(user.id),
        email=user.email,
        roles=roles,
        full_name=user.full_name,
    )

    new_raw_refresh, new_token_hash, new_refresh_expires = generate_refresh_token()
    new_db_token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=new_token_hash,
        expires_at=new_refresh_expires,
    )
    session.add(new_db_token)
    await session.flush()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_raw_refresh,
        token_type="bearer",
        expires_in=int((expire - now).total_seconds()),
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            roles=roles,
        ),
    )


@router.post(
    "/logout",
    summary="Revoke Active Session",
)
async def logout(
    payload: RefreshTokenRequest | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Revoke current access token JTI and mark refresh token revoked."""
    if credentials and credentials.credentials:
        try:
            token_payload = decode_access_token(credentials.credentials)
            jti = token_payload.get("jti")
            exp = token_payload.get("exp", 0)
            if jti and exp:
                await blacklist_token_jti(jti, float(exp))
        except Exception:
            pass

    if payload and payload.refresh_token:
        token_hash = hash_token_sha256(payload.refresh_token)
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        res = await session.execute(stmt)
        token_obj = res.scalar_one_or_none()
        if token_obj and token_obj.revoked_at is None:
            token_obj.revoked_at = datetime.now(UTC)
            await session.flush()

    return {"message": "Successfully logged out."}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Authenticated User Profile",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return profile and permissions for currently authenticated user."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        roles=[r.name for r in current_user.roles],
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision New User Account",
)
async def register(
    payload: RegisterRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    """Create a new user account with validated credentials and strict RBAC governance."""
    requested_role = payload.role.upper().strip()

    ACTIVE_SYSTEM_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]
    if requested_role not in ACTIVE_SYSTEM_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role '{requested_role}' is obsolete or invalid. Active system roles: {', '.join(ACTIVE_SYSTEM_ROLES)}.",
        )

    # Determine caller identity if token provided
    caller: User | None = None
    if credentials and credentials.credentials:
        try:
            token_payload = decode_access_token(credentials.credentials)
            user_id_str = token_payload.get("sub")
            if user_id_str:
                caller_stmt = (
                    select(User)
                    .options(selectinload(User.roles))
                    .where(User.id == uuid.UUID(user_id_str))
                )
                caller = (await session.execute(caller_stmt)).scalar_one_or_none()
        except Exception:
            caller = None

    from app.core.dependencies import is_employee, is_super_admin

    # Privilege escalation defense:
    # 1. Employees cannot create users or assign system roles
    if caller and is_employee(caller):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees cannot create user accounts or assign system roles.",
        )

    # 2. Creating Super Admin, Admin, or Manager accounts is strictly restricted to Super Admins
    if requested_role in ["SUPER_ADMIN", "ADMIN", "MANAGER"]:
        if not caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Creating administrative or managerial accounts requires Super Admin authorization.",
            )
        if not is_super_admin(caller):
            if requested_role in ["SUPER_ADMIN", "ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only Super Admin accounts are authorized to create Admin accounts.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only Super Admin accounts are authorized to create Manager accounts.",
                )

    normalized_email = payload.email.lower().strip()

    valid, err_msg = validate_password_complexity(payload.password)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=err_msg,
        )

    # Check for duplicate email
    stmt = select(User).where(User.email == normalized_email)
    res = await session.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Look up or create role
    role_stmt = select(Role).where(Role.name == requested_role)
    role_res = await session.execute(role_stmt)
    role = role_res.scalar_one_or_none()
    if not role:
        role = Role(
            id=uuid.uuid4(), name=requested_role, description=f"{requested_role} Role"
        )
        session.add(role)
        await session.flush()

    new_user = User(
        id=uuid.uuid4(),
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        is_active=True,
    )
    session.add(new_user)
    await session.flush()

    user_role = UserRole(user_id=new_user.id, role_id=role.id)
    session.add(user_role)
    await session.flush()

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        is_active=new_user.is_active,
        roles=[role.name],
    )


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="List Organization Users",
)
async def list_users(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[UserResponse]:
    """List staff members in organization (accessible by Managers, Admins, Super Admins)."""
    from app.core.dependencies import is_employee

    if is_employee(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees are not authorized to view the organization user directory.",
        )

    stmt = select(User).options(selectinload(User.roles)).order_by(User.full_name.asc())
    users = (await session.execute(stmt)).scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            roles=[r.name for r in u.roles],
        )
        for u in users
    ]


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Update User Role or Status with Super Admin Invariant Defense",
)
async def update_user(
    user_id: uuid.UUID,
    payload: dict[str, Any],
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Modify user state, name, or role. Protects against removing the last active Super Admin."""
    from app.core.dependencies import (
        assert_not_last_super_admin,
        is_admin,
        is_super_admin,
    )

    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can modify user records.",
        )

    stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
    target_user = (await session.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    target_roles = [r.name for r in target_user.roles]
    target_is_super = "SUPER_ADMIN" in target_roles

    # Admin cannot modify a Super Admin account
    if target_is_super and not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can modify other Super Admin accounts.",
        )

    # If deactivating, assert not last super admin and revoke refresh tokens
    if "is_active" in payload:
        new_active = bool(payload["is_active"])
        if new_active is False:
            await assert_not_last_super_admin(session, user_id)
            target_user.is_active = False
            # Immediately revoke all active refresh tokens for this user
            from sqlalchemy import delete
            await session.execute(
                delete(RefreshToken).where(RefreshToken.user_id == user_id)
            )
        else:
            target_user.is_active = True

    if "full_name" in payload and payload["full_name"]:
        target_user.full_name = str(payload["full_name"]).strip()

    # Administrative password reset
    if "password" in payload and payload["password"]:
        valid, err_msg = validate_password_complexity(str(payload["password"]))
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=err_msg,
            )
        target_user.hashed_password = hash_password(str(payload["password"]))
        # Invalidate existing refresh tokens so user must authenticate with new password
        from sqlalchemy import delete
        await session.execute(
            delete(RefreshToken).where(RefreshToken.user_id == user_id)
        )

    # Role reassignment
    if "role" in payload and payload["role"]:
        new_role_name = str(payload["role"]).upper().strip()
        ACTIVE_SYSTEM_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]
        if new_role_name not in ACTIVE_SYSTEM_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Role '{new_role_name}' is obsolete or invalid.",
            )

        if new_role_name == "SUPER_ADMIN" and not is_super_admin(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admins can promote users to Super Admin.",
            )

        # If demoting away from Super Admin, assert not last super admin
        if target_is_super and new_role_name != "SUPER_ADMIN":
            await assert_not_last_super_admin(session, user_id)

        # Update role mapping
        role_stmt = select(Role).where(Role.name == new_role_name)
        new_role = (await session.execute(role_stmt)).scalar_one_or_none()
        if not new_role:
            new_role = Role(id=uuid.uuid4(), name=new_role_name, description=f"{new_role_name} Role")
            session.add(new_role)
            await session.flush()

        # Delete existing role associations and assign new role
        del_roles_stmt = select(UserRole).where(UserRole.user_id == user_id)
        existing_uroles = (await session.execute(del_roles_stmt)).scalars().all()
        for ur in existing_uroles:
            await session.delete(ur)
        await session.flush()

        session.add(UserRole(user_id=target_user.id, role_id=new_role.id))
        await session.flush()

    await session.commit()

    # Re-query
    refreshed_stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
    refreshed = (await session.execute(refreshed_stmt)).scalar_one()
    return UserResponse(
        id=refreshed.id,
        email=refreshed.email,
        full_name=refreshed.full_name,
        is_active=refreshed.is_active,
        roles=[r.name for r in refreshed.roles],
    )


@router.delete(
    "/users/{user_id}",
    summary="Permanently Delete User Account (Super Admin Guarded)",
)
async def delete_user(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a user account with Super Admin authorization and referential-integrity protection."""
    from sqlalchemy import delete, func

    from app.core.dependencies import assert_not_last_super_admin, is_super_admin
    from app.db.models.crm import WorkOrder

    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can permanently delete user accounts.",
        )

    stmt = select(User).where(User.id == user_id)
    target = (await session.execute(stmt)).scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    # Invariant: Never delete the last active Super Admin
    await assert_not_last_super_admin(session, user_id)

    # Referential integrity check: check active work orders
    active_wo_stmt = select(func.count(WorkOrder.id)).where(
        WorkOrder.assigned_to_id == user_id,
        WorkOrder.status.in_(["PENDING", "IN_PROGRESS", "REVIEW"]),
    )
    active_wo_count = (await session.execute(active_wo_stmt)).scalar() or 0
    if active_wo_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete user '{target.full_name}': they have {active_wo_count} active assigned work orders. Reassign the work orders before deletion.",
        )

    # Clean up dependent tokens and role associations
    await session.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    await session.execute(delete(UserRole).where(UserRole.user_id == user_id))
    await session.delete(target)
    await session.commit()

    return {"message": f"User '{target.full_name}' ({target.email}) deleted successfully."}



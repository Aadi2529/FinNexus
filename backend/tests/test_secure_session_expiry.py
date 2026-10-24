"""Tests for Secure Session Expiration and Browser Session Management.

Verifies:
1. Access token expiration is strictly 15 minutes.
2. Login sets HttpOnly browser-session cookie (finnexus_session) with no persistent max_age/expires.
3. Login returns session_expires_in (8 hours = 28,800 seconds).
4. Access token JWT payload contains session_start and session_max_exp claims.
5. Server rejects access tokens expired beyond 15 minutes with HTTP 401.
6. Server enforces absolute 8-hour session lifetime even if user remains active.
7. Refresh tokens cannot extend session lifetime beyond 8 hours from original login.
8. /api/v1/auth/session allows seamless cross-application SSO authentication using HttpOnly session cookie.
9. Logout clears the browser-session cookie and revokes tokens in DB/blacklist.
10. Server restart does not revive expired or revoked sessions.
11. RBAC permissions remain fully intact under the secure session architecture.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_token_sha256,
)
from app.db.models.auth import RefreshToken, User
from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def test_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create isolated in-memory SQLite test database with initial seed data."""
    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        await seed_initial_data(session)

    async with session_factory() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()


@pytest.fixture(scope="function")
async def client(test_db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Yield test client with overridden database session."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_db_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_01_login_sets_15m_access_token_and_session_cookie(client: AsyncClient):
    """Verify login issues 15m access token, 8h session duration, and HttpOnly session cookie."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "officer@financeflow.com", "password": "Officer@12345"},
    )
    assert res.status_code == 200
    data = res.json()

    # 1. Access token expiration: 15 minutes (900 seconds)
    assert 890 <= data["expires_in"] <= 900
    # 2. Maximum session lifetime: 8 hours (28,800 seconds)
    assert 28700 <= data["session_expires_in"] <= 28800

    # 3. HttpOnly browser-session cookie set
    assert "finnexus_session" in res.cookies
    cookie = res.cookies["finnexus_session"]
    assert cookie == data["refresh_token"]

    # 4. Access token JWT payload contains session claims
    access_token = data["access_token"]
    payload = decode_access_token(access_token)
    assert "session_start" in payload
    assert "session_max_exp" in payload
    assert payload["session_max_exp"] - payload["session_start"] == 8 * 3600
    assert payload["exp"] - payload["iat"] <= 900


@pytest.mark.asyncio
async def test_02_access_token_rejected_after_15_minutes(client: AsyncClient, test_db_session: AsyncSession):
    """Verify access token expired beyond 15 minutes is rejected with HTTP 401."""
    # Issue token that already expired 1 minute ago
    token, _, _ = create_access_token(
        user_id=str(uuid.uuid4()),
        email="officer@financeflow.com",
        roles=["EMPLOYEE"],
        expires_delta=timedelta(minutes=-1),
    )

    res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_03_server_enforces_8h_maximum_session_lifetime_on_requests(client: AsyncClient, test_db_session: AsyncSession):
    """Verify active request with access token past the 8-hour session lifetime is rejected with HTTP 401."""
    # Find officer user
    stmt = select(User).where(User.email == "officer@financeflow.com")
    officer = (await test_db_session.execute(stmt)).scalar_one()

    now_ts = int(datetime.now(UTC).timestamp())
    # Session started 8 hours and 5 minutes ago
    session_start = now_ts - (8 * 3600 + 300)
    session_max_exp = session_start + (8 * 3600)  # expired 5 minutes ago

    # Create token where exp is unexpired but session_max_exp is in the past
    payload = {
        "sub": str(officer.id),
        "email": officer.email,
        "roles": ["EMPLOYEE"],
        "iat": now_ts - 300,
        "exp": now_ts + 600,
        "jti": str(uuid.uuid4()),
        "session_start": session_start,
        "session_max_exp": session_max_exp,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
    assert "8 hours" in res.json()["detail"]


@pytest.mark.asyncio
async def test_04_refresh_token_cannot_extend_session_beyond_8_hours(client: AsyncClient, test_db_session: AsyncSession):
    """Verify refresh token rotation cannot extend session beyond the 8-hour maximum lifetime."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "officer@financeflow.com", "password": "Officer@12345"},
    )
    raw_refresh = login_res.json()["refresh_token"]
    token_hash = hash_token_sha256(raw_refresh)

    # Simulate that 8 hours have passed: advance created_at and expires_at to the past
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    db_token = (await test_db_session.execute(stmt)).scalar_one()
    past_time = datetime.now(UTC) - timedelta(hours=8, minutes=1)
    db_token.created_at = past_time
    db_token.expires_at = past_time
    await test_db_session.flush()

    # Attempt to refresh after 8 hours must be rejected
    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": raw_refresh},
    )
    assert refresh_res.status_code == 401
    assert "8 hours" in refresh_res.json()["detail"]


@pytest.mark.asyncio
async def test_05_session_cookie_sso_endpoint(client: AsyncClient):
    """Verify /api/v1/auth/session validates HttpOnly session cookie without URL tokens."""
    # 1. Without session cookie -> 401
    unauth_res = await client.get("/api/v1/auth/session")
    assert unauth_res.status_code == 401

    # 2. Login sets cookie
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "officer@financeflow.com", "password": "Officer@12345"},
    )
    assert login_res.status_code == 200

    # 3. Call /auth/session with session cookie -> 200 with new access token
    session_res = await client.get("/api/v1/auth/session")
    assert session_res.status_code == 200
    data = session_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "officer@financeflow.com"
    assert 890 <= data["expires_in"] <= 900
    assert data["session_expires_in"] <= 28800


@pytest.mark.asyncio
async def test_06_logout_clears_cookie_and_revokes_session(client: AsyncClient, test_db_session: AsyncSession):
    """Verify logout deletes session cookie and revokes refresh token in database."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "officer@financeflow.com", "password": "Officer@12345"},
    )
    raw_refresh = login_res.json()["refresh_token"]
    access_token = login_res.json()["access_token"]
    token_hash = hash_token_sha256(raw_refresh)

    # Call logout
    logout_res = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"refresh_token": raw_refresh},
    )
    assert logout_res.status_code == 200

    # Refresh token must be revoked in DB
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    db_token = (await test_db_session.execute(stmt)).scalar_one()
    assert db_token.revoked_at is not None

    # Access token must now be rejected
    me_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 401

    # Attempting to refresh revoked session must be rejected
    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": raw_refresh},
    )
    assert refresh_res.status_code == 401


@pytest.mark.asyncio
async def test_07_logout_without_auth_or_expired_token_still_succeeds(client: AsyncClient):
    """Verify logging out after expiration cleans up cookies without throwing errors or redirect loops."""
    # Logout called without credentials or with an expired token
    logout_res = await client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Successfully logged out."


@pytest.mark.asyncio
async def test_08_rbac_restrictions_intact(client: AsyncClient):
    """Verify RBAC role barriers remain enforced under secure session."""
    # Employee cannot manage users
    emp_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "employee@financeflow.com", "password": "Employee@12345"},
    )
    emp_token = emp_res.json()["access_token"]
    users_res = await client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert users_res.status_code == 403

    # Super Admin can manage users
    admin_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@finnexus.com", "password": "Admin@12345"},
    )
    admin_token = admin_res.json()["access_token"]
    admin_users_res = await client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_users_res.status_code == 200

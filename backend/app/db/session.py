"""Database session, engine initialization, and connection health probes."""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger("financeflow.db")


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy 2.x declarative models."""

    pass


# Asynchronous engine configuration with connection pooling and health ping
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Asynchronous session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency yielding an asynchronous SQLAlchemy session with automatic rollback on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_connection(
    timeout: float = settings.DB_HEALTH_TIMEOUT,
) -> tuple[bool, str]:
    """Perform a non-destructive SELECT 1 probe against PostgreSQL.

    Returns:
        (True, 'connected') if healthy.
        (False, 'Database service is unavailable or non-responsive.') without
        leaking credentials or connection strings on failure.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True, "connected"
    except Exception as exc:
        logger.warning("Database connection probe failed: %s", type(exc).__name__)
        return False, "Database service is unavailable or non-responsive."

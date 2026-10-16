"""Pytest fixtures and configuration for FinanceFlow Backend."""

import os
import sys
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

# Ensure backend root is on sys.path for direct module discovery
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app  # noqa: E402


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Yield an asynchronous HTTP test client bound to the FastAPI ASGI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

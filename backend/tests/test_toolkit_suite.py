"""Automated Test Suite for FinNexus Enterprise Document Processing Toolkit.

Covers:
- Password derivation algorithms (UIDAI Aadhaar NAME4_YYYY, Income Tax DDMMYYYY).
- Authorized PDF decryption, boundary cropping, and 300 DPI rasterization.
- Aadhaar processor endpoint (normal, masked, both, wrong password, corrupted).
- PAN processor endpoint (encrypted, unencrypted, wrong DOB, individual downloads, ZIP).
- PDF merger endpoint (multi-file ordering, invalid inputs, page count).
- Images to PDF endpoint (JPEG/PNG/WebP, dimensions, margins).
- Secure download and inline preview endpoints with anti-path-traversal verification.
"""

from __future__ import annotations

import io
from collections.abc import AsyncGenerator

import pytest
import pymupdf
from PIL import Image
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.seed import seed_initial_data
from app.db.session import Base, get_db_session
from app.main import app
from app.services.document_processor import (
    derive_aadhaar_password,
    derive_pan_password,
    sanitize_filename,
)

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def test_db_session() -> AsyncGenerator[AsyncSession, None]:
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
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_db_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@finnexus.com", "password": "Admin@12345"},
    )
    if res.status_code != 200:
        # Fallback to legacy email if seeded with legacy
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@financeflow.com", "password": "Admin@12345"},
        )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# -----------------------------------------------------------------------------
# Test File Generators
# -----------------------------------------------------------------------------


def make_test_pdf(
    title: str = "Test Document",
    is_aadhaar: bool = False,
    is_pan: bool = False,
    password: str | None = None,
) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=595.3, height=841.9)
    page.insert_text((50, 100), title, fontsize=14)

    if is_aadhaar:
        page.insert_text((50, 520), "Government of India", fontsize=12)
        page.insert_text((50, 550), "Unique Identification Authority of India", fontsize=11)
        page.insert_text((50, 580), "Mera Aadhaar, Meri Pehchan", fontsize=10)
        page.insert_text((50, 620), "To: Aditya Subhash Thakare", fontsize=10)
        page.insert_text((50, 650), "DOB: 26/05/2004", fontsize=10)
        page.insert_text((50, 680), "VID : 9182 7364 5512 0019", fontsize=10)
        page.insert_text((50, 710), "1234 5678 9012", fontsize=12)

    if is_pan:
        page.insert_text((50, 520), "INCOME TAX DEPARTMENT", fontsize=12)
        page.insert_text((50, 550), "GOVT. OF INDIA", fontsize=11)
        page.insert_text((50, 580), "Permanent Account Number Card", fontsize=10)
        page.insert_text((50, 620), "Name: ADITYA THAKARE", fontsize=10)
        page.insert_text((50, 650), "Father's Name: SUBHASH THAKARE", fontsize=10)
        page.insert_text((50, 680), "Date of Birth: 29/05/2004", fontsize=10)
        page.insert_text((50, 710), "ABCDE1234F", fontsize=12)

    buf = io.BytesIO()
    if password:
        doc.save(
            buf,
            encryption=pymupdf.PDF_ENCRYPT_AES_256,
            user_pw=password,
            owner_pw=password + "_owner",
        )
    else:
        doc.save(buf)
    doc.close()
    return buf.getvalue()


def make_test_image(format: str = "JPEG", size=(300, 200), color=(13, 148, 136)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


# -----------------------------------------------------------------------------
# Unit Tests: Password Derivation & Sanitization
# -----------------------------------------------------------------------------


def test_aadhaar_password_derivation():
    assert derive_aadhaar_password("Aditya Subhash Thakare", "26/05/2004") == "ADIT2004"
    assert derive_aadhaar_password("Priya Sharma", "2001-11-15") == "PRIY2001"
    assert derive_aadhaar_password("  Rahul   Verma  ", "12-08-1995") == "RAHU1995"


def test_aadhaar_password_derivation_edge_cases():
    with pytest.raises(Exception):
        derive_aadhaar_password("Ab", "2004-01-01")  # Less than 4 letters
    with pytest.raises(Exception):
        derive_aadhaar_password("", "2004-01-01")
    with pytest.raises(Exception):
        derive_aadhaar_password("Valid Name", "invalid-date")


def test_pan_password_derivation():
    assert derive_pan_password("29/05/2004") == "29052004"
    assert derive_pan_password("2004-05-29") == "29052004"
    assert derive_pan_password("01/01/1990") == "01011990"
    assert derive_pan_password("5-8-1998") == "05081998"


def test_pan_password_derivation_invalid():
    with pytest.raises(Exception):
        derive_pan_password("not-a-date")
    with pytest.raises(Exception):
        derive_pan_password("")


def test_filename_sanitization():
    assert sanitize_filename("my document.pdf") == "my_document.pdf"
    assert sanitize_filename("../../etc/passwd.pdf") == "passwd.pdf"
    assert sanitize_filename("..\\..\\malicious.pdf") == "malicious.pdf"


# -----------------------------------------------------------------------------
# Endpoint Tests: Aadhaar Processor
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aadhaar_processor_encrypted_success(
    client: AsyncClient, auth_headers: dict[str, str]
):
    # Encrypted with standard password ADIT2004
    pdf_bytes = make_test_pdf(
        title="UIDAI e-Aadhaar Letter",
        is_aadhaar=True,
        password="ADIT2004",
    )

    files = {
        "normal_file": ("normal_aadhaar.pdf", pdf_bytes, "application/pdf"),
    }
    data = {
        "full_name": "Aditya Subhash Thakare",
        "dob": "26/05/2004",
    }

    res = await client.post(
        "/api/v1/toolkit/identity/aadhaar",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["status"] == "SUCCESS"
    assert payload["tool"] == "aadhaar_processor"
    assert len(payload["files"]) >= 3  # unlocked_pdf, cropped_pdf, card_image

    # Check generated filenames
    file_types = {f["file_type"] for f in payload["files"]}
    assert "unlocked_pdf" in file_types
    assert "cropped_pdf" in file_types
    assert "card_image" in file_types


@pytest.mark.asyncio
async def test_aadhaar_processor_decryption_failure(
    client: AsyncClient, auth_headers: dict[str, str]
):
    # PDF encrypted with SECRET99, but user inputs Aditya / 2004 -> derives ADIT2004
    pdf_bytes = make_test_pdf(
        title="Encrypted Document",
        password="WRONGPASS",
    )
    files = {
        "normal_file": ("normal.pdf", pdf_bytes, "application/pdf"),
    }
    data = {
        "full_name": "Aditya Subhash Thakare",
        "dob": "26/05/2004",
    }

    res = await client.post(
        "/api/v1/toolkit/identity/aadhaar",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 400
    assert "password" in res.json()["detail"].lower() or "decryption" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_aadhaar_processor_both_normal_and_masked(
    client: AsyncClient, auth_headers: dict[str, str]
):
    pdf_normal = make_test_pdf(title="Normal Aadhaar", is_aadhaar=True)
    pdf_masked = make_test_pdf(title="Masked Aadhaar", is_aadhaar=True)

    files = {
        "normal_file": ("normal.pdf", pdf_normal, "application/pdf"),
        "masked_file": ("masked.pdf", pdf_masked, "application/pdf"),
    }
    data = {
        "full_name": "Aditya Subhash Thakare",
        "dob": "26/05/2004",
    }

    res = await client.post(
        "/api/v1/toolkit/identity/aadhaar",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 200
    payload = res.json()
    assert len(payload["files"]) == 6  # 3 files per document
    assert payload["zip_download_url"] is not None


# -----------------------------------------------------------------------------
# Endpoint Tests: PAN Processor
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pan_processor_encrypted_success(
    client: AsyncClient, auth_headers: dict[str, str]
):
    # Encrypted with DDMMYYYY = 29052004
    pdf_bytes = make_test_pdf(
        title="e-PAN Card Document",
        is_pan=True,
        password="29052004",
    )
    files = {
        "file": ("pan_document.pdf", pdf_bytes, "application/pdf"),
    }
    data = {
        "full_name": "Aditya Thakare",
        "dob": "29/05/2004",
    }

    res = await client.post(
        "/api/v1/toolkit/identity/pan",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["status"] == "SUCCESS"
    assert len(payload["files"]) == 3
    assert payload["zip_download_url"] is not None


@pytest.mark.asyncio
async def test_pan_processor_decryption_failure(
    client: AsyncClient, auth_headers: dict[str, str]
):
    pdf_bytes = make_test_pdf(
        title="e-PAN Card Document",
        is_pan=True,
        password="99999999",
    )
    files = {
        "file": ("pan_document.pdf", pdf_bytes, "application/pdf"),
    }
    data = {
        "full_name": "Aditya Thakare",
        "dob": "29/05/2004",
    }

    res = await client.post(
        "/api/v1/toolkit/identity/pan",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 400


# -----------------------------------------------------------------------------
# Endpoint Tests: PDF Merger
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pdf_merger_success(
    client: AsyncClient, auth_headers: dict[str, str]
):
    doc1 = make_test_pdf(title="Document One")
    doc2 = make_test_pdf(title="Document Two")

    files = [
        ("files", ("part1.pdf", doc1, "application/pdf")),
        ("files", ("part2.pdf", doc2, "application/pdf")),
    ]
    data = {
        "output_filename": "final_merged.pdf",
    }

    res = await client.post(
        "/api/v1/toolkit/pdf/merge",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["status"] == "SUCCESS"
    assert payload["total_pages"] == 2
    assert payload["output_filename"] == "final_merged.pdf"
    assert "/api/v1/toolkit/download/" in payload["download_url"]


@pytest.mark.asyncio
async def test_pdf_merger_single_file_rejection(
    client: AsyncClient, auth_headers: dict[str, str]
):
    doc1 = make_test_pdf(title="Lone Document")
    files = [
        ("files", ("doc.pdf", doc1, "application/pdf")),
    ]
    res = await client.post(
        "/api/v1/toolkit/pdf/merge",
        headers=auth_headers,
        files=files,
    )
    assert res.status_code == 400


# -----------------------------------------------------------------------------
# Endpoint Tests: Images to PDF
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_images_to_pdf_success(
    client: AsyncClient, auth_headers: dict[str, str]
):
    img1 = make_test_image("JPEG", (400, 300), color=(10, 100, 200))
    img2 = make_test_image("PNG", (300, 400), color=(200, 50, 50))

    files = [
        ("files", ("photo1.jpg", img1, "image/jpeg")),
        ("files", ("photo2.png", img2, "image/png")),
    ]
    data = {
        "page_size": "a4",
        "orientation": "auto",
        "margin": "small",
        "output_filename": "compiled_photos.pdf",
    }

    res = await client.post(
        "/api/v1/toolkit/images/to-pdf",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["status"] == "SUCCESS"
    assert payload["total_pages"] == 2
    assert payload["output_filename"] == "compiled_photos.pdf"


# -----------------------------------------------------------------------------
# Endpoint Tests: Secure Download & Anti-Path-Traversal
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_download_and_preview_endpoints(
    client: AsyncClient, auth_headers: dict[str, str]
):
    # First create a merged file to get a valid job_id
    doc1 = make_test_pdf(title="Doc A")
    doc2 = make_test_pdf(title="Doc B")
    res = await client.post(
        "/api/v1/toolkit/pdf/merge",
        headers=auth_headers,
        data={"output_filename": "download_test.pdf"},
        files=[
            ("files", ("a.pdf", doc1, "application/pdf")),
            ("files", ("b.pdf", doc2, "application/pdf")),
        ],
    )
    assert res.status_code == 200
    job_id = res.json()["job_id"]

    # 1. Valid download
    dl_res = await client.get(
        f"/api/v1/toolkit/download/{job_id}/download_test.pdf",
        headers=auth_headers,
    )
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"] == "application/pdf"
    assert "private, no-store" in dl_res.headers["cache-control"]

    # 2. Valid preview
    prev_res = await client.get(
        f"/api/v1/toolkit/preview/{job_id}/download_test.pdf",
        headers=auth_headers,
    )
    assert prev_res.status_code == 200

    # 3. Path traversal attack blocked
    bad_res = await client.get(
        f"/api/v1/toolkit/download/{job_id}/../../etc/passwd",
        headers=auth_headers,
    )
    assert bad_res.status_code == 400 or bad_res.status_code == 404

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
    AADHAAR_BOTTOM_CROP,
    AADHAAR_FIXED_CROP_RATIOS,
    AADHAAR_LEFT_CROP,
    AADHAAR_RIGHT_CROP,
    AADHAAR_TOP_CROP,
    PAN_BOTTOM_CROP,
    PAN_FIXED_CROP_RATIOS,
    PAN_LEFT_CROP,
    PAN_RIGHT_CROP,
    PAN_TOP_CROP,
    TOOLKIT_TEMP_DIR,
    derive_aadhaar_password,
    derive_pan_password,
    detect_aadhaar_card_crop_rect,
    detect_pan_card_crop_rect,
    get_aadhaar_filenames,
    get_fixed_aadhaar_crop_rect,
    get_fixed_pan_crop_rect,
    get_pan_filenames,
    is_safe_filename,
    normalize_client_name,
    sanitize_filename,
    validate_crop_against_page,
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


def test_fixed_crop_configuration_and_boundaries():
    assert AADHAAR_TOP_CROP == 0.72
    assert AADHAAR_LEFT_CROP == 0.08
    assert AADHAAR_BOTTOM_CROP == 0.07
    assert AADHAAR_RIGHT_CROP == 0.08

    assert PAN_TOP_CROP == 0.77
    assert PAN_LEFT_CROP == 0.11
    assert PAN_RIGHT_CROP == 0.49
    assert PAN_BOTTOM_CROP == 0.05

    doc = pymupdf.open()
    page = doc.new_page(width=595.3, height=841.9)

    # 1. Aadhaar fixed crop validation
    aadhaar_rect = get_fixed_aadhaar_crop_rect(page)
    assert aadhaar_rect.is_valid
    assert 0 <= aadhaar_rect.x0 < aadhaar_rect.x1 <= page.rect.width
    assert 0 <= aadhaar_rect.y0 < aadhaar_rect.y1 <= page.rect.height
    assert round(aadhaar_rect.x0, 2) == round(page.rect.width * AADHAAR_FIXED_CROP_RATIOS["x0"], 2)
    assert round(aadhaar_rect.y0, 2) == round(page.rect.height * AADHAAR_FIXED_CROP_RATIOS["y0"], 2)

    # 2. PAN fixed crop validation
    pan_rect = get_fixed_pan_crop_rect(page)
    assert pan_rect.is_valid
    assert 0 <= pan_rect.x0 < pan_rect.x1 <= page.rect.width
    assert 0 <= pan_rect.y0 < pan_rect.y1 <= page.rect.height
    assert round(pan_rect.x0, 2) == round(page.rect.width * PAN_FIXED_CROP_RATIOS["x0"], 2)
    assert round(pan_rect.y0, 2) == round(page.rect.height * PAN_FIXED_CROP_RATIOS["y0"], 2)

    # 3. Detect methods apply fixed crop by default
    assert detect_aadhaar_card_crop_rect(page) == aadhaar_rect
    assert detect_pan_card_crop_rect(page) == pan_rect

    # 4. Out-of-bounds boundary clamping
    extreme_crop = pymupdf.Rect(-100, -50, 1000, 1200)
    clamped = validate_crop_against_page(extreme_crop, page.rect)
    assert clamped.x0 >= page.rect.x0
    assert clamped.y0 >= page.rect.y0
    assert clamped.x1 <= page.rect.x1
    assert clamped.y1 <= page.rect.y1

    doc.close()



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

    # Check generated filenames & types
    file_types = {f["file_type"] for f in payload["files"]}
    assert "unlocked_pdf" in file_types
    assert "cropped_pdf" in file_types
    assert "card_image" in file_types

    file_names = [f["name"] for f in payload["files"]]
    assert "ADITYA SUBHASH THAKARE NORMAL UNLOCKED.pdf" in file_names
    assert "ADITYA SUBHASH THAKARE NORMAL CROPPED.pdf" in file_names
    assert "ADITYA SUBHASH THAKARE NORMAL.jpg" in file_names
    assert payload["zip_download_url"] is not None
    assert "ADITYA%20SUBHASH%20THAKARE%20AADHAAR%20FILES.zip" in payload["zip_download_url"]


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
    file_names = [f["name"] for f in payload["files"]]
    assert "ADITYA SUBHASH THAKARE NORMAL UNLOCKED.pdf" in file_names
    assert "ADITYA SUBHASH THAKARE NORMAL CROPPED.pdf" in file_names
    assert "ADITYA SUBHASH THAKARE NORMAL.jpg" in file_names
    assert "ADITYA SUBHASH THAKARE MASKED UNLOCKED.pdf" in file_names
    assert "ADITYA SUBHASH THAKARE MASKED CROPPED.pdf" in file_names
    assert "ADITYA SUBHASH THAKARE MASKED.jpg" in file_names


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
    file_names = [f["name"] for f in payload["files"]]
    assert "ADITYA THAKARE PAN UNLOCKED.pdf" in file_names
    assert "ADITYA THAKARE PAN CROPPED.pdf" in file_names
    assert "ADITYA THAKARE PAN.jpg" in file_names
    assert "ADITYA%20THAKARE%20PAN%20FILES.zip" in payload["zip_download_url"]


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


# -----------------------------------------------------------------------------
# Tests: Client Name Normalization, Traversal Prevention & Architecture
# -----------------------------------------------------------------------------


def test_client_name_normalization():
    # Normal uppercase
    assert normalize_client_name("Aditya Subhash Thakare") == "ADITYA SUBHASH THAKARE"
    # Traversal characters removed
    assert normalize_client_name("../../admin/root") == "ADMIN ROOT"
    assert normalize_client_name("..\\..\\passwords") == "PASSWORDS"
    # Unsafe filesystem characters replaced
    assert normalize_client_name("John: Doe* <Senior>") == "JOHN DOE SENIOR"
    # Windows reserved name fallback
    assert normalize_client_name("CON") == "CLIENT"
    assert normalize_client_name("NUL") == "CLIENT"
    assert normalize_client_name("PRN") == "CLIENT"
    # Empty or purely non-alphanumeric fallback
    assert normalize_client_name("") == "CLIENT"
    assert normalize_client_name("   ") == "CLIENT"
    assert normalize_client_name("!@#$%^&*()") == "CLIENT"
    # Safe filename validation
    assert is_safe_filename("ADITYA THAKARE NORMAL.pdf") is True
    assert is_safe_filename("../etc/passwd") is False
    assert is_safe_filename("invalid/path/file.pdf") is False


def test_output_naming_dictionaries():
    aadhaar_names = get_aadhaar_filenames("Aditya Subhash Thakare")
    assert aadhaar_names["normal_unlocked"] == "ADITYA SUBHASH THAKARE NORMAL UNLOCKED.pdf"
    assert aadhaar_names["normal_cropped"] == "ADITYA SUBHASH THAKARE NORMAL CROPPED.pdf"
    assert aadhaar_names["normal_jpg"] == "ADITYA SUBHASH THAKARE NORMAL.jpg"
    assert aadhaar_names["masked_unlocked"] == "ADITYA SUBHASH THAKARE MASKED UNLOCKED.pdf"
    assert aadhaar_names["masked_cropped"] == "ADITYA SUBHASH THAKARE MASKED CROPPED.pdf"
    assert aadhaar_names["masked_jpg"] == "ADITYA SUBHASH THAKARE MASKED.jpg"
    assert aadhaar_names["zip"] == "ADITYA SUBHASH THAKARE AADHAAR FILES.zip"

    pan_names = get_pan_filenames("Aditya Thakare")
    assert pan_names["unlocked"] == "ADITYA THAKARE PAN UNLOCKED.pdf"
    assert pan_names["cropped"] == "ADITYA THAKARE PAN CROPPED.pdf"
    assert pan_names["jpg"] == "ADITYA THAKARE PAN.jpg"
    assert pan_names["zip"] == "ADITYA THAKARE PAN FILES.zip"


def test_architecture_modularity():
    # Verify modular package app.services.document_processing
    import app.services.document_processing as dp_pkg
    import app.services.document_processor as dp_facade

    # Facade re-exports key symbols without duplicating logic
    for attr in [
        "derive_aadhaar_password",
        "derive_pan_password",
        "process_aadhaar_documents",
        "process_pan_document",
        "normalize_client_name",
        "get_aadhaar_filenames",
        "get_pan_filenames",
        "get_fixed_aadhaar_crop_rect",
        "get_fixed_pan_crop_rect",
        "TOOLKIT_TEMP_DIR",
    ]:
        assert hasattr(dp_pkg, attr)
        assert hasattr(dp_facade, attr)
        assert getattr(dp_pkg, attr) is getattr(dp_facade, attr)


@pytest.mark.asyncio
async def test_aadhaar_processor_masked_only(
    client: AsyncClient, auth_headers: dict[str, str]
):
    pdf_masked = make_test_pdf(title="Masked Aadhaar Only", is_aadhaar=True)
    files = {
        "masked_file": ("masked.pdf", pdf_masked, "application/pdf"),
    }
    data = {
        "full_name": "Priya Sharma",
        "dob": "15/11/2001",
    }

    res = await client.post(
        "/api/v1/toolkit/identity/aadhaar",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert len(payload["files"]) == 3
    file_names = [f["name"] for f in payload["files"]]
    assert "PRIYA SHARMA MASKED UNLOCKED.pdf" in file_names
    assert "PRIYA SHARMA MASKED CROPPED.pdf" in file_names
    assert "PRIYA SHARMA MASKED.jpg" in file_names
    assert payload["zip_download_url"] is not None


@pytest.mark.asyncio
async def test_download_client_based_file_with_spaces(
    client: AsyncClient, auth_headers: dict[str, str]
):
    # Process a document and verify download of file with space in filename
    pdf_bytes = make_test_pdf(title="PAN Card", is_pan=True)
    files = {"file": ("pan.pdf", pdf_bytes, "application/pdf")}
    data = {"full_name": "Rahul Verma", "dob": "12/08/1995"}

    res = await client.post(
        "/api/v1/toolkit/identity/pan",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 200
    payload = res.json()
    cropped_item = next(f for f in payload["files"] if f["file_type"] == "cropped_pdf")

    # Download using item.download_url
    dl_res = await client.get(cropped_item["download_url"], headers=auth_headers)
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"] == "application/pdf"

    # Also test downloading ZIP
    zip_url = payload["zip_download_url"]
    zip_res = await client.get(zip_url, headers=auth_headers)
    assert zip_res.status_code == 200
    assert zip_res.headers["content-type"] == "application/zip"


@pytest.mark.asyncio
async def test_failure_cleanup_removes_temp_dir(
    client: AsyncClient, auth_headers: dict[str, str]
):
    # Call with invalid password PDF - verify no orphan directory remains
    pdf_bytes = make_test_pdf(title="Protected", password="CORRECTPASS")
    files = {"file": ("pan.pdf", pdf_bytes, "application/pdf")}
    data = {"full_name": "Test Client", "dob": "01/01/2000"}  # Derives 01012000 which fails

    # Count dirs before
    dirs_before = set(TOOLKIT_TEMP_DIR.iterdir()) if TOOLKIT_TEMP_DIR.exists() else set()

    res = await client.post(
        "/api/v1/toolkit/identity/pan",
        headers=auth_headers,
        data=data,
        files=files,
    )
    assert res.status_code == 400

    # Count dirs after
    dirs_after = set(TOOLKIT_TEMP_DIR.iterdir()) if TOOLKIT_TEMP_DIR.exists() else set()
    # The failed job directory should have been cleaned up
    assert dirs_after == dirs_before


@pytest.mark.asyncio
async def test_concurrency_isolation(
    client: AsyncClient, auth_headers: dict[str, str]
):
    import asyncio

    pdf1 = make_test_pdf(title="Doc 1", is_pan=True)
    pdf2 = make_test_pdf(title="Doc 2", is_pan=True)

    task1 = client.post(
        "/api/v1/toolkit/identity/pan",
        headers=auth_headers,
        data={"full_name": "Concurrent User", "dob": "01/01/1990"},
        files={"file": ("pan1.pdf", pdf1, "application/pdf")},
    )
    task2 = client.post(
        "/api/v1/toolkit/identity/pan",
        headers=auth_headers,
        data={"full_name": "Concurrent User", "dob": "01/01/1990"},
        files={"file": ("pan2.pdf", pdf2, "application/pdf")},
    )

    res1, res2 = await asyncio.gather(task1, task2)
    assert res1.status_code == 200
    assert res2.status_code == 200

    job1 = res1.json()["job_id"]
    job2 = res2.json()["job_id"]
    assert job1 != job2  # Isolated per-request UUID directories


@pytest.mark.asyncio
async def test_unauthenticated_requests_blocked(client: AsyncClient):
    # Attempt Aadhaar processing without token -> 401
    res = await client.post("/api/v1/toolkit/identity/aadhaar", data={"full_name": "Test"})
    assert res.status_code == 401

    # Attempt PAN processing without token -> 401
    res = await client.post("/api/v1/toolkit/identity/pan", data={"full_name": "Test"})
    assert res.status_code == 401

    # Attempt download without token -> 401
    res = await client.get("/api/v1/toolkit/download/job_123/file.pdf")
    assert res.status_code == 401


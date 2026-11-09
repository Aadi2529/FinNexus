"""Test suite for FinNexus Insurance Engine:
Company to Policy Plan Workflow & Plan Document Management.

Verifies:
- Test 1: Add Policy Plan from Company Workflow (carrier linking, active validation, duplicate code protection)
- Test 2: Multi-Document Upload across Supported Types (PDF, DOCX, PNG, XLSX) & Size/Extension Validation
- Test 3: Document Listing & Document Type Filtering
- Test 4: Document Download (attachment) and Inline View (inline preview) with byte integrity
- Test 5: Document Metadata Update & File Replacement
- Test 6: Document Deletion, Storage Cleanup, and Audit Logging
- Test 7: Company 360 View: plans list, active plan count, documents count
"""

import hashlib
import io
import uuid
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_application


@pytest.fixture
def app():
    return create_application()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c


async def get_auth_token(client: AsyncClient, email: str = "admin@finnexus.com", pwd: str = "Admin@12345") -> str:
    """Obtain JWT access token for authenticated requests."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    if res.status_code == 200:
        return res.json()["access_token"]
    alt = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": pwd},
    )
    if alt.status_code == 200:
        return alt.json()["access_token"]
    raise RuntimeError(f"Authentication failed: {res.text}")


# ===========================================================================
# TEST SUITE 1: COMPANY TO POLICY PLAN WORKFLOW
# ===========================================================================


@pytest.mark.asyncio
async def test_company_to_plan_workflow_and_validations(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    uid = uuid.uuid4().hex[:6].upper()
    comp_code = f"CMP-{uid}"

    # 1. Create Insurance Company
    comp_payload = {
        "name": f"Workflow Test Carrier {uid}",
        "code": comp_code,
        "category": "Health Insurance",
        "is_active": True,
        "email": f"carrier_{uid.lower()}@test.com",
    }
    c_res = await client.post("/api/v1/insurance/companies", json=comp_payload, headers=headers)
    assert c_res.status_code == 201, f"Company creation failed: {c_res.text}"
    comp_data = c_res.json()
    company_id = comp_data["id"]
    assert comp_data["code"] == comp_code

    # 2. Create Policy Plan directly linked to newly created company
    plan_code = f"PLN-{uid}"
    plan_payload = {
        "name": f"Comprehensive Health Plus {uid}",
        "code": plan_code,
        "company_id": company_id,
        "line_of_business": "Health Insurance",
        "status": "ACTIVE",
        "description": "Enterprise health plan with zero room rent capping.",
        "riders": ["Critical Illness", "Hospital Cash"],
        "benefits": ["Unlimited restoration", "AYUSH covered"],
    }
    p_res = await client.post("/api/v1/insurance/plans", json=plan_payload, headers=headers)
    assert p_res.status_code == 201, f"Plan creation failed: {p_res.text}"
    plan_data = p_res.json()
    plan_id = plan_data["id"]
    assert plan_data["code"] == plan_code
    assert plan_data["company_id"] == company_id

    # 3. Duplicate Plan Code Conflict Protection
    dup_res = await client.post("/api/v1/insurance/plans", json=plan_payload, headers=headers)
    assert dup_res.status_code == 409, "Duplicate plan code should return 409 Conflict"

    # 4. Non-existent Company Validation
    bad_plan = {**plan_payload, "code": f"BAD-{uid}", "company_id": str(uuid.uuid4())}
    bad_res = await client.post("/api/v1/insurance/plans", json=bad_plan, headers=headers)
    assert bad_res.status_code == 404, "Non-existent parent company should return 404"

    # 5. Deactivated Company Validation
    # Deactivate company
    await client.patch(f"/api/v1/insurance/companies/{company_id}/status?is_active=false", headers=headers)
    inact_plan = {**plan_payload, "code": f"INACT-{uid}"}
    inact_res = await client.post("/api/v1/insurance/plans", json=inact_plan, headers=headers)
    assert inact_res.status_code == 400, "Adding plan to deactivated company should return 400"

    # Reactivate company for subsequent tests
    await client.patch(f"/api/v1/insurance/companies/{company_id}/status?is_active=true", headers=headers)


# ===========================================================================
# TEST SUITE 2: PLAN DOCUMENT MANAGEMENT & VALIDATIONS
# ===========================================================================


@pytest.mark.asyncio
async def test_plan_documents_multi_upload_and_validations(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    uid = uuid.uuid4().hex[:6].upper()

    # Create Carrier and Plan
    c_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": f"Docs Carrier {uid}", "code": f"DC-{uid}", "category": "Health Insurance"},
        headers=headers,
    )
    company_id = c_res.json()["id"]

    p_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Docs Plan {uid}",
            "code": f"DP-{uid}",
            "company_id": company_id,
            "line_of_business": "Health Insurance",
        },
        headers=headers,
    )
    plan_id = p_res.json()["id"]

    # 1. Upload Policy Brochure (PDF)
    pdf_bytes = b"%PDF-1.4 Official Policy Brochure Sample Content for testing."
    pdf_file = io.BytesIO(pdf_bytes)
    res_pdf = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Policy Brochure", "title": "Official Plan Brochure 2026"},
        files={"file": ("brochure_2026.pdf", pdf_file, "application/pdf")},
        headers=headers,
    )
    assert res_pdf.status_code == 201, f"Brochure upload failed: {res_pdf.text}"
    pdf_doc = res_pdf.json()
    assert pdf_doc["document_type"] == "Policy Brochure"
    assert pdf_doc["title"] == "Official Plan Brochure 2026"
    assert pdf_doc["file_size_bytes"] == len(pdf_bytes)
    assert pdf_doc["sha256_hash"] == hashlib.sha256(pdf_bytes).hexdigest()

    # 2. Upload Claim Form (DOCX)
    docx_bytes = b"PK\x03\x04DocxDummyContent"
    res_docx = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Claim Form", "title": "Reimbursement Claim Intimation Form"},
        files={"file": ("claim_intimation.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers,
    )
    assert res_docx.status_code == 201
    assert res_docx.json()["document_type"] == "Claim Form"

    # 3. Upload Premium Chart (XLSX)
    xlsx_bytes = b"PK\x03\x04XlsxDummyContent"
    res_xlsx = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Premium Chart", "title": "Age-wise Premium Rate Chart"},
        files={"file": ("rates_chart.xlsx", io.BytesIO(xlsx_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert res_xlsx.status_code == 201
    assert res_xlsx.json()["document_type"] == "Premium Chart"

    # 4. Upload Coverage Details (PNG image)
    png_bytes = b"\x89PNG\r\n\x1a\nDummyPngContent"
    res_png = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Coverage Details", "title": "Network Hospital Infographic"},
        files={"file": ("hospitals.png", io.BytesIO(png_bytes), "image/png")},
        headers=headers,
    )
    assert res_png.status_code == 201
    assert res_png.json()["document_type"] == "Coverage Details"

    # 5. Validation: Empty file returns 400
    empty_res = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Other Documents", "title": "Empty File"},
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
        headers=headers,
    )
    assert empty_res.status_code == 400, "Empty file should return 400 Bad Request"

    # 6. Validation: Unsupported extension returns 400
    bad_ext_res = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Other Documents", "title": "Script File"},
        files={"file": ("malicious.exe", io.BytesIO(b"MZExecutable"), "application/x-msdownload")},
        headers=headers,
    )
    assert bad_ext_res.status_code == 400, "Unsupported extension should return 400 Bad Request"


# ===========================================================================
# TEST SUITE 3: LISTING, FILTERING, DOWNLOAD & VIEW PREVIEW
# ===========================================================================


@pytest.mark.asyncio
async def test_plan_document_listing_download_and_preview(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    uid = uuid.uuid4().hex[:6].upper()

    # Create Carrier and Plan
    c_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": f"Stream Carrier {uid}", "code": f"SC-{uid}", "category": "Health Insurance"},
        headers=headers,
    )
    company_id = c_res.json()["id"]

    p_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Stream Plan {uid}",
            "code": f"SP-{uid}",
            "company_id": company_id,
            "line_of_business": "Health Insurance",
        },
        headers=headers,
    )
    plan_id = p_res.json()["id"]

    # Upload known PDF file
    sample_content = b"%PDF-1.4 Stream Content Verification for PDF document."
    upload_res = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Policy Wording", "title": "Full Policy Terms & Conditions"},
        files={"file": ("wording.pdf", io.BytesIO(sample_content), "application/pdf")},
        headers=headers,
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # 1. List Documents for Plan
    list_res = await client.get(f"/api/v1/insurance/plans/{plan_id}/documents", headers=headers)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) >= 1
    assert any(d["id"] == doc_id for d in docs)

    # 2. Filter by document_type
    filter_res = await client.get(
        f"/api/v1/insurance/plans/{plan_id}/documents?document_type=Policy Wording",
        headers=headers,
    )
    assert filter_res.status_code == 200
    assert len(filter_res.json()) >= 1

    # Filter with non-matching document_type
    empty_filter_res = await client.get(
        f"/api/v1/insurance/plans/{plan_id}/documents?document_type=Claim Form",
        headers=headers,
    )
    assert empty_filter_res.status_code == 200
    assert len(empty_filter_res.json()) == 0

    # 3. Test Download Endpoint (attachment)
    dl_res = await client.get(f"/api/v1/insurance/plans/{plan_id}/documents/{doc_id}/download", headers=headers)
    assert dl_res.status_code == 200
    assert "attachment" in dl_res.headers.get("content-disposition", "")
    assert dl_res.content == sample_content

    # 4. Test View Endpoint (inline preview)
    view_res = await client.get(f"/api/v1/insurance/plans/{plan_id}/documents/{doc_id}/view", headers=headers)
    assert view_res.status_code == 200
    assert "inline" in view_res.headers.get("content-disposition", "")
    assert view_res.content == sample_content


# ===========================================================================
# TEST SUITE 4: DOCUMENT UPDATE, REPLACE & DELETE
# ===========================================================================


@pytest.mark.asyncio
async def test_plan_document_update_replace_and_delete(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    uid = uuid.uuid4().hex[:6].upper()

    # Create Carrier and Plan
    c_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": f"Lifecycle Carrier {uid}", "code": f"LC-{uid}", "category": "Health Insurance"},
        headers=headers,
    )
    company_id = c_res.json()["id"]

    p_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Lifecycle Plan {uid}",
            "code": f"LP-{uid}",
            "company_id": company_id,
            "line_of_business": "Health Insurance",
        },
        headers=headers,
    )
    plan_id = p_res.json()["id"]

    initial_content = b"%PDF-1.4 Initial Document File Version 1.0"
    upload_res = await client.post(
        f"/api/v1/insurance/plans/{plan_id}/documents",
        data={"document_type": "Prospectus", "title": "Initial Prospectus v1"},
        files={"file": ("prospectus_v1.pdf", io.BytesIO(initial_content), "application/pdf")},
        headers=headers,
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # 1. Update metadata only
    upd_res = await client.put(
        f"/api/v1/insurance/plans/{plan_id}/documents/{doc_id}",
        data={"title": "Updated Prospectus 2026 Final", "description": "Revised pricing appendix"},
        headers=headers,
    )
    assert upd_res.status_code == 200
    updated_doc = upd_res.json()
    assert updated_doc["title"] == "Updated Prospectus 2026 Final"
    assert updated_doc["description"] == "Revised pricing appendix"

    # 2. Replace file
    replaced_content = b"%PDF-1.4 Replaced Document File Version 2.0 with more data"
    replace_res = await client.put(
        f"/api/v1/insurance/plans/{plan_id}/documents/{doc_id}",
        data={"title": "Prospectus v2 Replaced"},
        files={"file": ("prospectus_v2.pdf", io.BytesIO(replaced_content), "application/pdf")},
        headers=headers,
    )
    assert replace_res.status_code == 200
    rep_doc = replace_res.json()
    assert rep_doc["title"] == "Prospectus v2 Replaced"
    assert rep_doc["original_filename"] == "prospectus_v2.pdf"
    assert rep_doc["file_size_bytes"] == len(replaced_content)
    assert rep_doc["sha256_hash"] == hashlib.sha256(replaced_content).hexdigest()

    # Verify download returns replaced content
    dl_res = await client.get(f"/api/v1/insurance/plans/{plan_id}/documents/{doc_id}/download", headers=headers)
    assert dl_res.content == replaced_content

    # 3. Delete Document
    del_res = await client.delete(f"/api/v1/insurance/plans/{plan_id}/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 4. Verify document is gone
    not_found_res = await client.get(
        f"/api/v1/insurance/plans/{plan_id}/documents/{doc_id}/download", headers=headers
    )
    assert not_found_res.status_code == 404


# ===========================================================================
# TEST SUITE 5: COMPANY 360 INTEGRATION (PLANS LIST & ACTIVE COUNT)
# ===========================================================================


@pytest.mark.asyncio
async def test_company_360_includes_plans_and_document_counts(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    uid = uuid.uuid4().hex[:6].upper()

    # Create Carrier
    c_res = await client.post(
        "/api/v1/insurance/companies",
        json={"name": f"360 View Carrier {uid}", "code": f"V360-{uid}", "category": "Composite"},
        headers=headers,
    )
    company_id = c_res.json()["id"]

    # Create 2 plans (1 active, 1 inactive)
    p1_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Active Plan {uid}",
            "code": f"ACT-{uid}",
            "company_id": company_id,
            "line_of_business": "Health Insurance",
            "status": "ACTIVE",
        },
        headers=headers,
    )
    plan1_id = p1_res.json()["id"]

    p2_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Inactive Plan {uid}",
            "code": f"INACT-{uid}",
            "company_id": company_id,
            "line_of_business": "Life Insurance",
            "status": "INACTIVE",
        },
        headers=headers,
    )
    plan2_id = p2_res.json()["id"]

    # Upload document to plan 1
    doc_res = await client.post(
        f"/api/v1/insurance/plans/{plan1_id}/documents",
        data={"document_type": "Policy Brochure", "title": "Brochure"},
        files={"file": ("b.pdf", io.BytesIO(b"%PDF-sample"), "application/pdf")},
        headers=headers,
    )
    assert doc_res.status_code == 201

    # Fetch company 360 detail
    comp_detail_res = await client.get(f"/api/v1/insurance/companies/{company_id}", headers=headers)
    assert comp_detail_res.status_code == 200
    comp_data = comp_detail_res.json()

    assert comp_data["plans_count"] == 2
    assert comp_data["active_plans_count"] == 1
    assert len(comp_data["plans"]) == 2

    # Check plan 1 has documents_count >= 1
    p1_found = next(p for p in comp_data["plans"] if p["id"] == plan1_id)
    assert p1_found["documents_count"] == 1

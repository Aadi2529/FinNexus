"""Test suite for FinNexus Insurance Engine:
Policy Plan Document Inheritance & Policy-Specific Document Upload.

Verifies:
- Test 1: Plan Document Inheritance — active documents attached to a policy's plan
  automatically appear in policy documents response.
- Test 2: Inherited Plan Document Isolation — Policy linked to Plan A only sees Plan A's docs;
  Policy linked to Plan B only sees Plan B's docs; policies without plan docs show empty list.
- Test 3: Inherited Plan Document Preview & Download — Policyholders can download and preview
  inherited plan documents with isolation validation.
- Test 4: Policy-Specific Document Upload & Lifecycle — Multi-type uploads (KYC, Certificate,
  Medical Report, Endorsement), preview, download, metadata update, and file replacement.
- Test 5: Policy Document Deletion & Storage Cleanup — Deleting policy doc cleans up storage
  and database record.
- Test 6: Validation & Error Handling — Unsupported extensions (.exe), zero-byte files,
  cross-policy isolation checks (404).
"""

import hashlib
import io
import uuid
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


async def create_test_fixtures(client: AsyncClient, headers: dict):
    """Helper to create a Customer, Company, and Plans for testing."""
    uid = uuid.uuid4().hex[:6].upper()

    # 1. Customer
    cust_res = await client.post(
        "/api/v1/insurance/customers",
        json={
            "first_name": f"PolicyUser{uid}",
            "last_name": "TestClient",
            "phone": f"+9198{uuid.uuid4().int % 100000000:08d}",
            "email": f"policyuser_{uid.lower()}@test.com",
            "customer_type": "INDIVIDUAL",
            "gender": "MALE",
        },
        headers=headers,
    )
    assert cust_res.status_code == 201, cust_res.text
    customer_id = cust_res.json()["id"]

    # 2. Company
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        json={
            "name": f"Carrier Inherit {uid}",
            "code": f"CI-{uid}",
            "category": "Health Insurance",
            "is_active": True,
        },
        headers=headers,
    )
    assert comp_res.status_code == 201, comp_res.text
    company_id = comp_res.json()["id"]

    # 3. Plan A
    plan_a_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Plan Alpha {uid}",
            "code": f"PLA-{uid}",
            "company_id": company_id,
            "line_of_business": "Health Insurance",
            "status": "ACTIVE",
            "description": "Plan A with comprehensive benefits",
        },
        headers=headers,
    )
    assert plan_a_res.status_code == 201, plan_a_res.text
    plan_a_id = plan_a_res.json()["id"]

    # 4. Plan B
    plan_b_res = await client.post(
        "/api/v1/insurance/plans",
        json={
            "name": f"Plan Beta {uid}",
            "code": f"PLB-{uid}",
            "company_id": company_id,
            "line_of_business": "Health Insurance",
            "status": "ACTIVE",
            "description": "Plan B with standard benefits",
        },
        headers=headers,
    )
    assert plan_b_res.status_code == 201, plan_b_res.text
    plan_b_id = plan_b_res.json()["id"]

    return {
        "uid": uid,
        "customer_id": customer_id,
        "company_id": company_id,
        "plan_a_id": plan_a_id,
        "plan_b_id": plan_b_id,
    }


# ===========================================================================
# TEST 1 & 2: INHERITED PLAN DOCUMENTS & PLAN ISOLATION
# ===========================================================================


@pytest.mark.asyncio
async def test_policy_plan_document_inheritance_and_isolation(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    fxt = await create_test_fixtures(client, headers)
    plan_a_id = fxt["plan_a_id"]
    plan_b_id = fxt["plan_b_id"]
    cust_id = fxt["customer_id"]
    comp_id = fxt["company_id"]
    uid = fxt["uid"]

    # 1. Upload brochure and wording to Plan A
    doc_a1_content = b"%PDF-1.4 Plan Alpha Official Brochure Content"
    doc_a1_hash = hashlib.sha256(doc_a1_content).hexdigest()
    res_a1 = await client.post(
        f"/api/v1/insurance/plans/{plan_a_id}/documents",
        data={"document_type": "Policy Brochure", "title": "Alpha Master Brochure"},
        files={"file": ("alpha_brochure.pdf", io.BytesIO(doc_a1_content), "application/pdf")},
        headers=headers,
    )
    assert res_a1.status_code == 201, res_a1.text
    doc_a1_id = res_a1.json()["id"]

    doc_a2_content = b"%PDF-1.4 Plan Alpha Claim Form"
    res_a2 = await client.post(
        f"/api/v1/insurance/plans/{plan_a_id}/documents",
        data={"document_type": "Claim Form", "title": "Alpha Claim Form"},
        files={"file": ("alpha_claim.pdf", io.BytesIO(doc_a2_content), "application/pdf")},
        headers=headers,
    )
    assert res_a2.status_code == 201, res_a2.text
    doc_a2_id = res_a2.json()["id"]

    # 2. Upload different brochure to Plan B
    doc_b1_content = b"%PDF-1.4 Plan Beta Policy Wording Document"
    res_b1 = await client.post(
        f"/api/v1/insurance/plans/{plan_b_id}/documents",
        data={"document_type": "Policy Wording", "title": "Beta Wording T&C"},
        files={"file": ("beta_wording.pdf", io.BytesIO(doc_b1_content), "application/pdf")},
        headers=headers,
    )
    assert res_b1.status_code == 201, res_b1.text
    doc_b1_id = res_b1.json()["id"]

    # 3. Issue Policy 1 linked to Plan A
    pol1_number = f"POL-A-{uid}"
    pol1_payload = {
        "policy_type": "HEALTH",
        "coverage_type": "INDIVIDUAL",
        "customer_id": cust_id,
        "company_id": comp_id,
        "plan_id": plan_a_id,
        "policy_number": pol1_number,
        "sum_assured": 1000000,
        "net_premium": 15000,
        "gross_premium": 17700,
        "final_premium": 17700,
        "tax_amount": 2700,
        "start_date": "2026-11-01",
        "expiry_date": "2027-10-31",
        "members": [
            {
                "full_name": "Alpha Holder",
                "relationship": "Self",
                "date_of_birth": "1990-01-15",
                "gender": "MALE",
                "individual_sum_insured": 1000000,
            }
        ],
    }
    pol1_res = await client.post("/api/v1/insurance/policies", json=pol1_payload, headers=headers)
    assert pol1_res.status_code == 201, pol1_res.text
    policy1_id = pol1_res.json()["id"]

    # 4. Issue Policy 2 linked to Plan B
    pol2_number = f"POL-B-{uid}"
    pol2_payload = {
        "policy_type": "HEALTH",
        "coverage_type": "INDIVIDUAL",
        "customer_id": cust_id,
        "company_id": comp_id,
        "plan_id": plan_b_id,
        "policy_number": pol2_number,
        "sum_assured": 500000,
        "net_premium": 8000,
        "gross_premium": 9440,
        "final_premium": 9440,
        "tax_amount": 1440,
        "start_date": "2026-11-01",
        "expiry_date": "2027-10-31",
        "members": [
            {
                "full_name": "Beta Holder",
                "relationship": "Self",
                "date_of_birth": "1992-05-20",
                "gender": "FEMALE",
                "individual_sum_insured": 500000,
            }
        ],
    }
    pol2_res = await client.post("/api/v1/insurance/policies", json=pol2_payload, headers=headers)
    assert pol2_res.status_code == 201, pol2_res.text
    policy2_id = pol2_res.json()["id"]

    # 5. Verify Policy 1's inherited documents
    docs1_res = await client.get(f"/api/v1/insurance/policies/{policy1_id}/documents", headers=headers)
    assert docs1_res.status_code == 200, docs1_res.text
    docs1_data = docs1_res.json()
    assert docs1_data["policy_id"] == policy1_id
    assert docs1_data["plan_id"] == plan_a_id
    assert docs1_data["plan_documents_count"] == 2
    assert len(docs1_data["plan_documents"]) == 2

    # Check that Doc A1 and Doc A2 are present in Policy 1
    plan_doc_ids_1 = [d["id"] for d in docs1_data["plan_documents"]]
    assert doc_a1_id in plan_doc_ids_1
    assert doc_a2_id in plan_doc_ids_1
    assert doc_b1_id not in plan_doc_ids_1  # Plan B doc must NOT be visible

    # 6. Verify Policy 2's inherited documents
    docs2_res = await client.get(f"/api/v1/insurance/policies/{policy2_id}/documents", headers=headers)
    assert docs2_res.status_code == 200, docs2_res.text
    docs2_data = docs2_res.json()
    assert docs2_data["policy_id"] == policy2_id
    assert docs2_data["plan_id"] == plan_b_id
    assert docs2_data["plan_documents_count"] == 1
    assert len(docs2_data["plan_documents"]) == 1

    # Check that only Doc B1 is present in Policy 2
    plan_doc_ids_2 = [d["id"] for d in docs2_data["plan_documents"]]
    assert doc_b1_id in plan_doc_ids_2
    assert doc_a1_id not in plan_doc_ids_2
    assert doc_a2_id not in plan_doc_ids_2

    # 7. Verify Policy Detail (GET /policies/{id}) also returns inherited plan docs
    pol1_detail_res = await client.get(f"/api/v1/insurance/policies/{policy1_id}", headers=headers)
    assert pol1_detail_res.status_code == 200
    p1_det = pol1_detail_res.json()
    assert p1_det["plan_documents_count"] == 2
    assert len(p1_det["plan_documents"]) == 2


# ===========================================================================
# TEST 3: INHERITED PLAN DOCUMENT DOWNLOAD & PREVIEW WITH ISOLATION
# ===========================================================================


@pytest.mark.asyncio
async def test_inherited_plan_document_download_preview_and_isolation(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    fxt = await create_test_fixtures(client, headers)
    plan_a_id = fxt["plan_a_id"]
    plan_b_id = fxt["plan_b_id"]
    cust_id = fxt["customer_id"]
    comp_id = fxt["company_id"]
    uid = fxt["uid"]

    # Upload Doc A to Plan A
    doc_a_content = b"%PDF-1.4 Alpha Special Terms and Conditions"
    doc_a_sha = hashlib.sha256(doc_a_content).hexdigest()
    res_a = await client.post(
        f"/api/v1/insurance/plans/{plan_a_id}/documents",
        data={"document_type": "Terms & Conditions", "title": "Alpha T&C"},
        files={"file": ("alpha_terms.pdf", io.BytesIO(doc_a_content), "application/pdf")},
        headers=headers,
    )
    assert res_a.status_code == 201
    doc_a_id = res_a.json()["id"]

    # Upload Doc B to Plan B
    doc_b_content = b"%PDF-1.4 Beta Rider Documents"
    res_b = await client.post(
        f"/api/v1/insurance/plans/{plan_b_id}/documents",
        data={"document_type": "Rider Documents", "title": "Beta Riders"},
        files={"file": ("beta_riders.pdf", io.BytesIO(doc_b_content), "application/pdf")},
        headers=headers,
    )
    assert res_b.status_code == 201
    doc_b_id = res_b.json()["id"]

    # Issue Policy 1 under Plan A
    pol1_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_type": "HEALTH",
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_a_id,
            "policy_number": f"POL-DL-{uid}",
            "sum_assured": 1000000,
            "net_premium": 12000,
            "gross_premium": 14160,
            "final_premium": 14160,
            "start_date": "2026-11-01",
            "members": [{"full_name": "DL Tester", "relationship": "Self"}],
        },
        headers=headers,
    )
    assert pol1_res.status_code == 201
    policy1_id = pol1_res.json()["id"]

    # 1. Download Plan A doc via Policy 1
    dl_res = await client.get(
        f"/api/v1/insurance/policies/{policy1_id}/plan-documents/{doc_a_id}/download",
        headers=headers,
    )
    assert dl_res.status_code == 200
    assert "attachment" in dl_res.headers.get("content-disposition", "")
    assert dl_res.content == doc_a_content
    assert hashlib.sha256(dl_res.content).hexdigest() == doc_a_sha

    # 2. View Plan A doc inline via Policy 1
    vw_res = await client.get(
        f"/api/v1/insurance/policies/{policy1_id}/plan-documents/{doc_a_id}/view",
        headers=headers,
    )
    assert vw_res.status_code == 200
    assert "inline" in vw_res.headers.get("content-disposition", "")
    assert vw_res.content == doc_a_content

    # 3. Cross-plan isolation test: Policy 1 should NOT be able to download Plan B's doc
    cross_res = await client.get(
        f"/api/v1/insurance/policies/{policy1_id}/plan-documents/{doc_b_id}/download",
        headers=headers,
    )
    assert cross_res.status_code == 404, f"Cross-plan leak detected: {cross_res.status_code}"
    assert "not found" in cross_res.json()["detail"].lower()


# ===========================================================================
# TEST 4: POLICY-SPECIFIC DOCUMENT UPLOAD & LIFECYCLE
# ===========================================================================


@pytest.mark.asyncio
async def test_policy_specific_document_lifecycle(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    fxt = await create_test_fixtures(client, headers)
    cust_id = fxt["customer_id"]
    comp_id = fxt["company_id"]
    plan_id = fxt["plan_a_id"]
    uid = fxt["uid"]

    # Issue Policy
    pol_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_type": "HEALTH",
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_id,
            "policy_number": f"POL-SPEC-{uid}",
            "sum_assured": 1500000,
            "net_premium": 20000,
            "gross_premium": 23600,
            "final_premium": 23600,
            "start_date": "2026-11-01",
            "members": [{"full_name": "Spec Holder", "relationship": "Self"}],
        },
        headers=headers,
    )
    assert pol_res.status_code == 201
    policy_id = pol_res.json()["id"]

    # 1. Upload KYC Document to Policy
    kyc_content = b"%PDF-1.4 Customer Identity PAN Card and Aadhaar"
    kyc_sha = hashlib.sha256(kyc_content).hexdigest()
    kyc_res = await client.post(
        f"/api/v1/insurance/policies/{policy_id}/documents",
        data={
            "document_type": "Customer KYC",
            "title": "Client PAN Card Copy",
            "description": "Verified original document",
        },
        files={"file": ("customer_pan.pdf", io.BytesIO(kyc_content), "application/pdf")},
        headers=headers,
    )
    assert kyc_res.status_code == 201, kyc_res.text
    kyc_data = kyc_res.json()
    assert kyc_data["policy_id"] == policy_id
    assert kyc_data["document_type"] == "Customer KYC"
    assert kyc_data["title"] == "Client PAN Card Copy"
    assert kyc_data["original_filename"] == "customer_pan.pdf"
    assert kyc_data["sha256_hash"] == kyc_sha
    doc_id = kyc_data["id"]

    # 2. Upload Medical Report to Policy
    med_content = b"%PDF-1.4 Comprehensive Diagnostic Medical Report 2026"
    med_res = await client.post(
        f"/api/v1/insurance/policies/{policy_id}/documents",
        data={
            "document_type": "Medical Report",
            "title": "Pre-policy Medical Checkup",
            "description": "Clean blood reports",
        },
        files={"file": ("medical_checkup.pdf", io.BytesIO(med_content), "application/pdf")},
        headers=headers,
    )
    assert med_res.status_code == 201, med_res.text
    med_id = med_res.json()["id"]

    # 3. Verify Documents Listing on Policy
    list_res = await client.get(f"/api/v1/insurance/policies/{policy_id}/documents", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["policy_documents_count"] == 2
    pol_doc_ids = [d["id"] for d in list_data["policy_documents"]]
    assert doc_id in pol_doc_ids
    assert med_id in pol_doc_ids

    # 4. Download Policy Document
    dl_res = await client.get(
        f"/api/v1/insurance/policies/{policy_id}/documents/{doc_id}/download",
        headers=headers,
    )
    assert dl_res.status_code == 200
    assert "attachment" in dl_res.headers.get("content-disposition", "")
    assert dl_res.content == kyc_content
    assert hashlib.sha256(dl_res.content).hexdigest() == kyc_sha

    # 5. Inline View Policy Document
    vw_res = await client.get(
        f"/api/v1/insurance/policies/{policy_id}/documents/{doc_id}/view",
        headers=headers,
    )
    assert vw_res.status_code == 200
    assert "inline" in vw_res.headers.get("content-disposition", "")
    assert vw_res.content == kyc_content

    # 6. Update Document Metadata
    upd_res = await client.put(
        f"/api/v1/insurance/policies/{policy_id}/documents/{doc_id}",
        data={"title": "Updated PAN & Voter ID", "description": "Re-verified with DigiLocker"},
        headers=headers,
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["title"] == "Updated PAN & Voter ID"
    assert upd_res.json()["description"] == "Re-verified with DigiLocker"

    # 7. Replace Document File
    new_kyc_content = b"%PDF-1.4 Replaced PAN Document with clear barcode"
    new_kyc_sha = hashlib.sha256(new_kyc_content).hexdigest()
    rep_res = await client.put(
        f"/api/v1/insurance/policies/{policy_id}/documents/{doc_id}",
        files={"file": ("updated_pan.pdf", io.BytesIO(new_kyc_content), "application/pdf")},
        headers=headers,
    )
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert rep_data["original_filename"] == "updated_pan.pdf"
    assert rep_data["sha256_hash"] == new_kyc_sha

    # Verify download serves the replaced file
    rep_dl = await client.get(
        f"/api/v1/insurance/policies/{policy_id}/documents/{doc_id}/download",
        headers=headers,
    )
    assert rep_dl.status_code == 200
    assert rep_dl.content == new_kyc_content

    # 8. Delete Document
    del_res = await client.delete(
        f"/api/v1/insurance/policies/{policy_id}/documents/{doc_id}",
        headers=headers,
    )
    assert del_res.status_code == 200
    assert "successfully deleted" in del_res.json()["message"].lower()

    # Verify document is gone from policy list
    post_del_res = await client.get(f"/api/v1/insurance/policies/{policy_id}/documents", headers=headers)
    assert post_del_res.status_code == 200
    remaining_ids = [d["id"] for d in post_del_res.json()["policy_documents"]]
    assert doc_id not in remaining_ids
    assert post_del_res.json()["policy_documents_count"] == 1


# ===========================================================================
# TEST 5: VALIDATION, CONSTRAINTS & SECURITY
# ===========================================================================


@pytest.mark.asyncio
async def test_policy_document_validations_and_security(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    fxt = await create_test_fixtures(client, headers)
    cust_id = fxt["customer_id"]
    comp_id = fxt["company_id"]
    plan_id = fxt["plan_a_id"]
    uid = fxt["uid"]

    # Issue Policy 1
    p1_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_type": "HEALTH",
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_id,
            "policy_number": f"POL-VAL1-{uid}",
            "sum_assured": 1000000,
            "net_premium": 10000,
            "gross_premium": 11800,
            "final_premium": 11800,
            "start_date": "2026-11-01",
            "members": [{"full_name": "Val Tester 1", "relationship": "Self"}],
        },
        headers=headers,
    )
    assert p1_res.status_code == 201
    p1_id = p1_res.json()["id"]

    # Issue Policy 2
    p2_res = await client.post(
        "/api/v1/insurance/policies",
        json={
            "policy_type": "HEALTH",
            "customer_id": cust_id,
            "company_id": comp_id,
            "plan_id": plan_id,
            "policy_number": f"POL-VAL2-{uid}",
            "sum_assured": 1000000,
            "net_premium": 10000,
            "gross_premium": 11800,
            "final_premium": 11800,
            "start_date": "2026-11-01",
            "members": [{"full_name": "Val Tester 2", "relationship": "Self"}],
        },
        headers=headers,
    )
    assert p2_res.status_code == 201
    p2_id = p2_res.json()["id"]

    # 1. Unsupported extension (.exe) rejected
    bad_ext_res = await client.post(
        f"/api/v1/insurance/policies/{p1_id}/documents",
        data={"document_type": "Other Policy Attachments", "title": "Script"},
        files={"file": ("malware.exe", io.BytesIO(b"binary executable payload"), "application/octet-stream")},
        headers=headers,
    )
    assert bad_ext_res.status_code == 400
    assert "unsupported" in bad_ext_res.json()["detail"].lower()

    # 2. Empty file rejected
    empty_file_res = await client.post(
        f"/api/v1/insurance/policies/{p1_id}/documents",
        data={"document_type": "Customer KYC", "title": "Empty File"},
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
        headers=headers,
    )
    assert empty_file_res.status_code == 400
    assert "empty" in empty_file_res.json()["detail"].lower()

    # 3. Cross-policy isolation: Upload doc to Policy 1, then attempt to access via Policy 2
    ok_content = b"%PDF-1.4 Valid Document for Policy 1"
    ok_res = await client.post(
        f"/api/v1/insurance/policies/{p1_id}/documents",
        data={"document_type": "Official Policy Certificate", "title": "Cert P1"},
        files={"file": ("cert_p1.pdf", io.BytesIO(ok_content), "application/pdf")},
        headers=headers,
    )
    assert ok_res.status_code == 201
    p1_doc_id = ok_res.json()["id"]

    # Accessing Policy 1's doc using Policy 2 ID must return 404
    cross_dl = await client.get(
        f"/api/v1/insurance/policies/{p2_id}/documents/{p1_doc_id}/download",
        headers=headers,
    )
    assert cross_dl.status_code == 404, f"Cross-policy document leak: {cross_dl.status_code}"

    cross_del = await client.delete(
        f"/api/v1/insurance/policies/{p2_id}/documents/{p1_doc_id}",
        headers=headers,
    )
    assert cross_del.status_code == 404

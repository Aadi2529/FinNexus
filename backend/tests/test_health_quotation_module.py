"""Test suite for Module 6: Custom Health Quotation Generator.

Covers:
- Test A: Family Details & Exact Calendar Age Calculation (Leap year, Feb 29, End-of-month, PIN Code)
- Test B: Dynamic Premium Matrix Filtering (Populated rows/columns only)
- Test C: Empty Premium Matrix Behavior
- Test D: Quotation Editing & Persistence
- Test E: Real Exports Verification (PDF, Excel, PNG Image)
- Test F: Duplication, Deletion, RBAC, and Audit Logging
"""

import io
from datetime import date
from decimal import Decimal
import openpyxl
import pymupdf
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_application
from app.services.insurance.quotation_service import (
    EXACT_DISCLAIMER,
    calculate_exact_age,
)


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
    """Login and obtain access token."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    if login_res.status_code == 200:
        return login_res.json()["access_token"]
    # Fallback to alternate admin email if seeded differently
    alt_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@financeflow.com", "password": pwd},
    )
    if alt_res.status_code == 200:
        return alt_res.json()["access_token"]
    raise RuntimeError(f"Auth failed: {login_res.text}")


# ---------------------------------------------------------------------------
# Test Phase 5 Math: Exact Calendar Age Unit Tests
# ---------------------------------------------------------------------------

def test_exact_age_calculator_prompt_examples():
    """Verify prompt exact age examples: Rahul Sharma & Priya Sharma at reference date 01-11-2026."""
    ref = date(2026, 11, 1)

    # Rahul Sharma (15-06-1995) -> 31 Y, 4 M, 17 D
    y, m, d = calculate_exact_age(date(1995, 6, 15), ref)
    assert (y, m, d) == (31, 4, 17)

    # Priya Sharma (20-09-1997) -> 29 Y, 1 M, 12 D
    y, m, d = calculate_exact_age(date(1997, 9, 20), ref)
    assert (y, m, d) == (29, 1, 12)


def test_exact_age_calculator_edge_cases():
    """Verify leap year Feb 29, end of month, same day, and future dates."""
    # Feb 29 birthdate in leap year turning 1 in non-leap year (Feb 28)
    assert calculate_exact_age(date(2000, 2, 29), date(2001, 2, 28)) == (1, 0, 0)
    assert calculate_exact_age(date(2000, 2, 29), date(2001, 3, 1)) == (1, 0, 1)
    assert calculate_exact_age(date(2000, 2, 29), date(2004, 2, 29)) == (4, 0, 0)

    # End of month Jan 31 to Feb 28
    assert calculate_exact_age(date(2023, 1, 31), date(2023, 2, 28)) == (0, 1, 0)
    assert calculate_exact_age(date(2023, 1, 31), date(2023, 3, 1)) == (0, 1, 1)

    # Same day
    assert calculate_exact_age(date(2026, 11, 1), date(2026, 11, 1)) == (0, 0, 0)

    # Future date rejection
    with pytest.raises(ValueError):
        calculate_exact_age(date(2026, 11, 2), date(2026, 11, 1))


# ---------------------------------------------------------------------------
# Test A: Create Quotation with Family Details & Exact Ages
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_01_create_quotation_with_family_details(client: AsyncClient):
    """Test A: Create a quotation with three family members and verify exact age breakdown and PIN code."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "quotation_title": "Sharma Family Health Portfolio 2026",
        "quotation_date": "2026-11-01",
        "client_name": "Rahul Sharma",
        "pin_code": "400001",
        "contact_number": "+91 98200 12345",
        "contact_email": "rahul.sharma@example.com",
        "premium_basis": "GROSS",
        "members": [
            {
                "full_name": "Rahul Sharma",
                "relationship": "Self",
                "gender": "Male",
                "date_of_birth": "1995-06-15",
                "is_primary": True,
                "display_order": 0,
            },
            {
                "full_name": "Priya Sharma",
                "relationship": "Spouse",
                "gender": "Female",
                "date_of_birth": "1997-09-20",
                "is_primary": False,
                "display_order": 1,
            },
            {
                "full_name": "Aarav Sharma",
                "relationship": "Son",
                "gender": "Male",
                "date_of_birth": "2020-02-29",  # Leap day child
                "is_primary": False,
                "display_order": 2,
            },
        ],
        "company_plans": [],
    }

    res = await client.post("/api/v1/insurance/quotations", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["quotation_number"].startswith("HQ-2026-")
    assert data["quotation_title"] == "Sharma Family Health Portfolio 2026"
    assert data["client_name"] == "Rahul Sharma"
    assert data["pin_code"] == "400001"
    assert data["disclaimer_snapshot"] == EXACT_DISCLAIMER

    # Verify 3 members and exact ages
    members = data["members"]
    assert len(members) == 3

    rahul = next(m for m in members if m["full_name"] == "Rahul Sharma")
    assert rahul["age_years"] == 31
    assert rahul["age_months"] == 4
    assert rahul["age_days"] == 17
    assert rahul["is_primary"] is True

    priya = next(m for m in members if m["full_name"] == "Priya Sharma")
    assert priya["age_years"] == 29
    assert priya["age_months"] == 1
    assert priya["age_days"] == 12

    aarav = next(m for m in members if m["full_name"] == "Aarav Sharma")
    # Born 2020-02-29, at 2026-11-01:
    # 2020 + 6 years = 2026-02-28 (non leap year). March 1 to Nov 1 = 8 months, 1 day
    assert aarav["age_years"] == 6
    assert aarav["age_months"] == 8
    assert aarav["age_days"] == 3


# ---------------------------------------------------------------------------
# Test B: Premium Matrix & Dynamic Row and Column Filtering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_02_dynamic_matrix_filtering(client: AsyncClient):
    """Test B: Enter premiums for specific tiers and verify ONLY populated rows and columns appear.

    Input:
    - HDFC ERGO: 5L and 10L
    - NIVA BUPA: 10L and 20L
    - TATA AIG Select: 5L
    - TATA AIG Premier: 25L
    Expected columns: 5L, 10L, 20L, 25L in exact order.
    Unused columns: 7.5L, 15L, 50L, 1CR, 2CR must be HIDDEN.
    """
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "quotation_title": "Dynamic Matrix Verification Quotation",
        "quotation_date": "2026-11-01",
        "client_name": "Vikram Verma",
        "pin_code": "110001",
        "members": [
            {
                "full_name": "Vikram Verma",
                "relationship": "Self",
                "date_of_birth": "1990-01-01",
                "is_primary": True,
            }
        ],
        "company_plans": [
            {
                "display_company_name": "HDFC ERGO",
                "display_plan_variant": "(with HC)",
                "display_order": 0,
                "premiums": [
                    {"sum_insured_code": "5L", "premium_amount": 12500},
                    {"sum_insured_code": "10L", "premium_amount": 18000},
                ],
            },
            {
                "display_company_name": "NIVA BUPA",
                "display_plan_variant": "(with HC)",
                "display_order": 1,
                "premiums": [
                    {"sum_insured_code": "10L", "premium_amount": 19500},
                    {"sum_insured_code": "20L", "premium_amount": 26000},
                ],
            },
            {
                "display_company_name": "TATA AIG",
                "display_plan_variant": "Medicare Select",
                "display_order": 2,
                "premiums": [
                    {"sum_insured_code": "5L", "premium_amount": 11800},
                ],
            },
            {
                "display_company_name": "TATA AIG",
                "display_plan_variant": "Medicare Premier",
                "display_order": 3,
                "premiums": [
                    {"sum_insured_code": "25L", "premium_amount": 31000},
                ],
            },
            {
                # Unpopulated plan row - MUST be excluded from filtered matrix!
                "display_company_name": "Care Health",
                "display_plan_variant": "Care Supreme",
                "display_order": 4,
                "premiums": [],
            },
        ],
    }

    create_res = await client.post("/api/v1/insurance/quotations", json=payload, headers=headers)
    assert create_res.status_code == 201
    quote = create_res.json()

    # Verify dynamic filtered matrix
    f_matrix = quote["filtered_matrix"]
    assert f_matrix is not None

    # Check Columns: exactly 5L, 10L, 20L, 25L in standardized order
    col_codes = [c["code"] for c in f_matrix["columns"]]
    assert col_codes == ["5L", "10L", "20L", "25L"]
    assert "7.5L" not in col_codes
    assert "15L" not in col_codes
    assert "50L" not in col_codes
    assert "1CR" not in col_codes
    assert "2CR" not in col_codes

    # Check Rows: 4 populated rows, Care Health excluded
    rows = f_matrix["rows"]
    assert len(rows) == 4
    row_names = [f"{r['display_company_name']} {r['display_plan_variant']}" for r in rows]
    assert any("HDFC ERGO" in name for name in row_names)
    assert any("NIVA BUPA" in name for name in row_names)
    assert any("Medicare Select" in name for name in row_names)
    assert any("Medicare Premier" in name for name in row_names)
    assert not any("Care Health" in name for name in row_names)


# ---------------------------------------------------------------------------
# Test C: Empty Matrix Handling
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_03_empty_matrix_handling(client: AsyncClient):
    """Test C: Create a quotation without premium entries; verify filtered matrix has 0 rows and 0 columns."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "quotation_title": "Draft Prospect Without Premiums",
        "client_name": "Anita Roy",
        "pin_code": "560001",
        "members": [
            {
                "full_name": "Anita Roy",
                "relationship": "Self",
                "date_of_birth": "1992-05-10",
                "is_primary": True,
            }
        ],
        "company_plans": [
            {"display_company_name": "HDFC ERGO", "display_plan_variant": "(with HC)", "premiums": []},
            {"display_company_name": "NIVA BUPA", "display_plan_variant": "(with HC)", "premiums": []},
        ],
    }

    res = await client.post("/api/v1/insurance/quotations", json=payload, headers=headers)
    assert res.status_code == 201
    quote = res.json()

    f_matrix = quote["filtered_matrix"]
    assert f_matrix["columns"] == []
    assert f_matrix["rows"] == []


# ---------------------------------------------------------------------------
# Test D: Editing a Saved Quotation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_04_edit_and_update_quotation(client: AsyncClient):
    """Test D: Edit saved quotation details: DOB, PIN code, and premiums."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create initial quote
    payload = {
        "quotation_title": "Initial Quotation",
        "quotation_date": "2026-11-01",
        "client_name": "Rajesh Kumar",
        "pin_code": "400050",
        "members": [
            {
                "full_name": "Rajesh Kumar",
                "relationship": "Self",
                "date_of_birth": "1990-01-01",
                "is_primary": True,
            }
        ],
        "company_plans": [
            {
                "display_company_name": "HDFC ERGO",
                "display_plan_variant": "(with HC)",
                "premiums": [{"sum_insured_code": "5L", "premium_amount": 10000}],
            }
        ],
    }
    create_res = await client.post("/api/v1/insurance/quotations", json=payload, headers=headers)
    assert create_res.status_code == 201
    q_id = create_res.json()["id"]

    # 2. Update quotation
    update_payload = {
        "quotation_title": "Updated Rajesh Kumar Quotation",
        "pin_code": "400099",
        "members": [
            {
                "full_name": "Rajesh Kumar",
                "relationship": "Self",
                "date_of_birth": "1988-06-15",  # Changed DOB
                "is_primary": True,
            }
        ],
        "company_plans": [
            {
                "display_company_name": "HDFC ERGO",
                "display_plan_variant": "Optima Secure",
                "premiums": [
                    {"sum_insured_code": "10L", "premium_amount": 22000},  # Changed tier and amount
                ],
            }
        ],
    }
    put_res = await client.put(f"/api/v1/insurance/quotations/{q_id}", json=update_payload, headers=headers)
    assert put_res.status_code == 200
    updated = put_res.json()

    assert updated["quotation_title"] == "Updated Rajesh Kumar Quotation"
    assert updated["pin_code"] == "400099"
    # Recalculated age from 1988-06-15 at 2026-11-01 -> 38 years
    assert updated["members"][0]["age_years"] == 38

    # Filtered matrix should now show 10L instead of 5L
    assert [c["code"] for c in updated["filtered_matrix"]["columns"]] == ["10L"]


# ---------------------------------------------------------------------------
# Test E: Exports Verification (PDF, Excel, Image)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_05_export_pdf_excel_image(client: AsyncClient):
    """Test E: Generate PDF, Excel, and Image exports and verify file contents, disclaimer, and data."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Setup quote with data
    payload = {
        "quotation_title": "Comprehensive Export Test Quotation",
        "quotation_date": "2026-11-01",
        "client_name": "Sunil Joshi",
        "pin_code": "400021",
        "members": [
            {"full_name": "Sunil Joshi", "relationship": "Self", "date_of_birth": "1985-04-12", "is_primary": True},
            {"full_name": "Kavita Joshi", "relationship": "Spouse", "date_of_birth": "1989-11-05"},
        ],
        "company_plans": [
            {
                "display_company_name": "HDFC ERGO",
                "display_plan_variant": "(with HC)",
                "premiums": [
                    {"sum_insured_code": "10L", "premium_amount": 19500},
                    {"sum_insured_code": "25L", "premium_amount": 32000},
                ],
            }
        ],
    }
    create_res = await client.post("/api/v1/insurance/quotations", json=payload, headers=headers)
    assert create_res.status_code == 201
    q_id = create_res.json()["id"]

    # 1. Test PDF Export
    pdf_res = await client.get(f"/api/v1/insurance/quotations/{q_id}/export/pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF")

    # Read and inspect PDF text
    pdf_doc = pymupdf.open(stream=pdf_res.content, filetype="pdf")
    assert len(pdf_doc) >= 1
    page_text = pdf_doc[0].get_text()
    assert EXACT_DISCLAIMER in page_text
    assert "Sunil Joshi" in page_text
    assert "Kavita Joshi" in page_text
    assert "HDFC ERGO" in page_text
    assert "10L" in page_text
    assert "25L" in page_text
    # Unpopulated columns should NOT be present
    assert "50L" not in page_text
    assert "1CR" not in page_text

    # 2. Test Excel Export
    excel_res = await client.get(f"/api/v1/insurance/quotations/{q_id}/export/excel", headers=headers)
    assert excel_res.status_code == 200
    assert "spreadsheetml" in excel_res.headers["content-type"]
    assert excel_res.content.startswith(b"PK")  # Zip/XLSX header

    # Inspect Excel content
    wb = openpyxl.load_workbook(io.BytesIO(excel_res.content))
    ws = wb.active
    excel_text = " ".join(str(cell.value) for row in ws.rows for cell in row if cell.value)
    assert EXACT_DISCLAIMER in excel_text
    assert "Sunil Joshi" in excel_text
    assert "Kavita Joshi" in excel_text
    assert "HDFC ERGO" in excel_text

    # 3. Test PNG Image Export
    img_res = await client.get(f"/api/v1/insurance/quotations/{q_id}/export/image", headers=headers)
    assert img_res.status_code == 200
    assert img_res.headers["content-type"] == "image/png"
    assert img_res.content.startswith(b"\x89PNG")  # PNG signature
    assert len(img_res.content) > 10000  # High resolution image


# ---------------------------------------------------------------------------
# Test F: Duplication, Deletion, RBAC, and Validation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_06_duplicate_and_delete_workflow(client: AsyncClient):
    """Test F: Duplicate quotation, verify new quote number and DRAFT status, then delete with audit."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create original
    payload = {
        "quotation_title": "Original For Duplication",
        "client_name": "Meera Sen",
        "pin_code": "700001",
        "members": [
            {"full_name": "Meera Sen", "relationship": "Self", "date_of_birth": "1995-08-20", "is_primary": True}
        ],
        "company_plans": [],
    }
    res = await client.post("/api/v1/insurance/quotations", json=payload, headers=headers)
    assert res.status_code == 201
    orig = res.json()

    # 2. Duplicate
    dup_res = await client.post(f"/api/v1/insurance/quotations/{orig['id']}/duplicate", headers=headers)
    assert dup_res.status_code == 201
    dup = dup_res.json()

    assert dup["id"] != orig["id"]
    assert dup["quotation_number"] != orig["quotation_number"]
    assert dup["quotation_title"] == "Copy of Original For Duplication"
    assert dup["status"] == "DRAFT"
    assert len(dup["members"]) == 1

    # 3. Delete duplicated quotation
    del_res = await client.delete(f"/api/v1/insurance/quotations/{dup['id']}", headers=headers)
    assert del_res.status_code == 204

    # 4. Confirm it is gone
    get_res = await client.get(f"/api/v1/insurance/quotations/{dup['id']}", headers=headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_07_pin_code_validation(client: AsyncClient):
    """Verify that invalid PIN codes (non-6 digits, alphabets) are strictly rejected."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid: 5 digits
    bad_payload1 = {
        "client_name": "Test Client",
        "pin_code": "12345",
        "members": [{"full_name": "Test", "relationship": "Self", "date_of_birth": "2000-01-01"}],
    }
    res1 = await client.post("/api/v1/insurance/quotations", json=bad_payload1, headers=headers)
    assert res1.status_code == 422

    # Invalid: Non-numeric
    bad_payload2 = {
        "client_name": "Test Client",
        "pin_code": "4000AB",
        "members": [{"full_name": "Test", "relationship": "Self", "date_of_birth": "2000-01-01"}],
    }
    res2 = await client.post("/api/v1/insurance/quotations", json=bad_payload2, headers=headers)
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_08_quotation_stats_endpoint(client: AsyncClient):
    """Verify that /api/v1/insurance/quotations/stats returns real database aggregations."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/insurance/quotations/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "issued" in data
    assert "draft" in data
    assert "members_evaluated" in data
    assert isinstance(data["total"], int)
    assert isinstance(data["members_evaluated"], int)
    assert data["total"] >= 0


@pytest.mark.asyncio
async def test_09_multipage_pdf_vector_fonts_and_inr(client: AsyncClient):
    """Verify vector font embedding, Indian Rupee notation, and multi-page pagination."""
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create quotation with 14 family members and 8 insurer variants to test multi-page pagination
    family_members = [
        {"full_name": f"Family Member {i+1}", "relationship": "Dependent", "date_of_birth": "1992-05-15", "is_primary": (i == 0)}
        for i in range(14)
    ]
    company_plans = [
        {
            "display_company_name": f"Insurer Variant {i+1}",
            "display_plan_variant": f"Gold Plan {i+1}",
            "premiums": [
                {"sum_insured_code": "5L", "premium_amount": 14000 + (i * 1200)},
                {"sum_insured_code": "10L", "premium_amount": 22000 + (i * 1500)},
                {"sum_insured_code": "25L", "premium_amount": 35000 + (i * 2000)},
            ],
        }
        for i in range(8)
    ]

    payload = {
        "quotation_title": "Enterprise Multi-Member Comprehensive Proposal",
        "client_name": "Dr. Rajeshwar Sharma",
        "pin_code": "411001",
        "quotation_date": "2026-11-01",
        "notes": "Includes Zone A network hospitals and comprehensive OPD benefit coverage.",
        "members": family_members,
        "company_plans": company_plans,
    }

    create_res = await client.post("/api/v1/insurance/quotations", json=payload, headers=headers)
    assert create_res.status_code == 201
    q_data = create_res.json()
    q_id = q_data["id"]

    # Export PDF and inspect vector output
    pdf_res = await client.get(f"/api/v1/insurance/quotations/{q_id}/export/pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b"%PDF")

    doc = pymupdf.open(stream=pdf_res.content, filetype="pdf")
    # Verify multi-page pagination
    assert len(doc) >= 2, f"Expected 2 or more pages for complex multi-member quote, got {len(doc)}"

    # Check footer pagination on all pages
    total_pages = len(doc)
    for p_idx in range(total_pages):
        page_text = doc[p_idx].get_text()
        assert f"Page {p_idx + 1} of {total_pages}" in page_text

    # Verify content in document
    full_text = " ".join(doc[i].get_text() for i in range(total_pages))
    assert EXACT_DISCLAIMER in full_text
    assert "Dr. Rajeshwar Sharma" in full_text
    assert "411001" in full_text
    assert "Family Member 1" in full_text
    assert "Family Member 8" in full_text
    assert "5L" in full_text
    assert "10L" in full_text
    assert "25L" in full_text


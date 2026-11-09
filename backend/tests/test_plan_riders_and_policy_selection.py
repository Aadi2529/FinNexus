"""Test suite for FinNexus Insurance Engine:
Dynamic Policy Plan Riders & Benefits Management & Policy Rider Selection Workflow.

Verifies:
1. Plan Creation with multiple structured Riders & Coverage Benefits.
2. Direct Rider and Benefit Sub-endpoints (/plans/{id}/riders, /plans/{id}/benefits).
3. Lookup Data endpoint (/policies/lookup-data) includes riders and benefits on active plans.
4. Policy Issuance with selected riders from the plan.
5. Strict validation: rejection (400 Bad Request) if non-plan rider ID is passed.
6. Policy Detail (/policies/{id}) verifies permanent persistence of selected riders and plan benefits.
7. Historical snapshot rule: editing/updating plan riders does not silently change or break already-issued policies.
8. Policy Update (/policies/{id}) allows modifying selected riders within valid plan riders.
"""

import uuid
from decimal import Decimal
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


@pytest.mark.asyncio
async def test_plan_riders_and_policy_rider_selection_workflow(client: AsyncClient):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    uid = uuid.uuid4().hex[:6].upper()

    # 1. Create Carrier Company
    comp_code = f"CARRIER-{uid}"
    comp_res = await client.post(
        "/api/v1/insurance/companies",
        headers=headers,
        json={
            "name": f"Apex Health General Insurance {uid}",
            "code": comp_code,
            "category": "Health Insurance",
            "company_type": "Health Insurance",
            "supported_categories": ["Health Insurance"],
            "is_active": True,
        },
    )
    assert comp_res.status_code == 201, comp_res.text
    company_id = comp_res.json()["id"]

    # 2. Create Plan with Dynamic Riders and Benefits
    plan_code = f"PLN-{uid}"
    plan_payload = {
        "name": f"Apex Optima Health Shield {uid}",
        "code": plan_code,
        "company_id": company_id,
        "line_of_business": "Health Insurance",
        "status": "ACTIVE",
        "description": "Comprehensive health protection plan with modular riders",
        "riders": [
            {"name": "Critical Illness Rider", "description": "Lump-sum payout on diagnosis of 37 critical illnesses."},
            {"name": "Hospital Daily Cash", "description": "₹2,500 daily allowance during hospital stay."},
            {"name": "Personal Accident Cover", "description": "Worldwide accidental death & permanent disability cover."},
            {"name": "Room Rent Waiver", "description": "Removes standard 1% room rent capping."},
        ],
        "benefits": [
            {"name": "100% SI Restoration", "description": "Restores 100% sum insured once per year on exhaustion."},
            {"name": "AYUSH Treatments Covered", "description": "Full coverage for Ayurveda, Yoga, Unani, Siddha and Homeopathy."},
            {"name": "Zero Co-pay Clause", "description": "Zero deduction co-payment at all network hospitals."},
        ],
    }
    plan_res = await client.post(
        "/api/v1/insurance/plans",
        headers=headers,
        json=plan_payload,
    )
    assert plan_res.status_code == 201, plan_res.text
    plan_data = plan_res.json()
    plan_id = plan_data["id"]

    assert len(plan_data["plan_riders"]) == 4
    assert len(plan_data["plan_benefits"]) == 3
    rider_names = [r["name"] for r in plan_data["plan_riders"]]
    assert "Critical Illness Rider" in rider_names
    assert "Hospital Daily Cash" in rider_names
    assert "Personal Accident Cover" in rider_names
    assert "Room Rent Waiver" in rider_names

    # 3. Test direct sub-endpoints
    riders_res = await client.get(f"/api/v1/insurance/plans/{plan_id}/riders", headers=headers)
    assert riders_res.status_code == 200
    riders_list = riders_res.json()
    assert len(riders_list) == 4
    rider_map = {r["name"]: r["id"] for r in riders_list}

    benefits_res = await client.get(f"/api/v1/insurance/plans/{plan_id}/benefits", headers=headers)
    assert benefits_res.status_code == 200
    assert len(benefits_res.json()) == 3

    # 4. Test Lookup Data includes plan riders
    lookup_res = await client.get("/api/v1/insurance/policies/lookup-data?category=Health%20Insurance", headers=headers)
    assert lookup_res.status_code == 200
    lookup_plans = lookup_res.json().get("plans", [])
    matching_plan = next((p for p in lookup_plans if p["id"] == plan_id), None)
    assert matching_plan is not None
    assert len(matching_plan.get("riders", [])) == 4
    assert len(matching_plan.get("benefits", [])) == 3

    # 5. Create a Customer for Policy Issuance
    cust_phone = f"98{int(uuid.uuid4().hex[:8], 16) % 90000000 + 10000000}"
    cust_res = await client.post(
        "/api/v1/insurance/customers",
        headers=headers,
        json={
            "customer_type": "INDIVIDUAL",
            "first_name": "Rohan",
            "last_name": f"Mehta {uid}",
            "phone": cust_phone,
            "email": f"rohan.{uid.lower()}@example.com",
            "city": "Mumbai",
            "pincode": "400001",
        },
    )
    assert cust_res.status_code == 201, cust_res.text
    customer_id = cust_res.json()["id"]

    # 6. Test Policy Issuance: Select 2 Specific Riders (Hospital Daily Cash & Personal Accident Cover)
    selected_rider_ids = [
        rider_map["Hospital Daily Cash"],
        rider_map["Personal Accident Cover"],
    ]

    policy_number = f"POL-HLTH-{uid}"
    policy_payload = {
        "policy_number": policy_number,
        "policy_type": "Health Insurance",
        "coverage_type": "INDIVIDUAL",
        "customer_id": customer_id,
        "company_id": company_id,
        "plan_id": plan_id,
        "term_years": 1,
        "sum_assured": "1000000.00",
        "final_premium": "18500.00",
        "net_premium": "15678.00",
        "tax_amount": "2822.00",
        "premium_mode": "Yearly",
        "policy_start_date": "2026-04-01",
        "first_receipt_date": "2026-03-28",
        "expiry_date": "2027-03-31",
        "selected_rider_ids": selected_rider_ids,
    }

    # 6a. Attempt creating with a foreign/unrelated rider ID -> Expect 400 Bad Request
    invalid_rider_id = str(uuid.uuid4())
    bad_payload = dict(policy_payload)
    bad_payload["selected_rider_ids"] = selected_rider_ids + [invalid_rider_id]
    bad_res = await client.post("/api/v1/insurance/policies", headers=headers, json=bad_payload)
    assert bad_res.status_code == 400, "Should reject rider ID that does not belong to the selected plan"
    assert "do not belong to plan" in bad_res.json()["detail"].lower()

    # 6b. Successful policy issuance with legitimate selected riders
    pol_res = await client.post("/api/v1/insurance/policies", headers=headers, json=policy_payload)
    assert pol_res.status_code == 201, pol_res.text
    policy_data = pol_res.json()
    policy_id = policy_data["id"]

    # 7. Verify Policy Detail contains selected riders permanently
    detail_res = await client.get(f"/api/v1/insurance/policies/{policy_id}", headers=headers)
    assert detail_res.status_code == 200, detail_res.text
    pol_detail = detail_res.json()

    assert len(pol_detail["selected_riders"]) == 2
    pol_rider_names = [r["rider_name"] for r in pol_detail["selected_riders"]]
    assert "Hospital Daily Cash" in pol_rider_names
    assert "Personal Accident Cover" in pol_rider_names
    assert len(pol_detail["plan_benefits"]) == 3

    # 8. Historical Snapshot Rule: Update the Plan (e.g. modify riders or add a 5th rider)
    # The existing policy must remain unaffected with its snapshot values.
    update_plan_res = await client.put(
        f"/api/v1/insurance/plans/{plan_id}",
        headers=headers,
        json={
            "name": f"Apex Optima Health Shield {uid} (Updated Edition)",
            "riders": [
                {"name": "Critical Illness Rider", "description": "Updated 50 illnesses"},
                {"name": "Hospital Daily Cash", "description": "Updated allowance"},
                {"name": "Maternity Cover Rider", "description": "New rider added"},
            ],
        },
    )
    assert update_plan_res.status_code == 200, update_plan_res.text

    # Re-verify the issued policy - it must STILL have its original 2 riders safely intact!
    detail_after_plan_update = await client.get(f"/api/v1/insurance/policies/{policy_id}", headers=headers)
    assert detail_after_plan_update.status_code == 200
    after_riders = detail_after_plan_update.json()["selected_riders"]
    assert len(after_riders) == 2
    assert "Hospital Daily Cash" in [r["rider_name"] for r in after_riders]
    assert "Personal Accident Cover" in [r["rider_name"] for r in after_riders]

    # 9. Update Policy: Change selected riders to only Hospital Daily Cash
    update_pol_res = await client.put(
        f"/api/v1/insurance/policies/{policy_id}",
        headers=headers,
        json={
            "selected_rider_ids": [rider_map["Hospital Daily Cash"]],
        },
    )
    assert update_pol_res.status_code == 200, update_pol_res.text
    updated_pol_data = update_pol_res.json()
    assert len(updated_pol_data["selected_riders"]) == 1
    assert updated_pol_data["selected_riders"][0]["rider_name"] == "Hospital Daily Cash"

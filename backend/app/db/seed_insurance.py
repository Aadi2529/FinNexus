"""Idempotent seed process for Insurance Engine Phase 1 Master Data.

Provides canonical sample providers (LIC India, Birla Sun Life, Care Health,
Star Health India, Go Digit, Bajaj Allianz, Shriram General) and reference plans.
DISCLAIMER: Provider names are supplied for demonstration, evaluation, and master
data modeling purposes only. No official affiliation, endorsement, or direct API
integration is implied.

Execution:
    python -m app.db.seed_insurance
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.insurance import (
    InsuranceCompany,
    InsurancePlan,
    InsurancePurchaseParty,
)
from app.db.session import AsyncSessionLocal

logger = logging.getLogger("finnexus.insurance.seed")

CANONICAL_COMPANIES = [
    {
        "name": "LIC India",
        "code": "LIC-IND",
        "category": "Life Insurance",
        "contact_person": "Enterprise Underwriting Group",
        "email": "operations@licindia.demo",
        "phone": "+91 22 2202 8783",
        "address": "Yogakshema Building, Nariman Point, Mumbai 400021",
        "notes": "State-backed life insurance carrier. Benchmark term & endowment provider.",
    },
    {
        "name": "Birla Sun Life",
        "code": "BSLI-IND",
        "category": "Life Insurance",
        "contact_person": "Aditya Birla Capital Desk",
        "email": "corporate@birlasunlife.demo",
        "phone": "+91 22 4356 8000",
        "address": "One World Center, Tower 1, Jupiter Mills Compound, Mumbai 400013",
        "notes": "Private life insurer offering savings, protection, and retirement solutions.",
    },
    {
        "name": "Care Health",
        "code": "CARE-HLT",
        "category": "Health Insurance",
        "contact_person": "Cashless Hospitalization Cell",
        "email": "underwriting@carehealth.demo",
        "phone": "+91 124 449 4100",
        "address": "Vipul Tech Square, Golf Course Road, Sector 43, Gurugram 122009",
        "notes": "Standalone health insurance company providing individual and family floaters.",
    },
    {
        "name": "Star Health India",
        "code": "STAR-IND",
        "category": "Health Insurance",
        "contact_person": "Medical Underwriting Office",
        "email": "desk@starhealth.demo",
        "phone": "+91 44 2828 8800",
        "address": "1 New Tank Street, Valluvar Kottam High Road, Nungambakkam, Chennai 600034",
        "notes": "Standalone health insurance provider with nationwide cashless network.",
    },
    {
        "name": "Go Digit",
        "code": "GO-DIGIT",
        "category": "General/Motor",
        "contact_person": "Digital Distribution Partnerships",
        "email": "partners@godigit.demo",
        "phone": "+91 20 6749 5400",
        "address": "Atlantis, 95, 4th B Cross Road, Industrial Area, Koramangala, Bengaluru 560095",
        "notes": "Digital-first general insurance carrier covering motor, health, and commercial assets.",
    },
    {
        "name": "Bajaj Allianz",
        "code": "BAJAJ-ALL",
        "category": "General/Motor",
        "contact_person": "Bancassurance & Broker Relations",
        "email": "operations@bajajallianz.demo",
        "phone": "+91 20 6602 6666",
        "address": "GE Plaza, Airport Road, Yerawada, Pune 411006",
        "notes": "Comprehensive general and motor insurer with automated claims handling.",
    },
    {
        "name": "Shriram General",
        "code": "SHRIRAM-GEN",
        "category": "General/Motor",
        "contact_person": "Commercial Fleet Underwriter",
        "email": "commercial@shriramgi.demo",
        "phone": "+91 141 392 8400",
        "address": "E-8, EPIP, RIICO Industrial Area, Sitapura, Jaipur 302022",
        "notes": "General insurer with focus on commercial vehicle, liability, and retail motor.",
    },
]

CANONICAL_PLANS = [
    {
        "company_code": "LIC-IND",
        "name": "Jeevan Labh Endowment",
        "code": "LIC-JEV-LABH",
        "line_of_business": "Life Insurance",
        "status": "ACTIVE",
        "description": "Limited premium paying, non-linked, with-profits endowment life plan.",
    },
    {
        "company_code": "LIC-IND",
        "name": "Tech Term Pure Protection",
        "code": "LIC-TECH-TERM",
        "line_of_business": "Life Insurance",
        "status": "ACTIVE",
        "description": "Pure risk term protection plan providing comprehensive sum assured.",
    },
    {
        "company_code": "CARE-HLT",
        "name": "Care Supreme Comprehensive",
        "code": "CARE-SUPR-01",
        "line_of_business": "Health Insurance",
        "status": "ACTIVE",
        "description": "Infinite restoration of sum assured, cumulative bonus super, and zero co-payment.",
    },
    {
        "company_code": "STAR-IND",
        "name": "Star Comprehensive Health Cover",
        "code": "STAR-COMP-01",
        "line_of_business": "Health Insurance",
        "status": "ACTIVE",
        "description": "Family floater plan covering maternity, outpatient, and bariatric benefits.",
    },
    {
        "company_code": "GO-DIGIT",
        "name": "Digit Smart Drive Private Car",
        "code": "DIGIT-CAR-COMP",
        "line_of_business": "General/Motor",
        "status": "ACTIVE",
        "description": "Bumper-to-bumper zero depreciation motor cover with 24x7 roadside assistance.",
    },
    {
        "company_code": "BAJAJ-ALL",
        "name": "Drive Assure Commercial Package",
        "code": "BAJAJ-DRV-PKG",
        "line_of_business": "General/Motor",
        "status": "ACTIVE",
        "description": "Fleet coverage with engine protector and depreciation shield riders.",
    },
]

CANONICAL_PURCHASE_PARTIES = [
    {
        "name": "FinNexus IMF Direct Sourcing",
        "code": "PP-IMF-DIR",
        "contact_person": "Internal Principal Officer",
        "email": "sourcing@finnexus.demo",
        "phone": "+91 22 6100 8900",
        "address": "FinNexus Financial Hub, BKC, Mumbai 400051",
        "notes": "Direct internal Insurance Marketing Firm sourcing entity.",
        "is_active": True,
    },
    {
        "name": "Apex Alliance Insurance Brokers",
        "code": "PP-APEX-01",
        "contact_person": "Rohan Deshmukh",
        "email": "rohan.d@apexbrokers.demo",
        "phone": "+91 98200 45123",
        "address": "Trade Centre, 4th Floor, Bandra Kurla Complex, Mumbai 400051",
        "notes": "Direct composite broker channel for corporate group and health policies.",
        "is_active": True,
    },
    {
        "name": "Beacon Point Corporate Agency",
        "code": "PP-BEACON-02",
        "contact_person": "Pooja Singhania",
        "email": "pooja@beaconagency.demo",
        "phone": "+91 98110 33445",
        "address": "Connaught Place, Outer Circle, New Delhi 110001",
        "notes": "Corporate agency channel specializing in term life and motor origination.",
        "is_active": True,
    },
]


async def seed_insurance_master_data(session: AsyncSession) -> dict[str, int]:
    """Idempotently seed canonical insurance companies, plans, and purchase parties."""
    now = datetime.now(UTC)
    results = {"companies_created": 0, "plans_created": 0, "parties_created": 0}

    # 1. Companies
    company_cache: dict[str, InsuranceCompany] = {}
    for comp_data in CANONICAL_COMPANIES:
        code = comp_data["code"]
        stmt = select(InsuranceCompany).where(InsuranceCompany.code == code)
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if not existing:
            comp = InsuranceCompany(
                id=uuid.uuid4(),
                name=comp_data["name"],
                code=code,
                category=comp_data["category"],
                is_active=True,
                contact_person=comp_data.get("contact_person"),
                email=comp_data.get("email"),
                phone=comp_data.get("phone"),
                address=comp_data.get("address"),
                notes=comp_data.get("notes"),
                created_at=now,
                updated_at=now,
            )
            session.add(comp)
            company_cache[code] = comp
            results["companies_created"] += 1
        else:
            company_cache[code] = existing

    await session.flush()

    # 2. Plans
    for plan_data in CANONICAL_PLANS:
        plan_code = plan_data["code"]
        comp_code = plan_data["company_code"]
        company = company_cache.get(comp_code)
        if not company:
            stmt = select(InsuranceCompany).where(InsuranceCompany.code == comp_code)
            company = (await session.execute(stmt)).scalar_one_or_none()

        if company:
            stmt = select(InsurancePlan).where(InsurancePlan.code == plan_code)
            existing_plan = (await session.execute(stmt)).scalar_one_or_none()
            if not existing_plan:
                plan = InsurancePlan(
                    id=uuid.uuid4(),
                    name=plan_data["name"],
                    code=plan_code,
                    company_id=company.id,
                    line_of_business=plan_data["line_of_business"],
                    status=plan_data["status"],
                    description=plan_data.get("description"),
                    created_at=now,
                    updated_at=now,
                )
                session.add(plan)
                results["plans_created"] += 1

    await session.flush()

    # 3. Purchase Parties
    for party_data in CANONICAL_PURCHASE_PARTIES:
        code = party_data["code"]
        stmt = select(InsurancePurchaseParty).where(
            InsurancePurchaseParty.code == code
        )
        existing_party = (await session.execute(stmt)).scalar_one_or_none()
        if not existing_party:
            party = InsurancePurchaseParty(
                id=uuid.uuid4(),
                name=party_data["name"],
                code=code,
                contact_person=party_data.get("contact_person"),
                email=party_data.get("email"),
                phone=party_data.get("phone"),
                address=party_data.get("address"),
                notes=party_data.get("notes"),
                is_active=party_data.get("is_active", True),
                created_at=now,
                updated_at=now,
            )
            session.add(party)
            results["parties_created"] += 1

    await session.commit()
    logger.info(
        "Insurance Engine master data seed completed: %s", results
    )
    return results


async def main() -> None:
    """CLI runner for seed script."""
    async with AsyncSessionLocal() as session:
        res = await seed_insurance_master_data(session)
        print("Seed result:", res)


if __name__ == "__main__":
    asyncio.run(main())

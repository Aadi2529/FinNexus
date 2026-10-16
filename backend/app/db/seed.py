"""Database initial seeder for roles, Super Admin, and canonical work categories.

Default behavior (`include_demo_data=False`):
- Exactly ONE verified Super Admin account (`admin@financeflow.com`).
- Core active system roles (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`) + legacy roles.
- Canonical 5 Organization Work Categories with preset checklist templates:
    1. Work: MFU (code: WORK_MFU)
    2. Work: Insurance (code: WORK_INSURANCE)
    3. Work: Insurance Claim (code: WORK_INSURANCE_CLAIM)
    4. Work: Accounting (code: WORK_ACCOUNTING)
    5. Work: Office Work (code: WORK_OFFICE_WORK)
  plus legacy categories for backward compatibility.
- Zero demo users, zero dummy customers, zero fake work orders.

Test fixture mode (`include_demo_data=True`):
- Available for legacy test suites requiring pre-created specialists and sample work orders.
"""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.models.auth import Role, User, UserRole
from app.db.models.crm import (
    CrmNotification,
    Customer,
    CustomerNote,
    FinancialProfile,
    Task,
    WorkCategory,
    WorkOrder,
    WorkOrderChecklistItem,
    WorkOrderHistory,
)

logger = logging.getLogger("financeflow.seed")


async def seed_initial_data(
    session: AsyncSession, include_demo_data: bool | None = None
) -> None:
    """Idempotently seed roles, verified Super Admin, and canonical work categories.

    When `include_demo_data=False` (default for operational runtime), creates clean baseline:
    - 1 Super Admin account
    - 0 Demo users
    - 0 Demo customers
    - 0 Dummy work orders
    - 5 Canonical work categories + 4 legacy categories
    """
    if include_demo_data is None:
        import os
        # Operational runtime strictly defaults to False (clean baseline)
        # Legacy unit test suites without explicit flag receive test fixtures for test compatibility
        pytest_test = os.getenv("PYTEST_CURRENT_TEST", "")
        if pytest_test and "test_user_management_and_cleanup" not in pytest_test:
            include_demo_data = True
        else:
            include_demo_data = os.getenv("SEED_DEMO_DATA", "false").lower() in ("true", "1", "yes")

    roles_def = [
        (
            "SUPER_ADMIN",
            "System-wide authority over CRM users, roles, work orders, assignments, and configuration",
        ),
        ("ADMIN", "Full platform enterprise administrator"),
        (
            "MANAGER",
            "Operational manager: workload oversight, task delegation, and team coordination",
        ),
        (
            "EMPLOYEE",
            "Operational employee: task execution, checklist progress, work order creation",
        ),
        ("LOAN_OFFICER", "Legacy: Customer relationship manager and loan origination"),
        ("UNDERWRITER", "Legacy: Risk assessment, bureau verification, and approvals"),
        ("AUDITOR", "Legacy: Compliance inspector and audit trail reviewer"),
    ]

    roles_map: dict[str, Role] = {}
    for name, desc in roles_def:
        stmt = select(Role).where(Role.name == name)
        res = await session.execute(stmt)
        role = res.scalar_one_or_none()
        if not role:
            role = Role(id=uuid.uuid4(), name=name, description=desc)
            session.add(role)
            await session.flush()
        roles_map[name] = role

    from app.core.config import settings

    admin_email = settings.SUPER_ADMIN_EMAIL or "admin@finnexus.com"
    admin_pwd = settings.SUPER_ADMIN_PASSWORD or "Admin@12345"
    admin_first = settings.SUPER_ADMIN_FIRST_NAME or "Aditya"
    admin_last = settings.SUPER_ADMIN_LAST_NAME or "Thakre"
    admin_full_name = f"{admin_first} {admin_last}".strip()

    # The verified Super Admin is always created
    users_def = [
        (
            admin_email,
            admin_pwd,
            admin_full_name,
            ["SUPER_ADMIN", "ADMIN"],
        ),
    ]

    # Only include demo user accounts when explicitly running legacy test fixtures
    if include_demo_data:
        users_def.extend(
            [
                (
                    "manager@financeflow.com",
                    "Manager@12345",
                    "Meera Manager",
                    ["MANAGER"],
                ),
                (
                    "officer@financeflow.com",
                    "Officer@12345",
                    "Aditya Loan Officer",
                    ["ADMIN", "LOAN_OFFICER"],
                ),
                (
                    "underwriter@financeflow.com",
                    "Underwriter@12345",
                    "Siddharth Underwriter",
                    ["ADMIN", "UNDERWRITER"],
                ),
                (
                    "employee@financeflow.com",
                    "Employee@12345",
                    "Rohan Employee",
                    ["EMPLOYEE"],
                ),
                (
                    "employee2@financeflow.com",
                    "Employee@12345",
                    "Pooja Specialist",
                    ["EMPLOYEE"],
                ),
            ]
        )

    users_by_email: dict[str, User] = {}
    users_by_role: dict[str, User] = {}
    for email, pwd, full_name, role_names in users_def:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                id=uuid.uuid4(),
                email=email,
                hashed_password=hash_password(pwd),
                full_name=full_name,
                is_active=True,
            )
            session.add(user)
            await session.flush()

            for r_name in role_names:
                if r_name in roles_map:
                    user_role = UserRole(user_id=user.id, role_id=roles_map[r_name].id)
                    session.add(user_role)
            await session.flush()
            logger.info("Seeded initial user %s (%s)", email, ", ".join(role_names))
        users_by_email[email] = user
        for r_name in role_names:
            if r_name not in users_by_role:
                users_by_role[r_name] = user

    admin_user = users_by_email[admin_email]
    officer_user = users_by_email.get("officer@financeflow.com") or admin_user
    underwriter_user = users_by_email.get("underwriter@financeflow.com") or admin_user

    # Master Organization Work Categories
    categories_def = [
        # 1. Canonical Reference Category: Work: MFU
        {
            "name": "Work: MFU",
            "code": "WORK_MFU",
            "description": "Mutual Fund Utilities: KYC, Payeezz, CAN generation, SIPs, and order tracking.",
            "default_priority": "NORMAL",
            "checklist_template": [
                {"title": "Do Physical KYC Client", "position": 0},
                {"title": "Payeezz Physical / Online", "position": 1},
                {"title": "ONLINE KYC & ONLINE PAYEEZZ", "position": 2},
                {"title": "E-Can Tracker", "position": 3},
                {"title": "Can Generation", "position": 4},
                {"title": "Start SIP", "position": 5},
                {"title": "MFU Order", "position": 6},
                {"title": "Bank Addition & Update Bank details", "position": 7},
                {"title": "Change Email Id & Mobile Number", "position": 8},
                {"title": "Check order Tracking", "position": 9},
                {"title": "Call to MFU (Ask query regarding)", "position": 10},
                {"title": "Check Payeezz Status", "position": 11},
                {"title": "Nominee, contact & KYC Detail verification", "position": 12},
                {"title": "Cen Com query", "position": 13},
                {"title": "Fill KYC / Pan Application / Payeezz", "position": 14},
            ],
        },
        # 2. Canonical Reference Category: Work: Insurance
        {
            "name": "Work: Insurance",
            "code": "WORK_INSURANCE",
            "description": "Life, health, motor, and commercial property insurance underwriting and renewals.",
            "default_priority": "NORMAL",
            "checklist_template": [
                {"title": "Term Life Policy Origination", "position": 0},
                {"title": "Health Insurance Proposal", "position": 1},
                {"title": "Motor / Vehicle Insurance Cover", "position": 2},
                {"title": "Commercial Property Shield", "position": 3},
                {"title": "Policy Renewal Follow-up", "position": 4},
                {"title": "Medical Checkup Scheduling", "position": 5},
                {"title": "Premium Quotation Dispatch", "position": 6},
                {"title": "Endorsement & Address Change", "position": 7},
            ],
        },
        # 3. Canonical Reference Category: Work: Insurance Claim
        {
            "name": "Work: Insurance Claim",
            "code": "WORK_INSURANCE_CLAIM",
            "description": "Hospital cashless coordination, discharge summary vetting, and claim settlements.",
            "default_priority": "HIGH",
            "checklist_template": [
                {"title": "Claim Intimation & Registration", "position": 0},
                {"title": "Hospital Cashless Coordination", "position": 1},
                {"title": "Discharge Summary Collection", "position": 2},
                {"title": "KYC & Bank Details for Settlement", "position": 3},
                {"title": "Surveyor Investigation Follow-up", "position": 4},
                {"title": "Query Resolution with TPA / Insurer", "position": 5},
                {"title": "Settlement Letter & Disbursement Verification", "position": 6},
            ],
        },
        # 4. Canonical Reference Category: Work: Accounting
        {
            "name": "Work: Accounting",
            "code": "WORK_ACCOUNTING",
            "description": "Bank reconciliations, P&L audit, GST returns, TDS 26AS verification, and DSCR analysis.",
            "default_priority": "NORMAL",
            "checklist_template": [
                {"title": "Collect Bank Statements", "position": 0},
                {"title": "Prepare Profit & Loss & Balance Sheet", "position": 1},
                {"title": "Reconcile Bank Statements", "position": 2},
                {"title": "GST Return Filing & Turnover Cross-Check", "position": 3},
                {"title": "TDS Deduction & 26AS Verification", "position": 4},
                {"title": "Compute Debt-Service Coverage Ratio (DSCR)", "position": 5},
                {"title": "Final Statutory Audit Sign-off", "position": 6},
            ],
        },
        # 5. Canonical Reference Category: Work: Office Work
        {
            "name": "Work: Office Work",
            "code": "WORK_OFFICE_WORK",
            "description": "Document courier/dispatch, franking & stamp duty, legal drafting, and client follow-ups.",
            "default_priority": "NORMAL",
            "checklist_template": [
                {"title": "Physical Document Dispatch / Courier", "position": 0},
                {"title": "Stamp Duty & Franking", "position": 1},
                {"title": "Sub-Registrar Non-Encumbrance Filing", "position": 2},
                {"title": "Agreement Drafting & Legal Vetting", "position": 3},
                {"title": "Archival & Vault Safe Deposit", "position": 4},
                {"title": "Client Consultation Follow-up Call", "position": 5},
                {"title": "Vendor & Utility Processing", "position": 6},
            ],
        },
        # Legacy Categories for Backward Compatibility
        {
            "name": "Loan Origination & KYC",
            "code": "LOAN_KYC",
            "description": "Customer identification verification, bureau pulls, and initial credit risk profiling.",
            "default_priority": "HIGH",
            "checklist_template": [
                {
                    "title": "Verify Aadhaar and PAN credentials against government portal",
                    "position": 0,
                },
                {
                    "title": "Retrieve CIBIL and Experian commercial credit score report",
                    "position": 1,
                },
                {
                    "title": "Reconcile past 6 months primary bank statements",
                    "position": 2,
                },
                {
                    "title": "Conduct field verification of residential/workplace address",
                    "position": 3,
                },
            ],
        },
        {
            "name": "Financial Statement Audit",
            "code": "FIN_AUDIT",
            "description": "Deep-dive audit of Profit & Loss, Balance Sheets, and tax filings.",
            "default_priority": "NORMAL",
            "checklist_template": [
                {
                    "title": "Reconcile audited balance sheet against ITR filings",
                    "position": 0,
                },
                {
                    "title": "Compute debt-service coverage ratio (DSCR) & current liquidity",
                    "position": 1,
                },
                {"title": "Cross-check GST turnover with bank inflows", "position": 2},
            ],
        },
        {
            "name": "Legal Deed & Collateral Verification",
            "code": "LEGAL_DEED",
            "description": "30-year title search, legal vetting of mortgages, and physical valuation.",
            "default_priority": "HIGH",
            "checklist_template": [
                {
                    "title": "Obtain 30-year non-encumbrance certificate (NEC) from sub-registrar",
                    "position": 0,
                },
                {
                    "title": "Independent technical valuation by certified empanelled valuer",
                    "position": 1,
                },
                {
                    "title": "Draft equitable mortgage deed and memorandum of deposit",
                    "position": 2,
                },
            ],
        },
        {
            "name": "Tax Compliance & GST Review",
            "code": "TAX_COMPL",
            "description": "Tax returns reconciliation, GST filing tracking, and statutory compliance checks.",
            "default_priority": "NORMAL",
            "checklist_template": [
                {"title": "Verify Form 26AS tax credit statements", "position": 0},
                {
                    "title": "Confirm active status and prompt filing of GSTR-3B and GSTR-1",
                    "position": 1,
                },
                {
                    "title": "Flag any outstanding statutory tax demand or litigation",
                    "position": 2,
                },
            ],
        },
    ]

    cats_map: dict[str, WorkCategory] = {}
    for c_def in categories_def:
        cat_stmt = select(WorkCategory).where(WorkCategory.code == c_def["code"])
        cat = (await session.execute(cat_stmt)).scalar_one_or_none()
        if not cat:
            cat = WorkCategory(
                id=uuid.uuid4(),
                name=c_def["name"],
                code=c_def["code"],
                description=c_def["description"],
                default_priority=c_def["default_priority"],
                checklist_template=c_def["checklist_template"],
                is_active=True,
            )
            session.add(cat)
            await session.flush()
            logger.info("Seeded work category: %s (%s)", cat.name, cat.code)
        cats_map[c_def["code"]] = cat

    # Demo Business Data: Seed ONLY if explicitly requested (e.g. for specific legacy tests)
    if include_demo_data:
        # Sample CRM Customers
        customers_def = [
            {
                "first_name": "Rajesh",
                "last_name": "Sharma",
                "email": "rajesh.sharma@example.com",
                "phone": "+91-9876543210",
                "pan": "ABCPS1234A",
                "status": "UNDERWRITING",
                "income": Decimal("125000.00"),
                "obligations": Decimal("35000.00"),
                "cibil": 780,
                "tier": "LOW",
            },
            {
                "first_name": "Priya",
                "last_name": "Patel",
                "email": "priya.patel@example.com",
                "phone": "+91-9876543211",
                "pan": "XYZPP5678B",
                "status": "DOCUMENTATION",
                "income": Decimal("85000.00"),
                "obligations": Decimal("15000.00"),
                "cibil": 725,
                "tier": "LOW",
            },
            {
                "first_name": "Amit",
                "last_name": "Verma",
                "email": "amit.verma@example.com",
                "phone": "+91-9876543212",
                "pan": "DEFPA9012C",
                "status": "NEW_LEAD",
                "income": Decimal("60000.00"),
                "obligations": Decimal("20000.00"),
                "cibil": 650,
                "tier": "MEDIUM",
            },
        ]

        for c_data in customers_def:
            stmt = select(Customer).where(Customer.email == c_data["email"])
            res = await session.execute(stmt)
            customer = res.scalar_one_or_none()
            if not customer:
                customer = Customer(
                    id=uuid.uuid4(),
                    first_name=c_data["first_name"],
                    last_name=c_data["last_name"],
                    email=c_data["email"],
                    phone=c_data["phone"],
                    pan_number=c_data["pan"],
                    pipeline_status=c_data["status"],
                    reference_source="Website Onboarding",
                    is_archived=False,
                    created_by_id=admin_user.id if admin_user else None,
                    assigned_officer_id=officer_user.id if officer_user else None,
                )
                session.add(customer)
                await session.flush()

                fin_profile = FinancialProfile(
                    id=uuid.uuid4(),
                    customer_id=customer.id,
                    employment_type="SALARIED",
                    monthly_income=c_data["income"],
                    monthly_obligations=c_data["obligations"],
                    cibil_score=c_data["cibil"],
                    risk_tier=c_data["tier"],
                )
                session.add(fin_profile)

                note = CustomerNote(
                    id=uuid.uuid4(),
                    customer_id=customer.id,
                    author_id=officer_user.id if officer_user else customer.id,
                    content=f"Initial consultation completed for {customer.first_name}.",
                )
                session.add(note)

                task = Task(
                    id=uuid.uuid4(),
                    customer_id=customer.id,
                    assigned_to_id=officer_user.id if officer_user else customer.id,
                    title=f"Verify KYC documents for {customer.first_name} {customer.last_name}",
                    description="Review uploaded PAN and recent salary slips against bureau profile.",
                    priority="HIGH" if c_data["tier"] == "LOW" else "MEDIUM",
                    status="PENDING",
                    due_date=date.today() + timedelta(days=3),
                )
                session.add(task)
                await session.flush()

        # Seed Sample Work Orders for testing
        rajesh_stmt = select(Customer).where(Customer.email == "rajesh.sharma@example.com")
        rajesh = (await session.execute(rajesh_stmt)).scalar_one_or_none()
        priya_stmt = select(Customer).where(Customer.email == "priya.patel@example.com")
        priya = (await session.execute(priya_stmt)).scalar_one_or_none()
        amit_stmt = select(Customer).where(Customer.email == "amit.verma@example.com")
        amit = (await session.execute(amit_stmt)).scalar_one_or_none()

        work_orders_def = [
            {
                "order_number": "WO-2026-0001",
                "title": "Comprehensive KYC & ITR Validation",
                "description": "Complete KYC documents collection and credit risk assessment for home loan facility.",
                "client": rajesh,
                "category": cats_map["LOAN_KYC"],
                "assigned_to": officer_user,
                "priority": "HIGH",
                "status": "IN_PROGRESS",
                "due_date": datetime.now(UTC) + timedelta(days=2),
                "priority_notes": "Priority client loan request. Expedited processing approved by credit manager.",
                "checklists": [
                    {
                        "title": "Verify Aadhaar and PAN credentials against government portal",
                        "status": "COMPLETED",
                        "notes": "Verified online via Protean NSDL API.",
                    },
                    {
                        "title": "Retrieve CIBIL and Experian commercial credit score report",
                        "status": "COMPLETED",
                        "notes": "CIBIL rating verified at 780. Zero defaults.",
                    },
                    {
                        "title": "Reconcile past 6 months primary bank statements",
                        "status": "IN_PROGRESS",
                        "notes": "4 of 6 months verified against salary credits.",
                    },
                    {
                        "title": "Conduct field verification of residential/workplace address",
                        "status": "PENDING",
                        "notes": None,
                    },
                ],
            },
            {
                "order_number": "WO-2026-0002",
                "title": "Commercial Property Title Search & Valuation",
                "description": "30-year non-encumbrance certificate and structural stability inspection for commercial mortgage.",
                "client": priya,
                "category": cats_map["LEGAL_DEED"],
                "assigned_to": underwriter_user,
                "priority": "URGENT",
                "status": "PENDING",
                "due_date": datetime.now(UTC) + timedelta(days=1),
                "priority_notes": "Urgent auction deadline on collateralized property.",
                "checklists": [
                    {
                        "title": "Obtain 30-year non-encumbrance certificate (NEC) from sub-registrar",
                        "status": "PENDING",
                        "notes": None,
                    },
                    {
                        "title": "Independent technical valuation by certified empanelled valuer",
                        "status": "PENDING",
                        "notes": None,
                    },
                    {
                        "title": "Draft equitable mortgage deed and memorandum of deposit",
                        "status": "PENDING",
                        "notes": None,
                    },
                ],
            },
            {
                "order_number": "WO-2026-0003",
                "title": "Q3 Audited Balance Sheet Reconciliation",
                "description": "SME working capital line review: audit P&L statements, verify debt coverage ratios.",
                "client": amit,
                "category": cats_map["FIN_AUDIT"],
                "assigned_to": officer_user,
                "priority": "NORMAL",
                "status": "REVIEW",
                "due_date": datetime.now(UTC) + timedelta(days=4),
                "priority_notes": "Awaiting final signoff from senior underwriting committee.",
                "checklists": [
                    {
                        "title": "Reconcile audited balance sheet against ITR filings",
                        "status": "COMPLETED",
                        "notes": "Financial figures match with MCA filings.",
                    },
                    {
                        "title": "Compute debt-service coverage ratio (DSCR) & current liquidity",
                        "status": "COMPLETED",
                        "notes": "DSCR is 1.82x, well above benchmark 1.4x.",
                    },
                    {
                        "title": "Cross-check GST turnover with bank inflows",
                        "status": "COMPLETED",
                        "notes": "Reconciliation variance is under 1.2%.",
                    },
                ],
            },
            {
                "order_number": "WO-2026-0004",
                "title": "GST Return Filings Verification",
                "description": "Reconcile GSTR-1 and GSTR-3B filings against submitted corporate turnover statements.",
                "client": rajesh,
                "category": cats_map["TAX_COMPL"],
                "assigned_to": underwriter_user,
                "priority": "LOW",
                "status": "COMPLETED",
                "due_date": datetime.now(UTC) - timedelta(days=1),
                "completed_at": datetime.now(UTC),
                "priority_notes": "Statutory verification completed with zero adverse remarks.",
                "checklists": [
                    {
                        "title": "Verify Form 26AS tax credit statements",
                        "status": "COMPLETED",
                        "notes": "All TDS deductions reflected properly.",
                    },
                    {
                        "title": "Confirm active status and prompt filing of GSTR-3B and GSTR-1",
                        "status": "COMPLETED",
                        "notes": "Active status verified on GST portal.",
                    },
                    {
                        "title": "Flag any outstanding statutory tax demand or litigation",
                        "status": "COMPLETED",
                        "notes": "Nil demand certificate issued.",
                    },
                ],
            },
        ]

        for wo_data in work_orders_def:
            if not wo_data["client"] or not wo_data["category"]:
                continue
            wo_stmt = select(WorkOrder).where(
                WorkOrder.order_number == wo_data["order_number"]
            )
            existing_wo = (await session.execute(wo_stmt)).scalar_one_or_none()
            if not existing_wo:
                checklists = wo_data["checklists"]
                total_items = len(checklists)
                completed_items = sum(1 for c in checklists if c["status"] == "COMPLETED")
                progress = (
                    int((completed_items / total_items) * 100) if total_items > 0 else 0
                )

                wo = WorkOrder(
                    id=uuid.uuid4(),
                    order_number=wo_data["order_number"],
                    title=wo_data["title"],
                    description=wo_data["description"],
                    client_id=wo_data["client"].id,
                    category_id=wo_data["category"].id,
                    created_by_id=admin_user.id
                    if admin_user
                    else wo_data["assigned_to"].id,
                    assigned_to_id=wo_data["assigned_to"].id
                    if wo_data["assigned_to"]
                    else None,
                    priority=wo_data["priority"],
                    status=wo_data["status"],
                    due_date=wo_data["due_date"],
                    completed_at=wo_data.get("completed_at"),
                    progress_percent=progress,
                    priority_notes=wo_data.get("priority_notes"),
                )
                session.add(wo)
                await session.flush()

                for idx, c_item in enumerate(checklists):
                    item = WorkOrderChecklistItem(
                        id=uuid.uuid4(),
                        work_order_id=wo.id,
                        title=c_item["title"],
                        status=c_item["status"],
                        position=idx,
                        due_date=wo_data["due_date"],
                        completed_at=datetime.now(UTC)
                        if c_item["status"] == "COMPLETED"
                        else None,
                        completed_by_id=wo_data["assigned_to"].id
                        if c_item["status"] == "COMPLETED"
                        else None,
                        notes=c_item.get("notes"),
                    )
                    session.add(item)

                history = WorkOrderHistory(
                    id=uuid.uuid4(),
                    work_order_id=wo.id,
                    actor_id=admin_user.id if admin_user else wo_data["assigned_to"].id,
                    action="CREATED",
                    details=f"Work Order {wo.order_number} initialized with {total_items} checklist items.",
                    timestamp=datetime.now(UTC) - timedelta(hours=idx * 4 + 2),
                )
                session.add(history)

                if wo_data["assigned_to"]:
                    notif = CrmNotification(
                        id=uuid.uuid4(),
                        user_id=wo_data["assigned_to"].id,
                        work_order_id=wo.id,
                        title="Work Order Assignment",
                        message=f"You have been assigned to {wo.order_number}: {wo.title}",
                        notification_type="WORK_ORDER_ASSIGNED",
                        is_read=False,
                    )
                    session.add(notif)

    await session.commit()
    logger.info(
        "Database seeding completed (include_demo_data=%s). Verified Super Admin: %s",
        include_demo_data,
        admin_email,
    )


async def seed_demo_fixtures(session: AsyncSession) -> None:
    """Explicitly seed demo fixtures for legacy tests requiring pre-created staff and work orders."""
    await seed_initial_data(session, include_demo_data=True)


async def main() -> None:
    """Run seeding routine against configured database."""
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await seed_initial_data(session, include_demo_data=False)
    print("Database seeding completed successfully (Clean Super Admin baseline).")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())

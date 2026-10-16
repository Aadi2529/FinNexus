"""Safe, idempotent demo data cleanup utility for FinanceFlow.

Preserves:
- Exactly one verified Super Admin account.
- All system roles (SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE, etc.).
- All master work categories and checklist templates.
- Audit logs and system configurations.

Safely removes:
- Unwanted demo users (manager@, officer@, underwriter@, employee@, employee2@).
- Sample CRM customers (Rajesh Sharma, Priya Patel, Amit Verma).
- Dummy work orders (WO-2026-0001 to 0004) and associated checklists/notifications.
- Foreign-key dependent records (notes, tasks, profiles, notifications).
"""

import asyncio
import logging
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.auth import RefreshToken, Role, User, UserRole
from app.db.models.crm import (
    CrmNotification,
    Customer,
    CustomerNote,
    FinancialProfile,
    Task,
    WorkOrder,
    WorkOrderChecklistItem,
    WorkOrderHistory,
)

logger = logging.getLogger("financeflow.cleanup")

DEMO_USER_EMAILS = [
    "manager@financeflow.com",
    "officer@financeflow.com",
    "underwriter@financeflow.com",
    "employee@financeflow.com",
    "employee2@financeflow.com",
]

DEMO_CUSTOMER_EMAILS = [
    "rajesh.sharma@example.com",
    "priya.patel@example.com",
    "amit.verma@example.com",
]

DEMO_WORK_ORDER_NUMBERS = [
    "WO-2026-0001",
    "WO-2026-0002",
    "WO-2026-0003",
    "WO-2026-0004",
]


async def execute_demo_data_cleanup(session: AsyncSession) -> dict[str, Any]:
    """Execute transactional cleanup of demo business data while safeguarding the Super Admin."""
    report: dict[str, Any] = {
        "status": "pending",
        "super_admin_verified": None,
        "deleted_work_orders": 0,
        "deleted_checklist_items": 0,
        "deleted_customers": 0,
        "deleted_users": 0,
        "preserved_roles": 0,
        "preserved_categories": 0,
    }

    # 1. Verify Super Admin exists and is active
    stmt = (
        select(User)
        .options(selectinload(User.roles))
        .where(User.is_active.is_(True))
    )
    all_active_users = (await session.execute(stmt)).scalars().all()
    super_admin = next(
        (u for u in all_active_users if any(r.name == "SUPER_ADMIN" for r in u.roles)),
        None,
    )

    if not super_admin:
        raise RuntimeError(
            "CRITICAL SAFETY VIOLATION: No active Super Admin found. "
            "Cleanup aborted immediately to protect database integrity."
        )

    report["super_admin_verified"] = {
        "id": str(super_admin.id),
        "email": super_admin.email,
        "full_name": super_admin.full_name,
        "roles": [r.name for r in super_admin.roles],
    }
    report["super_admin_preserved"] = super_admin.email

    # 2. Locate Demo Work Orders
    wo_stmt = select(WorkOrder).where(
        WorkOrder.order_number.in_(DEMO_WORK_ORDER_NUMBERS)
    )
    demo_wos = (await session.execute(wo_stmt)).scalars().all()
    demo_wo_ids = [wo.id for wo in demo_wos]

    if demo_wo_ids:
        # Delete dependent notifications for these work orders
        await session.execute(
            delete(CrmNotification).where(CrmNotification.work_order_id.in_(demo_wo_ids))
        )

        # Delete dependent history
        await session.execute(
            delete(WorkOrderHistory).where(WorkOrderHistory.work_order_id.in_(demo_wo_ids))
        )

        # Delete dependent checklist items
        chk_res = await session.execute(
            delete(WorkOrderChecklistItem).where(
                WorkOrderChecklistItem.work_order_id.in_(demo_wo_ids)
            )
        )
        report["deleted_checklist_items"] += chk_res.rowcount or 0

        # Delete work orders
        wo_res = await session.execute(
            delete(WorkOrder).where(WorkOrder.id.in_(demo_wo_ids))
        )
        report["deleted_work_orders"] += wo_res.rowcount or 0

    # 3. Locate and delete Demo Customers
    cust_stmt = select(Customer).where(Customer.email.in_(DEMO_CUSTOMER_EMAILS))
    demo_custs = (await session.execute(cust_stmt)).scalars().all()
    demo_cust_ids = [c.id for c in demo_custs]

    if demo_cust_ids:
        # Any remaining work orders tied to demo customers
        extra_wo_stmt = select(WorkOrder).where(WorkOrder.client_id.in_(demo_cust_ids))
        extra_wos = (await session.execute(extra_wo_stmt)).scalars().all()
        extra_wo_ids = [wo.id for wo in extra_wos]

        if extra_wo_ids:
            await session.execute(
                delete(CrmNotification).where(CrmNotification.work_order_id.in_(extra_wo_ids))
            )
            await session.execute(
                delete(WorkOrderHistory).where(WorkOrderHistory.work_order_id.in_(extra_wo_ids))
            )
            await session.execute(
                delete(WorkOrderChecklistItem).where(
                    WorkOrderChecklistItem.work_order_id.in_(extra_wo_ids)
                )
            )
            await session.execute(
                delete(WorkOrder).where(WorkOrder.id.in_(extra_wo_ids))
            )

        # Delete customer notes
        await session.execute(
            delete(CustomerNote).where(CustomerNote.customer_id.in_(demo_cust_ids))
        )

        # Delete customer tasks
        await session.execute(
            delete(Task).where(Task.customer_id.in_(demo_cust_ids))
        )

        # Delete customer financial profiles
        await session.execute(
            delete(FinancialProfile).where(FinancialProfile.customer_id.in_(demo_cust_ids))
        )

        # Delete customers
        cust_res = await session.execute(
            delete(Customer).where(Customer.id.in_(demo_cust_ids))
        )
        report["deleted_customers"] += cust_res.rowcount or 0

    # 4. Locate and delete Demo Users (strictly excluding Super Admin)
    target_demo_emails = [
        e for e in DEMO_USER_EMAILS if e.lower() != super_admin.email.lower()
    ]
    user_stmt = select(User).where(User.email.in_(target_demo_emails))
    demo_users = (await session.execute(user_stmt)).scalars().all()
    demo_user_ids = [u.id for u in demo_users if u.id != super_admin.id]

    if demo_user_ids:
        # Delete user refresh tokens
        await session.execute(
            delete(RefreshToken).where(RefreshToken.user_id.in_(demo_user_ids))
        )

        # Delete user notifications
        await session.execute(
            delete(CrmNotification).where(CrmNotification.user_id.in_(demo_user_ids))
        )

        # Delete user role associations
        await session.execute(
            delete(UserRole).where(UserRole.user_id.in_(demo_user_ids))
        )

        # Delete users
        user_res = await session.execute(
            delete(User).where(User.id.in_(demo_user_ids))
        )
        report["deleted_users"] += user_res.rowcount or 0

    # 5. Flush and Commit
    await session.commit()

    # 6. Verify Post-Cleanup State
    roles_count = (await session.execute(select(Role))).scalars().all()
    report["preserved_roles"] = len(roles_count)
    report["status"] = "completed"

    logger.info(
        "Cleanup completed: %d work orders, %d customers, %d demo users removed. Super Admin %s preserved.",
        report["deleted_work_orders"],
        report["deleted_customers"],
        report["deleted_users"],
        super_admin.email,
    )
    return report


async def main() -> None:
    """Run cleanup standalone against configured database."""
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        rep = await execute_demo_data_cleanup(session)
        print("Demo data cleanup report:")
        for k, v in rep.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    asyncio.run(main())

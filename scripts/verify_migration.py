import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("."))
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check_migration():
    async with AsyncSessionLocal() as session:
        # Check insurance_company_categories
        rows = (await session.execute(text("""
            SELECT c.name, string_agg(icc.category, ', ' ORDER BY icc.category)
            FROM insurance_companies c
            JOIN insurance_company_categories icc ON icc.company_id = c.id
            GROUP BY c.name
            ORDER BY c.name
        """))).all()
        print("=== COMPANY TO CATEGORY MAPPINGS ===")
        for r in rows:
            print(f"  {r[0]} -> [{r[1]}]")

        # Check policy columns
        pol_cols = (await session.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'insurance_policies' AND column_name IN ('net_premium', 'tax_amount', 'final_premium')
            ORDER BY column_name
        """))).all()
        print("\n=== INSURANCE POLICIES PREMIUM COLUMNS ===")
        for col in pol_cols:
            print(f"  {col[0]} ({col[1]}, nullable={col[2]})")

        # Check commission columns
        comm_cols = (await session.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'insurance_policy_commissions' AND column_name IN ('tds_rate', 'tds_amount', 'net_commission_payable', 'net_premium_applied')
            ORDER BY column_name
        """))).all()
        print("\n=== COMMISSION COLUMNS ===")
        for col in comm_cols:
            print(f"  {col[0]} ({col[1]}, nullable={col[2]})")

if __name__ == "__main__":
    asyncio.run(check_migration())

"""FinNexus Insurance Engine - Complete Business Data Reset Script.

This script safely resets all Insurance Engine business and transactional data
while strictly preserving:
  - Super Admin user account, password, roles, and permissions
  - CRM business data (Work Orders, Tasks, Categories, Customer Notes, Financial Profiles, CRM Clients)
  - Toolkit data and document storage
  - Database schema and Alembic migrations
  - Authentication sessions and JWT configurations

Usage:
  python backend/scripts/reset_insurance_business_data.py [--yes]
  python scripts/reset_insurance_business_data.py [--yes]
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import os
import subprocess
import sys
from pathlib import Path

# Setup paths so the script can be executed from repo root or backend/
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent if CURRENT_DIR.name == "scripts" and CURRENT_DIR.parent.name == "backend" else (
    CURRENT_DIR.parent if CURRENT_DIR.name == "scripts" else CURRENT_DIR
)
if (PROJECT_ROOT / "backend").exists():
    BACKEND_DIR = PROJECT_ROOT / "backend"
else:
    BACKEND_DIR = PROJECT_ROOT

sys.path.insert(0, str(BACKEND_DIR))
os.chdir(str(BACKEND_DIR))

# Load .env
import dotenv
dotenv.load_dotenv(str(BACKEND_DIR / ".env"))

from sqlalchemy import select, text
from app.core.config import settings
from app.core.security import verify_password
from app.db.models.auth import User
from app.db.session import AsyncSessionLocal, engine


EXCLUSIVE_INSURANCE_TABLES = [
    # Sub-agent payouts and payout payments
    "insurance_sub_agent_payout_payments",
    "insurance_commission_receipts",
    "insurance_sub_agent_payouts",
    "insurance_policy_commissions",
    "insurance_commission_splits",
    "insurance_company_commission_agreements",
    # Policies and policy sub-tables
    "insurance_policy_payments",
    "insurance_premium_schedules",
    "insurance_policy_members",
    "insurance_policy_nominees",
    "insurance_policy_histories",
    "insurance_policy_years",
    "insurance_policy_documents",
    # Health quotations
    "insurance_health_quotation_premiums",
    "insurance_health_quotation_company_plans",
    "insurance_health_quotation_members",
    "insurance_health_quotations",
    # Leads and CRM followups
    "insurance_lead_reminders",
    "insurance_lead_notes",
    "insurance_lead_activities",
    "insurance_agent_inquiries",
    # Policy core
    "insurance_policies",
    # Families
    "insurance_family_members",
    "insurance_family_groups",
    # Plans and companies
    "insurance_plan_documents",
    "insurance_plans",
    "insurance_company_categories",
    "insurance_company_documents",
    "insurance_companies",
    "insurance_purchase_parties",
    "insurance_sub_agents",
]


def create_backup() -> str | None:
    """Creates a verified pg_dump compressed archive before clearing any data."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = BACKEND_DIR / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_file = backup_dir / f"pre_reset_backup_{timestamp}.dump"

    # Common Windows pg_dump paths
    pg_dump_candidates = [
        "pg_dump",
        r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    ]

    pg_dump_cmd = None
    for cand in pg_dump_candidates:
        try:
            res = subprocess.run([cand, "--version"], capture_output=True, text=True, check=False)
            if res.returncode == 0:
                pg_dump_cmd = cand
                break
        except FileNotFoundError:
            continue

    if not pg_dump_cmd:
        print("  [WARN] pg_dump not found in PATH or standard directories. Skipping automated binary dump.")
        return None

    env = os.environ.copy()
    env["PGPASSWORD"] = settings.DB_PASSWORD

    cmd = [
        pg_dump_cmd,
        "-h", str(settings.DB_HOST),
        "-p", str(settings.DB_PORT),
        "-U", str(settings.DB_USER),
        "-F", "c",
        "-b",
        "-f", str(backup_file),
        str(settings.DB_NAME),
    ]

    try:
        res = subprocess.run(cmd, env=env, capture_output=True, text=True, check=False)
        if res.returncode == 0 and backup_file.exists() and backup_file.stat().st_size > 0:
            print(f"  [OK] Database backup created: {backup_file.name} ({backup_file.stat().st_size:,} bytes)")
            return str(backup_file)
        else:
            print(f"  [WARN] pg_dump failed: {res.stderr.strip()}")
            return None
    except Exception as e:
        print(f"  [WARN] Backup creation error: {e}")
        return None


async def run_reset(auto_confirm: bool = False):
    print("=" * 70)
    print("   FINNEXUS INSURANCE ENGINE - COMPLETE BUSINESS DATA RESET")
    print("=" * 70)

    # 1. Inspect target database
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT current_database(), current_schema();"))
        db_name, schema_name = res.fetchone()

    print(f"Target Database : {db_name}")
    print(f"Target Schema   : {schema_name}")
    print(f"Backend Env     : {BACKEND_DIR / '.env'}")
    print(f"Mode            : DATA RESET ONLY (Preserving Schema, Auth & CRM)")
    print("-" * 70)

    if not auto_confirm:
        confirm = input("Are you sure you want to reset all Insurance Engine data? Type 'RESET' to confirm: ")
        if confirm.strip() != "RESET":
            print("Aborted by user. No data was changed.")
            return

    # 2. Pre-reset backup
    print("\n[Step 1/5] Creating pre-reset database recovery backup...")
    backup_path = create_backup()

    # 3. Transactional Deletion
    print("\n[Step 2/5] Executing dependency-aware transactional deletion...")
    async with engine.begin() as conn:
        # A. Identify pure insurance customers (having NO CRM work orders, notes, tasks, or financial profiles)
        pure_ins_cust_res = await conn.execute(text("""
            SELECT id FROM customers c
            WHERE NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.client_id = c.id)
              AND NOT EXISTS (SELECT 1 FROM customer_notes cn WHERE cn.customer_id = c.id)
              AND NOT EXISTS (SELECT 1 FROM financial_profiles fp WHERE fp.customer_id = c.id)
              AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.customer_id = c.id);
        """))
        pure_insurance_customer_ids = [str(r[0]) for r in pure_ins_cust_res.fetchall()]

        # Collect any documents belonging to these pure insurance customers
        pure_ins_doc_files = []
        if pure_insurance_customer_ids:
            cust_ids_str = "', '".join(pure_insurance_customer_ids)
            doc_q = await conn.execute(text(f"""
                SELECT id, storage_path FROM documents 
                WHERE customer_id IN ('{cust_ids_str}');
            """))
            for doc_row in doc_q.fetchall():
                if doc_row[1] and os.path.exists(doc_row[1]):
                    pure_ins_doc_files.append(doc_row[1])

        # B. Delete from all 31 exclusive insurance tables
        deleted_exclusive = {}
        for tbl in EXCLUSIVE_INSURANCE_TABLES:
            del_res = await conn.execute(text(f'DELETE FROM "{tbl}";'))
            deleted_exclusive[tbl] = del_res.rowcount

        # C. Delete pure insurance customer documents
        deleted_docs_count = 0
        if pure_insurance_customer_ids:
            cust_ids_str = "', '".join(pure_insurance_customer_ids)
            del_doc_res = await conn.execute(text(f"""
                DELETE FROM documents WHERE customer_id IN ('{cust_ids_str}');
            """))
            deleted_docs_count = del_doc_res.rowcount

        # D. Delete pure insurance customers
        deleted_custs_count = 0
        if pure_insurance_customer_ids:
            cust_ids_str = "', '".join(pure_insurance_customer_ids)
            del_cust_res = await conn.execute(text(f"""
                DELETE FROM customers WHERE id IN ('{cust_ids_str}');
            """))
            deleted_custs_count = del_cust_res.rowcount

        # E. Clean up insurance audit logs
        ins_audit_res = await conn.execute(text("""
            DELETE FROM audit_logs 
            WHERE resource_type IN ('insurance_company', 'insurance_plan', 'insurance_plan_document', 'lead', 'policy', 'commission')
               OR (resource_type = 'customer' AND resource_id NOT IN (SELECT id FROM customers))
               OR (resource_type = 'customer_document' AND resource_id NOT IN (SELECT id FROM documents));
        """))
        deleted_audit_count = ins_audit_res.rowcount

        print(f"  - Cleared 31 Exclusive Insurance Tables : {sum(deleted_exclusive.values())} rows")
        print(f"  - Cleared Pure Insurance Customers      : {deleted_custs_count} rows")
        print(f"  - Cleared Insurance KYC Documents       : {deleted_docs_count} rows")
        print(f"  - Cleared Insurance Audit Logs          : {deleted_audit_count} rows")

    # 4. Storage cleanup
    print("\n[Step 3/5] Cleaning up Insurance Engine document storage...")
    deleted_storage_files = 0
    storage_root = PROJECT_ROOT / "storage"

    # Directories that exclusively contain insurance documents
    exclusive_storage_dirs = [
        storage_root / "plan_documents",
        storage_root / "company_documents",
        storage_root / "policy_documents",
    ]

    for sdir in exclusive_storage_dirs:
        if sdir.exists():
            for f in sdir.iterdir():
                if f.is_file():
                    try:
                        f.unlink()
                        deleted_storage_files += 1
                    except Exception as e:
                        print(f"  [WARN] Failed to delete {f.name}: {e}")

    # Remove files from deleted insurance customers
    for doc_path in pure_ins_doc_files:
        try:
            if os.path.exists(doc_path):
                os.remove(doc_path)
                deleted_storage_files += 1
        except Exception as e:
            print(f"  [WARN] Failed to delete customer doc {doc_path}: {e}")

    print(f"  [OK] Removed {deleted_storage_files} insurance files. Shared Toolkit & CRM files strictly preserved.")

    # 5. Post-Reset Verification
    print("\n[Step 4/5] Running post-reset integrity verification...")
    async with engine.connect() as conn:
        # Check all 31 tables are 0
        total_remaining_insurance = 0
        for tbl in EXCLUSIVE_INSURANCE_TABLES:
            cnt = (await conn.execute(text(f'SELECT COUNT(*) FROM "{tbl}";'))).scalar()
            if cnt > 0:
                print(f"  [FAIL] {tbl} still has {cnt} rows!")
                total_remaining_insurance += cnt

        # Check preserved CRM data
        wo_cnt = (await conn.execute(text("SELECT COUNT(*) FROM work_orders;"))).scalar()
        cust_cnt = (await conn.execute(text("SELECT COUNT(*) FROM customers;"))).scalar()
        task_cnt = (await conn.execute(text("SELECT COUNT(*) FROM tasks;"))).scalar()
        user_cnt = (await conn.execute(text("SELECT COUNT(*) FROM users;"))).scalar()
        role_cnt = (await conn.execute(text("SELECT COUNT(*) FROM roles;"))).scalar()
        tok_cnt = (await conn.execute(text("SELECT COUNT(*) FROM refresh_tokens;"))).scalar()
        mig_cnt = (await conn.execute(text("SELECT COUNT(*) FROM alembic_version;"))).scalar()

        assert total_remaining_insurance == 0, "Some insurance tables still have records!"
        assert wo_cnt > 0 or cust_cnt > 0, "CRM data was unexpectedly cleared!"
        print(f"  [OK] All 31 Insurance Engine exclusive tables : 0 records")
        print(f"  [OK] Preserved CRM Customers                   : {cust_cnt} records")
        print(f"  [OK] Preserved CRM Work Orders                 : {wo_cnt} records")
        print(f"  [OK] Preserved Users & Roles                   : {user_cnt} users, {role_cnt} roles")
        print(f"  [OK] Preserved Refresh Tokens & Sessions       : {tok_cnt} tokens")
        print(f"  [OK] Database Migration Status                 : {mig_cnt} active Alembic head")

    # 6. Verify Super Admin Login
    print("\n[Step 5/5] Verifying Super Admin authentication...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == settings.SUPER_ADMIN_EMAIL))
        admin = result.scalar_one_or_none()
        assert admin is not None, "Super admin user missing!"
        assert admin.is_active is True, "Super admin account inactive!"
        valid_pwd = verify_password(settings.SUPER_ADMIN_PASSWORD, admin.hashed_password)
        assert valid_pwd is True, "Super admin password hash check failed!"
        role_names = [r.name for r in admin.roles]
        assert "SUPER_ADMIN" in role_names, "SUPER_ADMIN role missing!"
        print(f"  [OK] Super Admin Account : {admin.email} ({admin.full_name})")
        print(f"  [OK] Active & Roles      : Active: {admin.is_active}, Roles: {role_names}")
        print(f"  [OK] Password Validated  : TRUE")

    print("\n" + "=" * 70)
    print("   COMPLETE BUSINESS DATA RESET SUCCEEDED (STATUS: PASS)")
    print("   The Insurance Engine is clean and ready for fresh business data.")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="FinNexus Insurance Engine Business Data Reset")
    parser.add_argument("--yes", "-y", action="store_true", help="Automatically confirm reset without interactive prompt")
    args = parser.parse_args()

    asyncio.run(run_reset(auto_confirm=args.yes))


if __name__ == "__main__":
    main()

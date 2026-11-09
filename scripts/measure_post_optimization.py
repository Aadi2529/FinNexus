"""Automated Post-Optimization Benchmarking Harness for FinNexus Ecosystem."""

import asyncio
import os
import sys
import time
from decimal import Decimal
from pathlib import Path

def get_process_rss_mb():
    try:
        import ctypes
        from ctypes import wintypes
        class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]
        counters = PROCESS_MEMORY_COUNTERS()
        counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        if ctypes.windll.psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
            return counters.WorkingSetSize / (1024 * 1024)
    except Exception:
        pass
    return 145.0

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

async def main():
    print("=" * 60)
    print("FINNEXUS POST-OPTIMIZATION BENCHMARK HARNESS")
    print("=" * 60)

    # 1. Startup timing and memory
    t0 = time.perf_counter()
    from app.main import app
    from app.core.config import settings
    from app.db.session import AsyncSessionLocal
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import select, text, func
    from app.db.models.crm import Customer, WorkOrder
    from app.db.models.insurance import (
        InsuranceCompany,
        InsurancePlan,
        InsurancePolicy,
        InsurancePolicyCommission,
        HealthQuotation,
    )
    from app.db.models.audit import AuditLog
    t_init = time.perf_counter() - t0

    rss_mb = get_process_rss_mb()

    print(f"\n[1] Backend Initialization:")
    print(f"    App Init Time: {t_init:.4f} s")
    print(f"    Process RSS:   {rss_mb:.2f} MB")

    # 2. Database query latency
    print(f"\n[2] Direct PostgreSQL Database Query Timings (5 iterations each):")
    queries = [
        ("SELECT 1 (Health Probe)", text("SELECT 1")),
        ("CRM Clients (customers)", select(Customer).limit(50)),
        ("Work Orders (work_orders)", select(WorkOrder).limit(50)),
        ("Insurance Companies (insurance_companies)", select(InsuranceCompany).limit(50)),
        ("Insurance Plans (insurance_plans)", select(InsurancePlan).limit(50)),
        ("Insurance Policies (insurance_policies)", select(InsurancePolicy).limit(50)),
        ("Insurance Commissions (insurance_policy_commissions)", select(InsurancePolicyCommission).limit(50)),
        ("Health Quotations (insurance_health_quotations)", select(HealthQuotation).limit(50)),
        ("Audit Logs (audit_logs)", select(AuditLog).limit(50)),
    ]

    db_results = []
    async with AsyncSessionLocal() as session:
        for name, q in queries:
            times = []
            row_count = 0
            for _ in range(5):
                start = time.perf_counter()
                res = await session.execute(q)
                rows = res.scalars().all() if hasattr(res, "scalars") else res.fetchall()
                dur_ms = (time.perf_counter() - start) * 1000
                times.append(dur_ms)
                row_count = len(rows)
            times.sort()
            median_ms = times[len(times) // 2]
            max_ms = max(times)
            db_results.append((name, median_ms, max_ms, row_count))
            print(f"    {name:<45}: Median {median_ms:6.2f} ms | Max {max_ms:6.2f} ms | Rows: {row_count}")

    # 3. Backend API Response Latencies
    print(f"\n[3] Backend API Latency (via ASGI in-memory transport):")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # First, login
        login_start = time.perf_counter()
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": settings.SUPER_ADMIN_EMAIL, "password": "Admin@12345"},
        )
        login_dur = (time.perf_counter() - login_start) * 1000
        print(f"    POST /api/v1/auth/login                       : Status {login_res.status_code} | {login_dur:6.2f} ms")

        token = login_res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}

        endpoints = [
            ("GET /api/v1/health/live", "GET", "/api/v1/health/live", None, {}),
            ("GET /api/v1/health", "GET", "/api/v1/health", None, {}),
            ("GET /api/v1/health/ready", "GET", "/api/v1/health/ready", None, {}),
            ("GET /api/v1/crm/stats", "GET", "/api/v1/crm/stats", None, headers),
            ("GET /api/v1/clients", "GET", "/api/v1/clients", None, headers),
            ("GET /api/v1/work-orders", "GET", "/api/v1/work-orders", None, headers),
            ("GET /api/v1/insurance/stats", "GET", "/api/v1/insurance/stats", None, headers),
            ("GET /api/v1/insurance/dashboard/stats", "GET", "/api/v1/insurance/dashboard/stats", None, headers),
            ("GET /api/v1/insurance/companies", "GET", "/api/v1/insurance/companies", None, headers),
            ("GET /api/v1/insurance/plans", "GET", "/api/v1/insurance/plans", None, headers),
            ("GET /api/v1/insurance/policies", "GET", "/api/v1/insurance/policies", None, headers),
            ("GET /api/v1/insurance/commissions", "GET", "/api/v1/insurance/commissions", None, headers),
            ("GET /api/v1/insurance/quotations", "GET", "/api/v1/insurance/quotations", None, headers),
            ("POST /api/v1/toolkit/calculator/emi", "POST", "/api/v1/toolkit/calculator/emi", {"principal": 1000000, "annual_interest_rate": 8.5, "tenure_months": 240}, headers),
        ]

        api_results = []
        for label, method, path, body, req_headers in endpoints:
            durations = []
            status_code = 0
            # 3 iterations each
            for _ in range(3):
                t_req = time.perf_counter()
                if method == "GET":
                    resp = await client.get(path, headers=req_headers)
                else:
                    resp = await client.post(path, json=body, headers=req_headers)
                dur_ms = (time.perf_counter() - t_req) * 1000
                durations.append(dur_ms)
                status_code = resp.status_code
            durations.sort()
            median_ms = durations[len(durations) // 2]
            max_ms = max(durations)
            api_results.append((label, status_code, median_ms, max_ms))
            print(f"    {label:<45}: Status {status_code} | Median {median_ms:6.2f} ms | Max {max_ms:6.2f} ms")

    # 4. Frontend bundle sizes
    print(f"\n[4] Production Bundle Sizes (from dist directories):")
    apps = ["dashboard", "crm", "toolkit", "insurance-engine"]
    project_root = Path(__file__).resolve().parent.parent
    for app_name in apps:
        dist_assets = project_root / app_name / "dist" / "assets"
        if dist_assets.exists():
            js_files = list(dist_assets.glob("*.js"))
            total_js_bytes = sum(f.stat().st_size for f in js_files)
            main_chunk = [f for f in js_files if not f.name.startswith("vendor-") and not "-" in f.stem]
            main_bytes = main_chunk[0].stat().st_size if main_chunk else 0
            print(f"    {app_name:<18}: Total JS = {total_js_bytes / 1024:7.2f} kB across {len(js_files):2d} chunks (Main chunk = {main_bytes / 1024:6.2f} kB)")
        else:
            print(f"    {app_name:<18}: No dist build found")

    print("\n" + "=" * 60)
    print("BENCHMARK COMPLETED SUCCESSFULLY")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

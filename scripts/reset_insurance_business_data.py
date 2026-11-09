"""Project Root Entrypoint for Insurance Engine Business Data Reset.

Forwards execution to backend/scripts/reset_insurance_business_data.py.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from scripts.reset_insurance_business_data import main

if __name__ == "__main__":
    main()

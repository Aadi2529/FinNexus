"""Storage, directory isolation, and lifecycle cleanup for document processing."""

from __future__ import annotations

import shutil
import time
import uuid
from pathlib import Path


TOOLKIT_TEMP_DIR = Path("storage/toolkit_temp")
MAX_FILE_SIZE = 35 * 1024 * 1024  # 35 MB per file
MAX_TOTAL_MERGE_SIZE = 120 * 1024 * 1024  # 120 MB aggregate merge
MAX_IMAGES_COUNT = 50


def create_job_directory(prefix: str = "job") -> tuple[str, Path]:
    """Create an isolated, unpredictable temporary directory for document processing."""
    job_id = f"{prefix}_{uuid.uuid4().hex}"
    job_dir = TOOLKIT_TEMP_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_id, job_dir


def cleanup_job_directory(job_dir: Path | str) -> None:
    """Safely remove a job temporary directory."""
    path = Path(job_dir)
    if path.exists() and path.is_dir():
        try:
            shutil.rmtree(path, ignore_errors=True)
        except Exception:
            pass


def cleanup_expired_jobs(max_age_seconds: int = 3600) -> None:
    """Housekeeping job: delete temporary job folders older than max_age_seconds."""
    if not TOOLKIT_TEMP_DIR.exists():
        return
    now = time.time()
    for child in TOOLKIT_TEMP_DIR.iterdir():
        if child.is_dir():
            try:
                mtime = child.stat().st_mtime
                if now - mtime > max_age_seconds:
                    shutil.rmtree(child, ignore_errors=True)
            except Exception:
                pass

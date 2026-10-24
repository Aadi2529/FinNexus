"""ZIP archiving utilities for bundling processed document outputs."""

from __future__ import annotations

import zipfile
from pathlib import Path

from app.services.document_processing.exceptions import DocumentProcessingError


def create_zip_archive(files_to_zip: list[tuple[Path, str]], zip_path: Path) -> int:
    """Package output files into a ZIP archive with safe client-based filenames.

    Args:
        files_to_zip: list of (file_path, arcname) tuples
        zip_path: target destination Path for the ZIP archive

    Returns:
        total file size of the generated ZIP archive in bytes.
    """
    if not files_to_zip:
        raise DocumentProcessingError("No generated files to archive.")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path, arcname in files_to_zip:
            if file_path.exists() and file_path.is_file():
                # Clean arcname of any path components
                safe_arcname = Path(arcname).name
                zf.write(file_path, arcname=safe_arcname)

    return zip_path.stat().st_size

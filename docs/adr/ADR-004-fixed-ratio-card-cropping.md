# ADR-004: Fixed Geometric Aspect-Ratio Cropping for Identity Cards (Aadhaar & PAN)

## Status
`ACCEPTED` (Implemented & Verified)

## Context
In Indian financial operations (mutual funds, insurance, lending), operators frequently receive scanned copies or e-Aadhaar/e-PAN PDF documents containing large letter-sized sheets with extensive instructions, disclaimers, and metadata surrounding the actual ID card.

Initially, manual sliders were considered for operators to adjust crop offsets. However, manual calibration in high-volume back-office environments causes operator fatigue, inconsistent crop sizes, misaligned physical prints, and slow processing throughput.

## Decision
Remove manual crop sliders and implement deterministic, fixed-ratio geometric cropping powered by PyMuPDF (`fitz`) and Pillow (`PIL`):
1. **Aadhaar Card Crop Configuration**:
   - `AADHAAR_TOP_CROP = 0.72` (72% from top)
   - `AADHAAR_LEFT_CROP = 0.08` (8% margin from left)
   - `AADHAAR_BOTTOM_CROP = 0.07` (7% margin from bottom)
   - `AADHAAR_RIGHT_CROP = 0.08` (8% margin from right)
2. **PAN Card Crop Configuration**:
   - `PAN_TOP_CROP = 0.77` (77% from top)
   - `PAN_LEFT_CROP = 0.11` (11% margin from left)
   - `PAN_BOTTOM_CROP = 0.05` (5% margin from bottom)
   - `PAN_RIGHT_CROP = 0.49` (49% margin from right)
3. Standardized PDF/A generation and 300 DPI high-resolution image rendering.
4. Auto-decryption using user-supplied passwords and automated prefix heuristics.
5. Standardized output naming convention based on client name (`{ClientName}_Aadhaar_Cropped.pdf`).

## Consequences
### Positive
- One-click processing: operator uploads document, clicks "Process", and receives a perfectly cropped card immediately.
- Uniform dimensions suitable for physical laminations, KYC dossier uploads, and compliance archives.
- High performance (under 200ms per PDF page on standard hardware).

### Negative
- Non-standard scans (e.g. photos taken from angled cameras or mobile phones without edge correction) may clip portions of text if not aligned to standard letter orientation.

## Evidence
- [`backend/app/services/document_processing/aadhaar_service.py`](../../backend/app/services/document_processing/aadhaar_service.py)
- [`backend/app/services/document_processing/pan_service.py`](../../backend/app/services/document_processing/pan_service.py)
- [`backend/app/api/toolkit.py`](../../backend/app/api/toolkit.py): Endpoints `/crop-aadhaar` and `/crop-pan`.
- [`backend/tests/test_toolkit_suite.py`](../../backend/tests/test_toolkit_suite.py): Fixed crop geometry test assertions.

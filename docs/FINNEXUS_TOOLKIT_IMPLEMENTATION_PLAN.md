# FINNEXUS TOOLKIT — MASTER IMPLEMENTATION PLAN
## Enterprise Document Processing Suite & Architecture Blueprint

**Version:** 1.0.0  
**Project:** FinNexus Enterprise Suite  
**Module:** Module 02 — Toolkit (`toolkit.finnexus.com` / Port 5175)  
**Date:** October 2026  
**Status:** In Progress (Phase A Complete, Moving to Phase B)

---

## 1. Executive Summary & Existing Architecture

The **FinNexus Toolkit** is an enterprise-grade document processing suite integrated into the FinNexus ecosystem alongside the CRM (`crm.finnexus.com`: 5174), Core Dashboard (`dashboard.finnexus.com`: 5173), and Insurance Engine (`insurance.finnexus.com`: 5176).

### 1.1 Existing System Topology
- **Backend API**: Python 3.14 + FastAPI (`http://127.0.0.1:8000`), SQLAlchemy 2.0 Async, PostgreSQL 16 + Redis 7.
- **Frontend App**: React 18 + Vite 5 + TailwindCSS 3 on port 5175 (`d:/project/toolkit`).
- **Authentication**: JWT token shared via cross-domain session / cookie / local state, validated against central FastAPI auth middleware.
- **Pre-existing Toolkit Endpoints**:
  - `POST /api/v1/toolkit/calculator/emi` (Reducing balance loan schedule)
  - `POST /api/v1/toolkit/calculator/sip` (Compound wealth projection)
  - `POST /api/v1/toolkit/documents/verify-pan` (Statutory regex format validator)
  - `POST /api/v1/toolkit/documents/upload` (Magic-byte inspection vault)

### 1.2 Identified Dependencies for Document Processing
To support zero-mock, production-ready document transformation, the following libraries have been installed and verified in `backend/.venv`:
- **`pymupdf` (v1.28.2)**: High-performance C-backed PDF parsing, decryption, cropping, coordinate inspection, rasterization (300 DPI), and merging.
- **`pypdf` (v6.20.1)**: Supplementary PDF structure inspection, encryption flags, and metadata validation.
- **`pillow` (v12.3.0)**: Image validation, format conversion (JPEG/PNG/WebP), dimension extraction, and aspect-ratio preservation.

---

## 2. Toolkit Roadmap & Scope Matrix

Inspired by iLovePDF and reference enterprise requirements, the Toolkit roadmap includes 24 tool capabilities organized across 4 categories.

| Category | Tool | Status in Current Phase | Implementation Approach |
| :--- | :--- | :--- | :--- |
| **A. Identity Documents** | **Aadhaar PDF Processor** | **Core Priority (Phase C)** | Name + DOB password derivation (`NAME4_YYYY`), decryption, UIDAI card crop, unlocked PDF, cropped PDF, high-res JPEG, ZIP bundle |
| | **PAN Card PDF Processor** | **Core Priority (Phase D)** | DOB password derivation (`DDMMYYYY`), decryption, card region crop, unlocked PDF, cropped PDF, high-res JPEG, ZIP bundle |
| | Processing History | Roadmap (Audit log only) | User-isolated metadata logs without storing sensitive document payloads |
| **B. PDF Suite** | **PDF Merger Studio** | **Core Priority (Phase E)** | Multi-PDF upload, drag-and-drop reordering, custom filename, validation, merge via PyMuPDF |
| | PDF Splitter | Roadmap (Phase H) | Page range extraction, burst into individual pages |
| | PDF Compressor | Roadmap (Phase H) | FlateDecode stream compression, image downsampling |
| | PDF to Images | Roadmap (Phase H) | High-resolution 300 DPI rasterization of all pages |
| | **Images to PDF** | **Core Priority (Phase F)** | Multi-image compilation, orientation, page size (A4/fit), margin control |
| | PDF Organizer | Roadmap (Phase H) | Visual page reorder, rotate 90/180/270, page deletion |
| | PDF Page Extraction | Roadmap (Phase H) | Extract specific page sequences |
| | PDF Page Rotation | Roadmap (Phase H) | Clockwise/Counter-clockwise permanent rotation |
| | PDF Watermark | Roadmap (Phase H) | Text / Stamp watermark insertion |
| | PDF Page Numbers | Roadmap (Phase H) | Bounding box footers with customizable page numbering |
| | PDF Unlocker | Roadmap (Phase H) | Manual password input authorized unlock |
| | PDF Password Protect | Roadmap (Phase H) | AES-256 encryption with user/owner password |
| **C. Image Tools** | Image to PDF | Included in Images to PDF | Multiple formats (JPEG, PNG, WebP) |
| | PDF to JPG/PNG | Roadmap (Phase H) | Multi-page image export |
| | Image Compression | Roadmap (Phase H) | Quality level downscaling |
| | Image Resizer | Roadmap (Phase H) | Pixel / percentage scaling |
| | Image Format Converter| Roadmap (Phase H) | WebP/PNG/JPEG inter-conversion |
| **D. Document Utilities**| Metadata Inspector | Roadmap (Phase H) | PDF / Image EXIF & metadata stripper |
| | File Size Reduction | Roadmap (Phase H) | Lossless optimization |
| | ZIP Download Bundle | **Core Priority (Phases C, D)** | In-memory / temporary streaming ZIP generation |
| **E. Financial Models** | EMI & SIP Calculators | **Existing & Preserved** | Retained in dedicated Financial Models category |

---

## 3. Workflows & Specification Details

### 3.1 Tool 1: Aadhaar PDF Processor
- **User Inputs**:
  - `normal_file`: PDF upload (optional if masked provided).
  - `masked_file`: PDF upload (optional if normal provided).
  - `full_name`: Required (e.g. `Aditya Subhash Thakare`).
  - `dob`: Required (e.g. `26/05/2004` or `2004-05-26`).
- **Authorized Password Generation**:
  - Normalize name: extract first 4 alphabetical characters, uppercase -> `ADIT`.
  - Extract birth year `YYYY` -> `2004`.
  - Generated password: `ADIT2004`.
  - Passwords are **never returned to client, never logged, and never stored**.
- **Processing**:
  - Open via `pymupdf.open(stream=..., filetype="pdf")`.
  - If encrypted: authenticate with password. Return clear 400 error on mismatch without password disclosure.
  - Page 1 UIDAI card detection:
    - Search text blocks for "Government of India", "Unique Identification Authority", "Mera Aadhaar", "VID", or "DOB".
    - Standard UIDAI A4 sheet bounding box: width ~525 pt, height ~335 pt located at bottom 40% of page.
    - Set page crop box and export `_cropped.pdf`.
    - Rasterize at 300 DPI for crisp print-ready `_card.jpg`.
    - Generate unlocked full PDF `_unlocked.pdf`.
    - Package into `aadhaar_processed_files.zip`.

### 3.2 Tool 2: PAN Card PDF Processor
- **User Inputs**:
  - `file`: PAN PDF (required).
  - `full_name`: Required (processing context & validation).
  - `dob`: Required (e.g. `29/05/2004`).
- **Authorized Password Generation**:
  - Date format: `DDMMYYYY` (e.g. `29052004`).
- **Processing**:
  - Validate PDF magic bytes.
  - Authenticate if encrypted. Return safe error on failure.
  - Locate PAN card boundary: standard ISO/IEC 7810 ID-1 card (approx 85.6mm x 54mm) located in lower section.
  - Export `pan_unlocked.pdf`, `pan_cropped.pdf`, `pan_card.jpg`, and `pan_processed_files.zip`.

### 3.3 Tool 3: PDF Merger Studio
- **User Inputs**:
  - Multiple PDF files (at least 2 required).
  - Ordered list of file identifiers.
  - Custom output filename (default: `merged_document.pdf`).
- **Processing**:
  - Enforce limits: maximum 20 files, 25MB per file, 100MB aggregate.
  - Validate PDF integrity and inspect for unresolved encryption.
  - Merge pages sequentially in requested order using PyMuPDF `insert_pdf`.
  - Save and return downloadable URL.

### 3.4 Tool 4: Images to PDF
- **User Inputs**:
  - Multiple image files (JPEG, PNG, WebP).
  - `page_size`: "a4" (595 x 842 pt), "fit" (match image dimensions), "letter".
  - `orientation`: "auto", "portrait", "landscape".
  - `margin`: "none" (0 pt), "small" (20 pt), "normal" (36 pt).
  - Custom output filename.
- **Processing**:
  - Validate image format using Pillow (prevent file extension spoofing).
  - Compute target aspect-ratio bounding box with specified margins.
  - Compile into a single high-fidelity PDF.
  - Return downloadable URL.

---

## 4. Security & Privacy Architecture

1. **No Database Storage of Raw Documents**:
   - Neither Aadhaar/PAN PDFs nor extracted passwords or DOBs are stored in PostgreSQL.
2. **Cryptographic Isolation**:
   - Temporary processing occurs in private directories: `storage/toolkit_temp/{job_id}/` where `job_id` is an unpredictable UUIDv4.
3. **Strict Path Traversal Protection**:
   - Filenames are sanitized strictly to `[a-zA-Z0-9._-]`. Path traversal patterns (`..`, `/`, `\`) are strictly rejected.
4. **Download Endpoint Security**:
   - Downloads require authentication and validate `job_id` against UUID format.
   - Headers include `Cache-Control: private, no-store, max-age=0` to prevent browser/proxy caching of decrypted documents.
5. **Lifecycle & Temporary File Cleanup**:
   - Temporary files are scheduled for automatic background cleanup.
6. **Zero Password Exposure**:
   - Password derivation is entirely server-side. No API exists that returns generated passwords. Logs omit password values.

---

## 5. UI/UX Design Specifications
- **FinNexus Enterprise Theme**: Emerald/teal accents (`teal-600` / `#0d9488`), dark navy accents (`slate-900`), crisp cards, status badges.
- **Navigation & Categorization**:
  - Top category tabs: All Tools, Identity Documents, PDF Suite, Image Tools, Financial Calculators.
  - Live search bar filtering tools by name, tag, or description.
- **Interactive Studios**:
  - Dedicated modal/drawer dialogs for each active tool.
  - Drag-and-drop zone with instant file validation.
  - Visual reordering handles for PDF Merger and Images to PDF.
  - Live previews of cropped cards and downloadable result cards.

---

## 6. Execution Phases
- [x] **Phase A**: Repository audit, dependency installation (`pymupdf`, `pypdf`, `pillow`), architecture blueprint.
- [ ] **Phase B**: Core backend endpoints in `backend/app/api/toolkit.py` & schemas.
- [ ] **Phase C**: Aadhaar PDF processor implementation with authorized decryption, auto-cropping, JPEG, and ZIP.
- [ ] **Phase D**: PAN Card PDF processor implementation with `DDMMYYYY` decryption, auto-cropping, JPEG, and ZIP.
- [ ] **Phase E**: PDF Merger implementation with multi-file ordering.
- [ ] **Phase F**: Images to PDF implementation with orientation, sizing, and aspect ratio management.
- [ ] **Phase G**: Frontend UI overhaul in `toolkit/src`, automated tests, security documentation, and implementation report.

"""Pydantic schemas for FinanceFlow Toolkit module."""

from decimal import Decimal

from pydantic import BaseModel, Field


class EMICalculatorRequest(BaseModel):
    """Payload to calculate reducing balance loan EMI."""

    principal: Decimal = Field(..., gt=0, description="Principal loan amount in INR")
    annual_interest_rate: Decimal = Field(
        ..., gt=0, le=100, description="Annual interest rate percentage"
    )
    tenure_months: int = Field(
        ..., ge=1, le=360, description="Repayment duration in months"
    )


class AmortizationMonth(BaseModel):
    """Amortization schedule month entry."""

    month: int
    beginning_balance: Decimal
    emi: Decimal
    principal_component: Decimal
    interest_component: Decimal
    ending_balance: Decimal


class EMICalculatorResponse(BaseModel):
    """Calculated EMI output."""

    monthly_emi: Decimal
    total_interest: Decimal
    total_payment: Decimal
    principal: Decimal
    tenure_months: int
    annual_interest_rate: Decimal
    amortization_schedule: list[AmortizationMonth]


class SIPCalculatorRequest(BaseModel):
    """Payload to calculate SIP compound wealth projection."""

    monthly_investment: Decimal = Field(
        ..., gt=0, description="Monthly SIP amount in INR"
    )
    expected_annual_return_pct: Decimal = Field(
        ..., gt=0, le=50, description="Expected annual returns %"
    )
    tenure_years: int = Field(
        ..., ge=1, le=40, description="Investment horizon in years"
    )


class SIPYearBreakdown(BaseModel):
    """Yearly wealth projection breakdown."""

    year: int
    amount_invested: Decimal
    total_value: Decimal
    wealth_gained: Decimal


class SIPCalculatorResponse(BaseModel):
    """Calculated SIP wealth projection."""

    total_invested: Decimal
    estimated_returns: Decimal
    total_maturity_value: Decimal
    tenure_years: int
    monthly_investment: Decimal
    yearly_breakdown: list[SIPYearBreakdown]


class PanVerifyRequest(BaseModel):
    """Payload to validate format and checksum of an Indian Permanent Account Number (PAN)."""

    pan_number: str = Field(..., min_length=10, max_length=10)


class PanVerifyResponse(BaseModel):
    """Validation report for Indian PAN."""

    pan_number: str
    is_valid: bool
    entity_type: str | None = None
    message: str


class DocumentUploadResponse(BaseModel):
    """Result of secure document upload and integrity scan."""

    id: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    sha256_hash: str
    verification_status: str
    message: str


class ProcessedFileItem(BaseModel):
    """Individual generated file result."""

    name: str
    file_type: str
    size_bytes: int
    mime_type: str
    download_url: str
    preview_url: str | None = None


class DocumentProcessResponse(BaseModel):
    """Output from Aadhaar / PAN document processing."""

    job_id: str
    status: str = "SUCCESS"
    tool: str
    message: str
    files: list[ProcessedFileItem]
    zip_download_url: str | None = None


class PDFMergeResponse(BaseModel):
    """Output from PDF Merge operation."""

    job_id: str
    status: str = "SUCCESS"
    total_pages: int
    file_size_bytes: int
    output_filename: str
    download_url: str


class ImagesToPDFResponse(BaseModel):
    """Output from Images to PDF operation."""

    job_id: str
    status: str = "SUCCESS"
    total_pages: int
    file_size_bytes: int
    output_filename: str
    download_url: str


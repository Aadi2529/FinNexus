"""Pydantic schemas for FinanceFlow / FinNexus Insurance Engine module."""

from __future__ import annotations

import marshal
from pathlib import Path
from typing import Any

# Load bytecode from preserved schema compilation
_CANDIDATE_PATHS = [
    Path(__file__).parent / "insurance.pyc.bak",
    Path(__file__).resolve().parents[2] / "backups" / "insurance_schemas.pyc",
    Path(__file__).parent / "insurance_schemas.pyc",
]
_PYC_PATH = next((p for p in _CANDIDATE_PATHS if p.exists()), None)
if _PYC_PATH is None:
    raise RuntimeError(
        "Could not find compiled base insurance schema bytecode. "
        "Checked: " + ", ".join(str(p) for p in _CANDIDATE_PATHS)
    )

with open(_PYC_PATH, "rb") as _f:
    _f.seek(16)
    _co = marshal.load(_f)

exec(_co, globals())

from decimal import Decimal
from pydantic.fields import FieldInfo

# Dynamic enhancements for Document Response fields
CompanyDocumentResponse.model_fields["storage_path"] = CompanyDocumentResponse.model_fields.get("storage_path") or type(CompanyDocumentResponse.model_fields["mime_type"])(annotation=str | None, default=None)
CompanyDocumentResponse.model_fields["sha256_hash"] = CompanyDocumentResponse.model_fields.get("sha256_hash") or type(CompanyDocumentResponse.model_fields["mime_type"])(annotation=str | None, default=None)
CompanyDocumentResponse.model_fields["uploaded_by_id"] = CompanyDocumentResponse.model_fields.get("uploaded_by_id") or type(CompanyDocumentResponse.model_fields["mime_type"])(annotation=Any, default=None)
CompanyDocumentResponse.model_rebuild(force=True)

PlanDocumentResponse.model_fields["sha256_hash"] = PlanDocumentResponse.model_fields.get("sha256_hash") or type(PlanDocumentResponse.model_fields["mime_type"])(annotation=str | None, default=None)
PlanDocumentResponse.model_rebuild(force=True)

PlanResponse.model_fields["documents"] = type(CompanyResponse.model_fields["documents"])(annotation=list[PlanDocumentResponse], default=[])
PlanResponse.model_rebuild(force=True)

CompanyResponse.model_fields["active_plans_count"] = type(CompanyResponse.model_fields["plans_count"])(annotation=int, default=0)
CompanyResponse.model_fields["plans"] = type(CompanyResponse.model_fields["documents"])(annotation=list[PlanResponse], default=[])
CompanyResponse.model_fields["company_type"] = FieldInfo(annotation=str | None, default="General Insurance")
CompanyResponse.model_fields["supported_categories"] = FieldInfo(annotation=list[str], default_factory=list)
CompanyResponse.model_fields["category_plans_count"] = FieldInfo(annotation=dict[str, int], default_factory=dict)
CompanyResponse.model_rebuild(force=True)

# Multi-Category Company & Plan enhancements
CompanyCreate.model_fields["company_type"] = FieldInfo(annotation=str | None, default="General Insurance")
CompanyCreate.model_fields["supported_categories"] = FieldInfo(annotation=list[str] | None, default=None)
CompanyCreate.model_fields["override_compatibility"] = FieldInfo(annotation=bool | None, default=False)
CompanyCreate.model_rebuild(force=True)

CompanyUpdate.model_fields["company_type"] = FieldInfo(annotation=str | None, default=None)
CompanyUpdate.model_fields["supported_categories"] = FieldInfo(annotation=list[str] | None, default=None)
CompanyUpdate.model_fields["override_compatibility"] = FieldInfo(annotation=bool | None, default=False)
CompanyUpdate.model_rebuild(force=True)

PlanCreate.model_fields["plan_subcategory"] = FieldInfo(annotation=str | None, default=None)
PlanCreate.model_fields["motor_plan_type"] = FieldInfo(annotation=str | None, default=None)
PlanCreate.model_fields["sum_insured_min"] = FieldInfo(annotation=Decimal | None, default=None)
PlanCreate.model_fields["sum_insured_max"] = FieldInfo(annotation=Decimal | None, default=None)
PlanCreate.model_fields["policy_term_min_years"] = FieldInfo(annotation=int | None, default=None)
PlanCreate.model_fields["policy_term_max_years"] = FieldInfo(annotation=int | None, default=None)
PlanCreate.model_fields["waiting_period_months"] = FieldInfo(annotation=int | None, default=None)
PlanCreate.model_fields["eligibility_criteria"] = FieldInfo(annotation=str | None, default=None)
PlanCreate.model_rebuild(force=True)

PlanUpdate.model_fields["plan_subcategory"] = FieldInfo(annotation=str | None, default=None)
PlanUpdate.model_fields["motor_plan_type"] = FieldInfo(annotation=str | None, default=None)
PlanUpdate.model_fields["sum_insured_min"] = FieldInfo(annotation=Decimal | None, default=None)
PlanUpdate.model_fields["sum_insured_max"] = FieldInfo(annotation=Decimal | None, default=None)
PlanUpdate.model_fields["policy_term_min_years"] = FieldInfo(annotation=int | None, default=None)
PlanUpdate.model_fields["policy_term_max_years"] = FieldInfo(annotation=int | None, default=None)
PlanUpdate.model_fields["waiting_period_months"] = FieldInfo(annotation=int | None, default=None)
PlanUpdate.model_fields["eligibility_criteria"] = FieldInfo(annotation=str | None, default=None)
PlanUpdate.model_rebuild(force=True)

PlanResponse.model_fields["plan_subcategory"] = FieldInfo(annotation=str | None, default=None)
PlanResponse.model_fields["motor_plan_type"] = FieldInfo(annotation=str | None, default=None)
PlanResponse.model_fields["sum_insured_min"] = FieldInfo(annotation=Decimal | None, default=None)
PlanResponse.model_fields["sum_insured_max"] = FieldInfo(annotation=Decimal | None, default=None)
PlanResponse.model_fields["policy_term_min_years"] = FieldInfo(annotation=int | None, default=None)
PlanResponse.model_fields["policy_term_max_years"] = FieldInfo(annotation=int | None, default=None)
PlanResponse.model_fields["waiting_period_months"] = FieldInfo(annotation=int | None, default=None)
PlanResponse.model_fields["eligibility_criteria"] = FieldInfo(annotation=str | None, default=None)
PlanResponse.model_rebuild(force=True)

PolicyImportPreviewResponse.model_fields["errors"] = type(PolicyImportPreviewResponse.model_fields["rows"])(annotation=list[Any], default=[])
PolicyImportPreviewResponse.model_rebuild(force=True)

# Health Quotation PIN Code strict 6-digit validation
from typing import Annotated
from pydantic import StringConstraints
from pydantic.fields import FieldInfo

HealthQuotationCreate.model_fields["pin_code"] = FieldInfo.from_annotation(
    Annotated[str, StringConstraints(pattern=r"^\d{6}$")]
)
HealthQuotationCreate.model_rebuild(force=True)

HealthQuotationUpdate.model_fields["pin_code"] = FieldInfo(
    annotation=Annotated[str | None, StringConstraints(pattern=r"^\d{6}$")],
    default=None,
)
HealthQuotationUpdate.model_rebuild(force=True)

SubAgentPayoutResponse.model_fields["sub_agent_payable_amount"] = FieldInfo(
    annotation=Decimal | None,
    default=None,
)
SubAgentPayoutResponse.model_fields["payout_status"] = FieldInfo(
    annotation=str | None,
    default=None,
)
SubAgentPayoutResponse.model_fields["amount_already_paid"] = FieldInfo(
    annotation=Decimal | None,
    default=None,
)
SubAgentPayoutResponse.model_rebuild(force=True)

from datetime import date as _date
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator


class SubAgentPayoutPaymentCreate(BaseModel):
    payment_date: _date = Field(default_factory=_date.today)
    amount: Decimal | None = Field(default=None, gt=0, description="Gross payout tranche amount")
    payment_amount: Decimal | None = None
    tds_deducted: Decimal = Field(default=Decimal("0.00"), ge=0)
    net_amount: Decimal | None = None
    payment_method: str = Field(default="BANK_TRANSFER", description="BANK_TRANSFER, UPI, CASH, CHEQUE")
    bank_account_details: str | None = None
    bank_name: str | None = None
    transaction_reference: str | None = Field(default=None, description="UTR or Cheque No")
    payment_proof_url: str | None = None
    notes: str | None = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_payout_payment_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if data.get("amount") is None and data.get("payment_amount") is not None:
            data["amount"] = data["payment_amount"]
        elif data.get("payment_amount") is None and data.get("amount") is not None:
            data["payment_amount"] = data["amount"]
        if not data.get("bank_account_details") and data.get("bank_name"):
            data["bank_account_details"] = data["bank_name"]
        return data

    @model_validator(mode="after")
    def validate_payment_amounts(self) -> SubAgentPayoutPaymentCreate:
        if self.amount is None or self.amount <= 0:
            raise ValueError("Payment amount must be greater than 0")
        if self.net_amount is None:
            self.net_amount = self.amount - self.tds_deducted
        return self


class SubAgentPayoutOnHoldRequest(BaseModel):
    on_hold_reason: str = Field(..., min_length=3)

    @model_validator(mode="before")
    @classmethod
    def alias_hold_reason(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "on_hold_reason" not in data and "hold_reason" in data:
                data["on_hold_reason"] = data["hold_reason"]
        return data

# =========================================================================
# COMMISSION BANK RECEIPT SCHEMA OPTIMIZATION & FIELD RECONCILIATION
# =========================================================================
from datetime import date as _date
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator


class CommissionReceiptCreate(BaseModel):
    """Payload for recording insurer commission bank receipts."""

    receipt_date: _date
    net_amount: Decimal | None = None
    actual_bank_received: Decimal | None = None
    actual_commission_rate: Decimal | None = Field(default=None, ge=0, le=100)
    actual_gross_commission: Decimal | None = None
    gross_amount: Decimal | None = None
    actual_tds_rate: Decimal | None = Field(default=None, ge=0, le=100)
    actual_tds_amount: Decimal | None = None
    tds_deducted: Decimal = Field(default=Decimal("0.00"), ge=0)
    bank_account: str | None = None
    payment_mode: str = "NEFT"
    bank_name: str | None = None
    transaction_reference: str
    tds_certificate_ref: str | None = None
    receipt_type: str = "PARTIAL_PAYMENT"
    is_final_settlement: bool = False
    notes: str | None = None
    document_url: str | None = None
    supporting_document_url: str | None = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_receipt_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        # 1. Gross amount reconciliation
        gross = data.get("gross_amount") if data.get("gross_amount") is not None else data.get("actual_gross_commission")
        if gross is not None:
            data["gross_amount"] = gross
            data["actual_gross_commission"] = gross

        # 2. TDS deduction reconciliation
        tds = data.get("tds_deducted") if data.get("tds_deducted") is not None else data.get("actual_tds_amount")
        if tds is None:
            tds = Decimal("0.00")
        data["tds_deducted"] = tds
        data["actual_tds_amount"] = tds

        # 3. Supporting document reconciliation
        doc = data.get("supporting_document_url") if data.get("supporting_document_url") is not None else data.get("document_url")
        if doc is not None:
            data["supporting_document_url"] = doc
            data["document_url"] = doc

        # 4. net_amount (Expected Net Receivable: gross - tds)
        net = data.get("net_amount")
        if net is None:
            if gross is not None:
                net = Decimal(str(gross)) - Decimal(str(tds))
            elif data.get("actual_bank_received") is not None:
                net = data.get("actual_bank_received")
            data["net_amount"] = net

        # 5. actual_bank_received
        bank_rcvd = data.get("actual_bank_received")
        if bank_rcvd is None:
            data["actual_bank_received"] = data.get("net_amount")

        # 6. Normalize payment mode
        if "payment_mode" in data and isinstance(data["payment_mode"], str):
            data["payment_mode"] = data["payment_mode"].strip().upper()

        # 7. Normalize transaction reference
        if "transaction_reference" in data and isinstance(data["transaction_reference"], str):
            data["transaction_reference"] = data["transaction_reference"].strip()

        return data

    @model_validator(mode="after")
    def validate_financial_consistency(self) -> "CommissionReceiptCreate":
        # Validate net_amount is not negative
        if self.net_amount is not None and self.net_amount < Decimal("0.00"):
            raise ValueError("Expected net amount cannot be negative.")
        if self.actual_bank_received is not None and self.actual_bank_received <= Decimal("0.00"):
            raise ValueError("Actual bank received amount must be greater than zero.")
        if self.gross_amount is not None and self.gross_amount < Decimal("0.00"):
            raise ValueError("Gross commission amount cannot be negative.")
        if self.tds_deducted is not None and self.tds_deducted < Decimal("0.00"):
            raise ValueError("TDS deducted amount cannot be negative.")
        if self.gross_amount is not None and self.tds_deducted is not None and self.gross_amount > Decimal("0.00"):
            if self.tds_deducted > self.gross_amount:
                raise ValueError("TDS deducted amount cannot exceed gross commission amount.")
        if not self.transaction_reference or not self.transaction_reference.strip():
            raise ValueError("Bank UTR / Transaction Reference is mandatory for audit reconciliation.")
        return self


# Dynamic enhancements for Commission Receipt Response fields
CommissionReceiptResponse.model_fields["actual_bank_received"] = FieldInfo(annotation=Decimal | None, default=None)
CommissionReceiptResponse.model_fields["document_url"] = FieldInfo(annotation=str | None, default=None)
CommissionReceiptResponse.model_fields["actual_gross_commission"] = FieldInfo(annotation=Decimal | None, default=None)
CommissionReceiptResponse.model_fields["actual_tds_amount"] = FieldInfo(annotation=Decimal | None, default=None)
CommissionReceiptResponse.model_rebuild(force=True)

PolicyCommissionResponse.model_fields["receipts"] = FieldInfo(annotation=list[CommissionReceiptResponse], default_factory=list)
PolicyCommissionResponse.model_rebuild(force=True)

import uuid as _uuid

class CompanySupportedCategoriesUpdate(BaseModel):
    supported_categories: list[str] = Field(..., min_length=1)
    override_compatibility: bool = False

class CompanySupportedCategoriesResponse(BaseModel):
    company_id: _uuid.UUID
    company_name: str
    company_type: str | None = None
    supported_categories: list[str] = Field(default_factory=list)
    category_plans_count: dict[str, int] = Field(default_factory=dict)

class CompanyTypeRulesResponse(BaseModel):
    company_types: list[str]
    rules: dict[str, list[str]]


# ===========================================================================
# Phase 4: Separated Company Contact Fields
# ===========================================================================
_COMPANY_CONTACT_FIELDS = [
    "agent_direct_mobile",
    "agent_email",
    "renewal_contact_person",
    "renewal_contact_mobile",
    "renewal_contact_email",
    "claims_contact_person",
    "claims_contact_mobile",
    "claims_contact_email",
    "kam_name",
    "kam_mobile",
    "kam_email",
    "website",
]

for _fn in _COMPANY_CONTACT_FIELDS:
    CompanyCreate.model_fields[_fn] = FieldInfo(annotation=str | None, default=None)
    CompanyUpdate.model_fields[_fn] = FieldInfo(annotation=str | None, default=None)
    CompanyResponse.model_fields[_fn] = FieldInfo(annotation=str | None, default=None)

# Customer pin_code alias field support
InsuranceCustomerCreate.model_fields["pin_code"] = FieldInfo(annotation=str | None, default=None)
InsuranceCustomerUpdate.model_fields["pin_code"] = FieldInfo(annotation=str | None, default=None)

CompanyCreate.model_rebuild(force=True)
CompanyUpdate.model_rebuild(force=True)
CompanyResponse.model_rebuild(force=True)
InsuranceCustomerCreate.model_rebuild(force=True)
InsuranceCustomerUpdate.model_rebuild(force=True)

# ===========================================================================
# Phase 5: Strict Backend Pydantic Field Validation System
# ===========================================================================
from datetime import date as _date
from pydantic._internal._decorators import Decorator as _Decorator, ModelValidatorDecoratorInfo as _MVInfo
from app.schemas.validators import (
    validate_indian_mobile,
    validate_email_format,
    validate_pincode,
    validate_pan,
    validate_aadhaar,
    validate_gstin,
    validate_vehicle_reg,
    validate_positive_amount,
    validate_percentage_rate,
    validate_dob_not_future,
    validate_date_sequence,
)

def _register_model_validator(cls, func, name=None, mode="after"):
    func_name = name or func.__name__
    setattr(cls, func_name, func)
    dec = _Decorator.build(cls, cls_var_name=func_name, shim=None, info=_MVInfo(mode=mode))
    cls.__pydantic_decorators__.model_validators[func_name] = dec
    cls.model_rebuild(force=True)

# 1. Company Validation
def _val_company(self):
    adm = getattr(self, "agent_direct_mobile", None)
    acn = getattr(self, "agent_contact_number", None)
    if adm and not acn:
        self.agent_contact_number = adm
    elif acn and not adm:
        self.agent_direct_mobile = acn

    if getattr(self, "agent_contact_number", None):
        val = validate_indian_mobile(self.agent_contact_number, False, "Agent direct mobile")
        self.agent_contact_number = val
        self.agent_direct_mobile = val
    if getattr(self, "renewal_contact_mobile", None):
        self.renewal_contact_mobile = validate_indian_mobile(self.renewal_contact_mobile, False, "Renewal team mobile")
    if getattr(self, "claims_contact_mobile", None):
        self.claims_contact_mobile = validate_indian_mobile(self.claims_contact_mobile, False, "Claims team mobile")
    if getattr(self, "kam_mobile", None):
        self.kam_mobile = validate_indian_mobile(self.kam_mobile, False, "Key Account Manager mobile")
    if getattr(self, "email", None):
        self.email = validate_email_format(self.email, False, "Official Company email")
    if getattr(self, "agent_email", None):
        self.agent_email = validate_email_format(self.agent_email, False, "Agent email")
    if getattr(self, "renewal_contact_email", None):
        self.renewal_contact_email = validate_email_format(self.renewal_contact_email, False, "Renewal team email")
    if getattr(self, "claims_contact_email", None):
        self.claims_contact_email = validate_email_format(self.claims_contact_email, False, "Claims team email")
    if getattr(self, "kam_email", None):
        self.kam_email = validate_email_format(self.kam_email, False, "Key Account Manager email")
    if getattr(self, "tieup_date", None) and getattr(self, "tieup_renewal_date", None):
        validate_date_sequence(self.tieup_date, self.tieup_renewal_date, "Tie-up Date", "Tie-up Renewal Date")
    return self

_register_model_validator(CompanyCreate, _val_company, "_validate_company_strict")
_register_model_validator(CompanyUpdate, _val_company, "_validate_company_strict")

# 2. Customer Validation
def _val_customer(self):
    if getattr(self, "pin_code", None) and not getattr(self, "pincode", None):
        self.pincode = self.pin_code
    if getattr(self, "pincode", None) and not getattr(self, "pin_code", None):
        self.pin_code = self.pincode

    if getattr(self, "phone", None):
        self.phone = validate_indian_mobile(self.phone, True, "Customer Mobile")
    if getattr(self, "contact_person_phone", None):
        self.contact_person_phone = validate_indian_mobile(self.contact_person_phone, False, "Corporate Contact Phone")
    if getattr(self, "email", None):
        self.email = validate_email_format(self.email, False, "Customer Email")
    if getattr(self, "contact_person_email", None):
        self.contact_person_email = validate_email_format(self.contact_person_email, False, "Corporate Contact Email")
    if getattr(self, "date_of_birth", None):
        validate_dob_not_future(self.date_of_birth, "Customer Date of Birth")
    if getattr(self, "pincode", None):
        val_pin = validate_pincode(self.pincode, False, "PIN Code")
        self.pincode = val_pin
        self.pin_code = val_pin
    if getattr(self, "pan_number", None):
        self.pan_number = validate_pan(self.pan_number, False, "PAN")
    if getattr(self, "aadhaar_number", None):
        self.aadhaar_number = validate_aadhaar(self.aadhaar_number, False, "Aadhaar")
    if getattr(self, "gstin", None):
        self.gstin = validate_gstin(self.gstin, False, "GSTIN")
    return self

_register_model_validator(InsuranceCustomerCreate, _val_customer, "_validate_customer_strict")
_register_model_validator(InsuranceCustomerUpdate, _val_customer, "_validate_customer_strict")

# 3. Policy Validation
def _val_policy(self):
    if getattr(self, "contact_mobile", None):
        self.contact_mobile = validate_indian_mobile(self.contact_mobile, False, "Policy Contact Mobile", sanitize=True)
    if getattr(self, "contact_email", None):
        self.contact_email = validate_email_format(self.contact_email, False, "Policy Contact Email")
    if getattr(self, "contact_pincode", None):
        self.contact_pincode = validate_pincode(self.contact_pincode, False, "Policy Contact PIN Code")
    if getattr(self, "vehicle_registration_number", None):
        self.vehicle_registration_number = validate_vehicle_reg(self.vehicle_registration_number, False, "Vehicle Registration")
    if getattr(self, "sum_assured", None) is not None:
        self.sum_assured = validate_positive_amount(self.sum_assured, False, "Sum Assured")
    if getattr(self, "net_premium", None) is not None:
        self.net_premium = validate_positive_amount(self.net_premium, False, "Net Premium")
    if getattr(self, "gross_premium", None) is not None:
        self.gross_premium = validate_positive_amount(self.gross_premium, False, "Gross Premium")
    if getattr(self, "final_premium", None) is not None:
        self.final_premium = validate_positive_amount(self.final_premium, False, "Final Premium")
    if getattr(self, "commission_rate", None) is not None:
        self.commission_rate = validate_percentage_rate(self.commission_rate, "Commission Rate")
    if getattr(self, "tds_rate", None) is not None:
        self.tds_rate = validate_percentage_rate(self.tds_rate, "TDS Rate")
    
    start = getattr(self, "start_date", None) or getattr(self, "policy_start_date", None)
    if start and getattr(self, "expiry_date", None):
        validate_date_sequence(start, self.expiry_date, "Policy Start Date", "Policy Expiry Date")
        
    members = getattr(self, "members", None)
    if members and isinstance(members, list):
        for idx, m in enumerate(members):
            m_mob = m.get("mobile_number") if isinstance(m, dict) else getattr(m, "mobile_number", None)
            if m_mob:
                clean_mob = validate_indian_mobile(m_mob, False, f"Member #{idx+1} Mobile", sanitize=True)
                if isinstance(m, dict):
                    m["mobile_number"] = clean_mob
                else:
                    setattr(m, "mobile_number", clean_mob)
            m_email = m.get("email") if isinstance(m, dict) else getattr(m, "email", None)
            if m_email:
                clean_email = validate_email_format(m_email, False, f"Member #{idx+1} Email")
                if isinstance(m, dict):
                    m["email"] = clean_email
                else:
                    setattr(m, "email", clean_email)
            m_dob = m.get("date_of_birth") if isinstance(m, dict) else getattr(m, "date_of_birth", None)
            if m_dob:
                dob_val = _date.fromisoformat(str(m_dob)[:10]) if isinstance(m_dob, str) else m_dob
                validate_dob_not_future(dob_val, f"Member #{idx+1} Date of Birth")

    nominees = getattr(self, "nominees", None)
    if nominees and isinstance(nominees, list):
        for idx, n in enumerate(nominees):
            n_mob = n.get("mobile_number") if isinstance(n, dict) else getattr(n, "mobile_number", None)
            if n_mob:
                clean_mob = validate_indian_mobile(n_mob, False, f"Nominee #{idx+1} Mobile", sanitize=True)
                if isinstance(n, dict):
                    n["mobile_number"] = clean_mob
                else:
                    setattr(n, "mobile_number", clean_mob)
            n_share = n.get("share_percentage") if isinstance(n, dict) else getattr(n, "share_percentage", None)
            if n_share is not None:
                validate_percentage_rate(n_share, f"Nominee #{idx+1} Share")
            n_dob = n.get("date_of_birth") if isinstance(n, dict) else getattr(n, "date_of_birth", None)
            if n_dob:
                dob_val = _date.fromisoformat(str(n_dob)[:10]) if isinstance(n_dob, str) else n_dob
                validate_dob_not_future(dob_val, f"Nominee #{idx+1} Date of Birth")
    return self

_register_model_validator(PolicyCreate, _val_policy, "_validate_policy_strict")
_register_model_validator(PolicyUpdate, _val_policy, "_validate_policy_strict")

# 4. Sub-Agent Validation
def _val_sub_agent(self):
    mob = getattr(self, "mobile_number", None) or getattr(self, "mobile", None)
    if mob:
        validated = validate_indian_mobile(mob, True, "Sub-Agent Mobile")
        if hasattr(self, "mobile_number"):
            self.mobile_number = validated
        if hasattr(self, "mobile"):
            self.mobile = validated
    if getattr(self, "email", None):
        self.email = validate_email_format(self.email, False, "Sub-Agent Email")
    return self

_register_model_validator(SubAgentCreate, _val_sub_agent, "_validate_sub_agent_strict")
_register_model_validator(SubAgentUpdate, _val_sub_agent, "_validate_sub_agent_strict")

# 5. Lead Validation
def _val_lead(self):
    if getattr(self, "mobile", None):
        self.mobile = validate_indian_mobile(self.mobile, True, "Lead Mobile", sanitize=True)
    if getattr(self, "alternate_mobile", None):
        self.alternate_mobile = validate_indian_mobile(self.alternate_mobile, False, "Alternate Mobile", sanitize=True)
    if getattr(self, "email", None):
        self.email = validate_email_format(self.email, False, "Lead Email")
    if getattr(self, "pincode", None):
        self.pincode = validate_pincode(self.pincode, False, "Lead PIN Code")
    if getattr(self, "gstin", None):
        self.gstin = validate_gstin(self.gstin, False, "GSTIN")
    if getattr(self, "date_of_birth", None):
        validate_dob_not_future(self.date_of_birth, "Lead Date of Birth")
    cov = getattr(self, "coverage_amount", None) or getattr(self, "sum_insured", None)
    if cov is not None:
        validate_positive_amount(cov, True, "Coverage Amount")
    if getattr(self, "expected_premium", None) is not None:
        validate_positive_amount(self.expected_premium, True, "Expected Premium")
    return self

_register_model_validator(LeadCreate, _val_lead, "_validate_lead_strict")
_register_model_validator(LeadUpdate, _val_lead, "_validate_lead_strict")

# 6. Policy Plan Validation
def _val_plan(self):
    if getattr(self, "sum_insured_min", None) is not None:
        self.sum_insured_min = validate_positive_amount(self.sum_insured_min, True, "Minimum Sum Insured")
    if getattr(self, "sum_insured_max", None) is not None:
        self.sum_insured_max = validate_positive_amount(self.sum_insured_max, True, "Maximum Sum Insured")
    if getattr(self, "sum_insured_min", None) is not None and getattr(self, "sum_insured_max", None) is not None:
        if self.sum_insured_max < self.sum_insured_min:
            raise ValueError("Maximum Sum Insured cannot be less than Minimum Sum Insured.")
    if getattr(self, "policy_term_min_years", None) is not None and getattr(self, "policy_term_max_years", None) is not None:
        if self.policy_term_max_years < self.policy_term_min_years:
            raise ValueError("Maximum Policy Term cannot be less than Minimum Policy Term.")
    return self

_register_model_validator(PlanCreate, _val_plan, "_validate_plan_strict")
_register_model_validator(PlanUpdate, _val_plan, "_validate_plan_strict")

# 7. Nominee Validation
def _val_nominee(self):
    if getattr(self, "mobile_number", None):
        self.mobile_number = validate_indian_mobile(self.mobile_number, False, "Nominee Mobile")
    if getattr(self, "date_of_birth", None):
        validate_dob_not_future(self.date_of_birth, "Nominee Date of Birth")
    if getattr(self, "share_percentage", None) is not None:
        validate_percentage_rate(self.share_percentage, "Nominee Share Percentage")
    return self

_register_model_validator(PolicyNomineeCreate, _val_nominee, "_validate_nominee_strict")

# 8. Payment Validation
def _val_payment(self):
    if getattr(self, "amount", None) is not None:
        self.amount = validate_positive_amount(self.amount, False, "Payment Amount")
    return self

_register_model_validator(PaymentCreate, _val_payment, "_validate_payment_strict")

# 9. Lead Management Schemas & Enhancements
LeadStatsResponse.model_fields["category_performance"] = FieldInfo(annotation=list[dict[str, Any]], default_factory=list)
LeadStatsResponse.model_rebuild(force=True)

KANBAN_5_STAGES = ["PENDING", "CALL_LATER", "SCHEDULE_MEETING", "HOLD", "DONE"]
for _st in ["PENDING", "CALL_LATER", "SCHEDULE_MEETING", "HOLD", "DONE", "ON_HOLD", "WON"]:
    if _st not in LEAD_STATUSES:
        LEAD_STATUSES.append(_st)

# 10. Policy Plan Riders, Plan Benefits & Policy Selected Riders Schemas
class PlanRiderItem(BaseModel):
    id: uuid.UUID | None = None
    name: str
    description: str | None = None

class PlanRiderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    plan_id: uuid.UUID
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime

class PlanBenefitItem(BaseModel):
    id: uuid.UUID | None = None
    name: str
    description: str | None = None

class PlanBenefitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    plan_id: uuid.UUID
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime

class PolicyRiderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    policy_id: uuid.UUID
    rider_id: uuid.UUID | None = None
    rider_name: str
    rider_description: str | None = None
    created_at: datetime

PlanCreate.model_fields["riders"] = FieldInfo(annotation=list[PlanRiderItem] | list[dict[str, Any]] | list[str] | str | None, default=None)
PlanCreate.model_fields["benefits"] = FieldInfo(annotation=list[PlanBenefitItem] | list[dict[str, Any]] | list[str] | str | None, default=None)
PlanCreate.model_rebuild(force=True)

PlanUpdate.model_fields["riders"] = FieldInfo(annotation=list[PlanRiderItem] | list[dict[str, Any]] | list[str] | str | None, default=None)
PlanUpdate.model_fields["benefits"] = FieldInfo(annotation=list[PlanBenefitItem] | list[dict[str, Any]] | list[str] | str | None, default=None)
PlanUpdate.model_rebuild(force=True)

PlanResponse.model_fields["plan_riders"] = FieldInfo(annotation=list[PlanRiderResponse], default_factory=list)
PlanResponse.model_fields["plan_benefits"] = FieldInfo(annotation=list[PlanBenefitResponse], default_factory=list)
PlanResponse.model_rebuild(force=True)

PolicyCreate.model_fields["selected_rider_ids"] = FieldInfo(annotation=list[uuid.UUID] | None, default=None)
PolicyCreate.model_rebuild(force=True)

PolicyUpdate.model_fields["selected_rider_ids"] = FieldInfo(annotation=list[uuid.UUID] | None, default=None)
PolicyUpdate.model_rebuild(force=True)

PolicyResponse.model_fields["selected_rider_ids"] = FieldInfo(annotation=list[uuid.UUID], default_factory=list)
PolicyResponse.model_fields["selected_riders"] = FieldInfo(annotation=list[PolicyRiderResponse], default_factory=list)
PolicyResponse.model_fields["riders"] = FieldInfo(annotation=list[PolicyRiderResponse], default_factory=list)
PolicyResponse.model_fields["plan_benefits"] = FieldInfo(annotation=list[PlanBenefitResponse], default_factory=list)
PolicyResponse.model_rebuild(force=True)

if "LeadActivityResponse" in globals():
    LeadActivityResponse.model_fields["action_type"] = FieldInfo(annotation=str | None, default=None)
    LeadActivityResponse.model_fields["actor_name"] = FieldInfo(annotation=str | None, default=None)
    LeadActivityResponse.model_rebuild(force=True)

if "LeadReminderCreate" in globals():
    from datetime import date as _dt_date
    LeadReminderCreate.model_fields["title"] = FieldInfo(annotation=str, default_factory=lambda: "Follow-up Task")
    LeadReminderCreate.model_fields["reminder_date"] = FieldInfo(annotation=_dt_date, default_factory=_dt_date.today)
    LeadReminderCreate.model_fields["scheduled_time"] = FieldInfo(annotation=str | None, default=None)
    LeadReminderCreate.model_fields["notes"] = FieldInfo(annotation=str | None, default=None)
    LeadReminderCreate.model_rebuild(force=True)

if "LeadReminderCompleteRequest" in globals():
    LeadReminderCompleteRequest.model_fields["completion_remarks"] = FieldInfo(annotation=str, default="Completed")
    LeadReminderCompleteRequest.model_fields["remarks"] = FieldInfo(annotation=str | None, default=None)
    LeadReminderCompleteRequest.model_fields["next_scheduled_time"] = FieldInfo(annotation=str | None, default=None)
    LeadReminderCompleteRequest.model_rebuild(force=True)










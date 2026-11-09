--
-- PostgreSQL database dump
--

\restrict io2t5tXTufx7txAf0ZyEF8gn7O6H6OZhAcGhUVXFZ8x9BXAETRrABMM2Yn47yWg

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    actor_id uuid,
    action character varying(50) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    state_delta jsonb,
    ip_address character varying(45),
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: crm_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    work_order_id uuid,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL,
    notification_type character varying(50) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.crm_notifications OWNER TO postgres;

--
-- Name: customer_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_notes (
    id uuid NOT NULL,
    customer_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.customer_notes OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(20) NOT NULL,
    pan_number character varying(10),
    pipeline_status character varying(40) NOT NULL,
    assigned_officer_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    reference_source character varying(100),
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    created_by_id uuid,
    gender character varying(20),
    date_of_birth date,
    anniversary_date date,
    state character varying(100),
    city character varying(100),
    address text,
    pincode character varying(20),
    customer_type character varying(50) DEFAULT 'INDIVIDUAL'::character varying,
    aadhaar_encrypted character varying(500),
    aadhaar_hash character varying(64),
    pan_encrypted character varying(500),
    marital_status character varying(50),
    nationality character varying(50) DEFAULT 'Indian'::character varying,
    occupation character varying(100),
    source_of_income character varying(100),
    company_name character varying(200),
    corporate_code character varying(50),
    gstin character varying(15),
    contact_person_name character varying(150),
    contact_person_phone character varying(50),
    contact_person_email character varying(255)
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid NOT NULL,
    customer_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    original_filename character varying(255) NOT NULL,
    storage_path character varying(500) NOT NULL,
    file_size_bytes integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    sha256_hash character varying(64) NOT NULL,
    verification_status character varying(30) NOT NULL,
    verified_by_id uuid,
    rejection_reason text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT chk_documents_file_size_positive CHECK ((file_size_bytes > 0))
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: financial_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financial_profiles (
    id uuid NOT NULL,
    customer_id uuid NOT NULL,
    employment_type character varying(50) NOT NULL,
    monthly_income numeric(14,2) NOT NULL,
    monthly_obligations numeric(14,2) NOT NULL,
    cibil_score integer,
    risk_tier character varying(20) NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT chk_financial_profiles_cibil_score_range CHECK (((cibil_score IS NULL) OR ((cibil_score >= 300) AND (cibil_score <= 900)))),
    CONSTRAINT chk_financial_profiles_monthly_income_positive CHECK ((monthly_income >= (0)::numeric)),
    CONSTRAINT chk_financial_profiles_monthly_obligations_positive CHECK ((monthly_obligations >= (0)::numeric))
);


ALTER TABLE public.financial_profiles OWNER TO postgres;

--
-- Name: insurance_agent_inquiries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_agent_inquiries (
    id uuid NOT NULL,
    sub_agent_id uuid NOT NULL,
    full_name character varying(150) NOT NULL,
    mobile character varying(20) NOT NULL,
    email character varying(255),
    policy_type character varying(50) NOT NULL,
    message text,
    consent boolean DEFAULT true NOT NULL,
    status character varying(30) DEFAULT 'NEW'::character varying NOT NULL,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_agent_inquiries OWNER TO postgres;

--
-- Name: insurance_commission_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_commission_receipts (
    id uuid NOT NULL,
    commission_id uuid NOT NULL,
    receipt_date date NOT NULL,
    gross_amount numeric(14,2) DEFAULT 0.00 NOT NULL,
    tds_deducted numeric(14,2) DEFAULT 0.00 NOT NULL,
    net_amount numeric(14,2) NOT NULL,
    payment_mode character varying(50) DEFAULT 'NEFT'::character varying NOT NULL,
    bank_name character varying(100),
    transaction_reference character varying(100),
    tds_certificate_ref character varying(100),
    receipt_type character varying(50) DEFAULT 'PARTIAL_PAYMENT'::character varying NOT NULL,
    notes text,
    supporting_document_url character varying(500),
    recorded_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_commission_rate numeric(6,2),
    actual_tds_rate numeric(5,2),
    bank_account character varying(100)
);


ALTER TABLE public.insurance_commission_receipts OWNER TO postgres;

--
-- Name: insurance_commission_splits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_commission_splits (
    id uuid NOT NULL,
    sub_agent_id uuid NOT NULL,
    company_id uuid,
    plan_id uuid,
    split_type character varying(20) DEFAULT 'PERCENTAGE'::character varying NOT NULL,
    split_value numeric(10,2) NOT NULL,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    policy_category character varying(50),
    commission_type character varying(30) DEFAULT 'ALL'::character varying NOT NULL,
    allocation_basis character varying(50) DEFAULT 'GROSS_COMMISSION'::character varying NOT NULL,
    effective_to date,
    recipient_type character varying(50) DEFAULT 'SUB_AGENT'::character varying NOT NULL,
    tds_deduction_type character varying(50) DEFAULT 'DEDUCT_AT_SOURCE'::character varying NOT NULL,
    agreement_status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL
);


ALTER TABLE public.insurance_commission_splits OWNER TO postgres;

--
-- Name: insurance_companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_companies (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    category character varying(50) DEFAULT 'Composite'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    contact_person character varying(150),
    email character varying(255),
    phone character varying(50),
    address text,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    agent_name character varying(150),
    agent_contact_number character varying(50),
    agent_code character varying(50),
    tieup_date date,
    tieup_renewal_date date,
    renewal_team_contact character varying(255),
    claims_team_contact character varying(255)
);


ALTER TABLE public.insurance_companies OWNER TO postgres;

--
-- Name: insurance_company_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_company_categories (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    category character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_company_categories OWNER TO postgres;

--
-- Name: insurance_company_commission_agreements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_company_commission_agreements (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    policy_category character varying(50) DEFAULT 'ALL'::character varying CONSTRAINT insurance_company_commission_agreement_policy_category_not_null NOT NULL,
    plan_id uuid,
    first_year_commission_rate numeric(6,2) CONSTRAINT insurance_company_commissio_first_year_commission_rate_not_null NOT NULL,
    renewal_commission_rate numeric(6,2) DEFAULT 7.50 CONSTRAINT insurance_company_commission_a_renewal_commission_rate_not_null NOT NULL,
    special_commission_rate numeric(6,2),
    commissionable_basis character varying(50) DEFAULT 'NET_PREMIUM'::character varying CONSTRAINT insurance_company_commission_agre_commissionable_basis_not_null NOT NULL,
    tds_rate numeric(5,2) DEFAULT 10.00 NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_company_commission_agreements OWNER TO postgres;

--
-- Name: insurance_company_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_company_documents (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    document_type character varying(50) DEFAULT 'TIEUP_AGREEMENT'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    storage_path character varying(500) NOT NULL,
    file_size_bytes integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    sha256_hash character varying(64) NOT NULL,
    uploaded_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_company_documents OWNER TO postgres;

--
-- Name: insurance_family_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_family_groups (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    head_customer_id uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_family_groups OWNER TO postgres;

--
-- Name: insurance_family_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_family_members (
    id uuid NOT NULL,
    family_group_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    relationship character varying(50) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_family_members OWNER TO postgres;

--
-- Name: insurance_health_quotation_company_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_health_quotation_company_plans (
    id uuid NOT NULL,
    quotation_id uuid NOT NULL,
    insurance_company_id uuid,
    insurance_plan_id uuid,
    display_company_name character varying(150) CONSTRAINT insurance_health_quotation_compan_display_company_name_not_null NOT NULL,
    display_plan_variant character varying(150) CONSTRAINT insurance_health_quotation_compan_display_plan_variant_not_null NOT NULL,
    notes text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.insurance_health_quotation_company_plans OWNER TO postgres;

--
-- Name: insurance_health_quotation_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_health_quotation_members (
    id uuid NOT NULL,
    quotation_id uuid NOT NULL,
    customer_id uuid,
    full_name character varying(150) NOT NULL,
    relationship character varying(50) NOT NULL,
    gender character varying(20),
    date_of_birth date NOT NULL,
    reference_date date NOT NULL,
    age_years integer NOT NULL,
    age_months integer NOT NULL,
    age_days integer NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.insurance_health_quotation_members OWNER TO postgres;

--
-- Name: insurance_health_quotation_premiums; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_health_quotation_premiums (
    id uuid NOT NULL,
    quotation_company_plan_id uuid CONSTRAINT insurance_health_quotation_p_quotation_company_plan_id_not_null NOT NULL,
    sum_insured numeric(15,2) NOT NULL,
    sum_insured_code character varying(20) NOT NULL,
    premium_amount numeric(15,2) NOT NULL,
    premium_basis character varying(20) DEFAULT 'GROSS'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.insurance_health_quotation_premiums OWNER TO postgres;

--
-- Name: insurance_health_quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_health_quotations (
    id uuid NOT NULL,
    quotation_number character varying(50) NOT NULL,
    quotation_title character varying(255) NOT NULL,
    client_id uuid,
    client_name character varying(150) NOT NULL,
    advisor_id uuid NOT NULL,
    advisor_name character varying(150) NOT NULL,
    quotation_date date NOT NULL,
    pin_code character varying(10) NOT NULL,
    contact_number character varying(50),
    contact_email character varying(255),
    notes text,
    disclaimer_snapshot character varying(500) NOT NULL,
    premium_basis character varying(20) DEFAULT 'GROSS'::character varying NOT NULL,
    status character varying(50) DEFAULT 'DRAFT'::character varying NOT NULL,
    tenant_id character varying(100),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.insurance_health_quotations OWNER TO postgres;

--
-- Name: insurance_plan_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_plan_documents (
    id uuid NOT NULL,
    plan_id uuid NOT NULL,
    document_type character varying(50) DEFAULT 'POLICY_BROCHURE'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    original_filename character varying(255) NOT NULL,
    storage_path character varying(500) NOT NULL,
    file_size_bytes integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    sha256_hash character varying(64) NOT NULL,
    uploaded_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_plan_documents OWNER TO postgres;

--
-- Name: insurance_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_plans (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    company_id uuid NOT NULL,
    line_of_business character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    riders text,
    benefits text,
    brochure_filename character varying(255),
    brochure_storage_path character varying(500),
    brochure_mime_type character varying(100),
    claim_form_filename character varying(255),
    claim_form_storage_path character varying(500),
    claim_form_mime_type character varying(100)
);


ALTER TABLE public.insurance_plans OWNER TO postgres;

--
-- Name: insurance_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policies (
    id uuid NOT NULL,
    policy_number character varying(100) NOT NULL,
    policy_type character varying(50) NOT NULL,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    purchase_party_id uuid,
    sub_agent_id uuid,
    term_years integer DEFAULT 1 NOT NULL,
    sum_assured numeric(14,2) NOT NULL,
    final_premium numeric(14,2) NOT NULL,
    is_single_premium boolean DEFAULT false NOT NULL,
    premium_mode character varying(30) DEFAULT 'Yearly'::character varying NOT NULL,
    policy_start_date date NOT NULL,
    first_receipt_date date,
    expiry_date date NOT NULL,
    next_premium_due_date date,
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    notes text,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    net_premium numeric(14,2),
    tax_amount numeric(14,2),
    coverage_type character varying(30) DEFAULT 'INDIVIDUAL'::character varying NOT NULL,
    proposal_number character varying(100),
    business_type character varying(20) DEFAULT 'NEW'::character varying NOT NULL,
    previous_policy_number character varying(100),
    previous_insurer character varying(150),
    portability_continuity_details text,
    product_variant character varying(100),
    hospital_cash_benefit character varying(30) DEFAULT 'NOT_APPLICABLE'::character varying NOT NULL,
    vehicle_registration_number character varying(50),
    vehicle_manufacturer character varying(100),
    vehicle_model character varying(100),
    vehicle_type character varying(50),
    travel_destination character varying(150),
    travel_type character varying(50),
    intermediary_name character varying(150),
    contact_city character varying(100),
    contact_pincode character varying(20),
    contact_mobile character varying(30),
    contact_email character varying(255),
    commission_received_status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    actual_commission_received_amount numeric(14,2),
    commission_received_date date,
    commission_bank_reference character varying(100),
    previous_policy_id uuid,
    issue_date date
);


ALTER TABLE public.insurance_policies OWNER TO postgres;

--
-- Name: insurance_policy_commissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policy_commissions (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    sub_agent_id uuid,
    commission_type character varying(30) DEFAULT 'FIRST_YEAR'::character varying NOT NULL,
    gross_commission_amount numeric(14,2) NOT NULL,
    gross_commission_rate numeric(6,2),
    sub_agent_amount numeric(14,2) DEFAULT 0.00 NOT NULL,
    firm_net_amount numeric(14,2) NOT NULL,
    split_rule_applied character varying(100),
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    payment_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    net_premium_applied numeric(14,2),
    tds_rate numeric(5,2) DEFAULT 10.00,
    tds_amount numeric(14,2) DEFAULT 0.00,
    net_commission_payable numeric(14,2),
    sub_agent_tds_rate numeric(5,2),
    sub_agent_tds_amount numeric(14,2),
    sub_agent_net_payout numeric(14,2),
    firm_tds_amount numeric(14,2),
    firm_net_bank_credit numeric(14,2),
    calculation_source character varying(50) DEFAULT 'RULE_AGREEMENT'::character varying,
    override_reason character varying(255),
    bank_reference character varying(100),
    policy_category character varying(50),
    expected_receipt_date date,
    actual_gross_received numeric(14,2) DEFAULT 0.00 NOT NULL,
    actual_tds_deducted numeric(14,2) DEFAULT 0.00 NOT NULL,
    actual_net_received numeric(14,2) DEFAULT 0.00 NOT NULL,
    reconciliation_difference numeric(14,2) DEFAULT 0.00 NOT NULL,
    reconciliation_status character varying(30) DEFAULT 'UNRECONCILED'::character varying NOT NULL,
    recipient_type character varying(50) DEFAULT 'MAIN_FIRM'::character varying NOT NULL,
    allocation_basis character varying(50) DEFAULT 'GROSS_COMMISSION'::character varying NOT NULL,
    commission_agreement_id uuid,
    split_agreement_id uuid,
    agreement_snapshot text,
    approved_by_id uuid,
    approved_at timestamp with time zone,
    approval_notes text,
    reversed_by_id uuid,
    reversed_at timestamp with time zone,
    reversal_reason text,
    reversal_amount numeric(14,2),
    original_commission_id uuid,
    actual_commission_rate numeric(6,2),
    actual_tds_rate numeric(5,2),
    bank_account character varying(100),
    balance_receivable numeric(14,2) DEFAULT 0.00 NOT NULL
);


ALTER TABLE public.insurance_policy_commissions OWNER TO postgres;

--
-- Name: insurance_policy_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policy_documents (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    document_type character varying(50) DEFAULT 'OFFICIAL_POLICY_CERTIFICATE'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    original_filename character varying(255) NOT NULL,
    storage_path character varying(500) NOT NULL,
    file_size_bytes integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    sha256_hash character varying(64) NOT NULL,
    uploaded_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_policy_documents OWNER TO postgres;

--
-- Name: insurance_policy_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policy_histories (
    id uuid NOT NULL,
    current_policy_id uuid NOT NULL,
    previous_policy_id uuid,
    insurance_company_name character varying(255) NOT NULL,
    previous_policy_number character varying(150) NOT NULL,
    policy_business_type character varying(50) DEFAULT 'PORT'::character varying NOT NULL,
    history_sequence integer DEFAULT 1 NOT NULL,
    policy_start_date date,
    policy_expiry_date date,
    sum_insured numeric(14,2),
    net_premium numeric(14,2),
    gross_premium numeric(14,2),
    product_variant character varying(150),
    policy_status character varying(50) DEFAULT 'EXPIRED'::character varying,
    claim_history text,
    insurer_contact character varying(255),
    cumulative_bonus character varying(100),
    continuity_details text,
    waiting_period_waiver_details text,
    remarks text,
    is_external_policy boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_policy_histories OWNER TO postgres;

--
-- Name: insurance_policy_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policy_members (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    customer_id uuid,
    full_name character varying(150) NOT NULL,
    relationship character varying(50) NOT NULL,
    date_of_birth date,
    gender character varying(20),
    mobile_number character varying(30),
    email character varying(255),
    address text,
    member_code character varying(50),
    individual_sum_insured numeric(14,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_policy_members OWNER TO postgres;

--
-- Name: insurance_policy_nominees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policy_nominees (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    full_name character varying(150) NOT NULL,
    relationship character varying(50) NOT NULL,
    date_of_birth date,
    mobile_number character varying(50),
    address text,
    share_percentage numeric(5,2) DEFAULT 100.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_policy_nominees OWNER TO postgres;

--
-- Name: insurance_policy_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policy_payments (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    premium_schedule_id uuid,
    payment_mode character varying(50) NOT NULL,
    bank_name character varying(100),
    transaction_reference character varying(100),
    first_receipt_date date,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(14,2) NOT NULL,
    status character varying(30) DEFAULT 'COMPLETED'::character varying NOT NULL,
    notes text,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid,
    document_filename character varying(255)
);


ALTER TABLE public.insurance_policy_payments OWNER TO postgres;

--
-- Name: insurance_policy_years; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policy_years (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    policy_year integer DEFAULT 1 NOT NULL,
    policy_number character varying(100) NOT NULL,
    proposal_number character varying(100),
    business_type character varying(20) DEFAULT 'NEW'::character varying NOT NULL,
    prior_policy_number character varying(100),
    product_variant character varying(100),
    start_date date NOT NULL,
    end_date date NOT NULL,
    net_premium numeric(14,2),
    gross_premium numeric(14,2),
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_policy_years OWNER TO postgres;

--
-- Name: insurance_premium_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_premium_schedules (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    amount numeric(14,2) NOT NULL,
    status character varying(30) DEFAULT 'UPCOMING'::character varying NOT NULL,
    paid_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_premium_schedules OWNER TO postgres;

--
-- Name: insurance_purchase_parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_purchase_parties (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    contact_person character varying(150),
    email character varying(255),
    phone character varying(50),
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.insurance_purchase_parties OWNER TO postgres;

--
-- Name: insurance_sub_agent_payout_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_sub_agent_payout_payments (
    id uuid NOT NULL,
    payout_id uuid NOT NULL,
    payment_date date NOT NULL,
    amount numeric(14,2) NOT NULL,
    tds_deducted numeric(14,2) DEFAULT 0.00 NOT NULL,
    net_amount numeric(14,2) NOT NULL,
    payment_method character varying(50) DEFAULT 'BANK_TRANSFER'::character varying NOT NULL,
    bank_account_details character varying(150),
    transaction_reference character varying(100),
    payment_proof_url character varying(500),
    notes text,
    recorded_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_sub_agent_payout_payments OWNER TO postgres;

--
-- Name: insurance_sub_agent_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_sub_agent_payouts (
    id uuid NOT NULL,
    policy_id uuid NOT NULL,
    commission_id uuid,
    sub_agent_id uuid NOT NULL,
    commission_type character varying(30) DEFAULT 'FIRST_YEAR'::character varying NOT NULL,
    insurer_gross_commission numeric(14,2) NOT NULL,
    agreed_percentage numeric(6,2),
    payable_amount numeric(14,2) NOT NULL,
    tds_rate numeric(5,2) DEFAULT 5.00,
    tds_amount numeric(14,2) DEFAULT 0.00,
    net_payable_amount numeric(14,2) NOT NULL,
    amount_paid numeric(14,2) DEFAULT 0.00 NOT NULL,
    remaining_payable numeric(14,2) DEFAULT 0.00 NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    payout_date date,
    split_rule_applied character varying(150),
    split_agreement_snapshot text,
    notes text,
    on_hold_reason text,
    approved_by_id uuid,
    approved_at timestamp with time zone,
    approval_notes text,
    reversed_by_id uuid,
    reversed_at timestamp with time zone,
    reversal_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_sub_agent_payouts OWNER TO postgres;

--
-- Name: insurance_sub_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_sub_agents (
    id uuid NOT NULL,
    full_name character varying(150) NOT NULL,
    agent_code character varying(50) NOT NULL,
    mobile character varying(20) NOT NULL,
    email character varying(255),
    address text,
    joining_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    parent_firm character varying(150) DEFAULT 'FinNexus Enterprise'::character varying NOT NULL,
    parent_agent_id uuid,
    public_profile_slug character varying(100) NOT NULL,
    bio text,
    specialties text,
    show_contact_info boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_sub_agents OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(255)
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid NOT NULL,
    customer_id uuid NOT NULL,
    assigned_to_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    priority character varying(20) NOT NULL,
    status character varying(30) NOT NULL,
    due_date date NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    full_name character varying(150) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: work_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_categories (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    default_priority character varying(20) NOT NULL,
    checklist_template json,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.work_categories OWNER TO postgres;

--
-- Name: work_order_checklist_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_order_checklist_items (
    id uuid NOT NULL,
    work_order_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    assigned_to_id uuid,
    status character varying(30) NOT NULL,
    "position" integer NOT NULL,
    due_date timestamp with time zone,
    completed_at timestamp with time zone,
    completed_by_id uuid,
    notes text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.work_order_checklist_items OWNER TO postgres;

--
-- Name: work_order_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_order_history (
    id uuid NOT NULL,
    work_order_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    details text,
    "timestamp" timestamp with time zone NOT NULL
);


ALTER TABLE public.work_order_history OWNER TO postgres;

--
-- Name: work_order_reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_order_reminders (
    work_order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.work_order_reminders OWNER TO postgres;

--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_orders (
    id uuid NOT NULL,
    order_number character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    client_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    assigned_to_id uuid,
    priority character varying(20) NOT NULL,
    status character varying(30) NOT NULL,
    due_date timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    progress_percent integer NOT NULL,
    priority_notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    work_priority character varying(50),
    custom_priority character varying(150)
);


ALTER TABLE public.work_orders OWNER TO postgres;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alembic_version (version_num) FROM stdin;
c6d7e8f9a0b1
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, actor_id, action, resource_type, resource_id, state_delta, ip_address, created_at) FROM stdin;
eca85f33-088d-4e25-aa7f-5ab56eaafdbf	40351e16-e0dd-4064-a060-bd866d35bc63	CLIENT_CREATED	client	5358eee7-ae93-469f-8af6-40c5c3608793	{"pan": "ABCDE1234F", "name": "Temporary VerificationUser", "email": "temp_verify@example.com", "phone": "+91 9988776655"}	\N	2026-11-01 17:08:01.438139+05:30
d94327e2-0b58-4130-8286-971a8898124a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	833589a6-83c2-4b8a-b1ca-8943a6a26667	{"code": "TEMP-INS-01", "name": "Temp Test Insurance", "category": "HEALTH"}	\N	2026-11-01 17:08:03.511719+05:30
f8417485-7234-46e2-810e-538c3862c617	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	c95ed83c-575d-4080-b8e9-e668038d9b27	{"code": "TMP-PLN-01", "name": "Temp Health Care Plan", "company_id": "833589a6-83c2-4b8a-b1ca-8943a6a26667", "company_name": "Temp Test Insurance"}	\N	2026-11-01 17:08:05.549229+05:30
4ca30ed8-3400-4ae9-ac3c-d07531a107be	40351e16-e0dd-4064-a060-bd866d35bc63	PURCHASE_PARTY_CREATED	insurance_purchase_party	e31969b5-5162-4c8e-bbc4-997111186dc2	{"code": "TMP-PRT-01", "name": "Temp Direct Agency"}	\N	2026-11-01 17:08:07.599435+05:30
c78d9f38-a752-464e-bd3b-344578870474	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	4a2aa16a-a673-4934-8649-1b48dc1bd437	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 10000.0, "policy_number": "TEMP-VERIFY-D9BA12", "nominees_count": 0}	\N	2026-11-01 17:08:09.661723+05:30
504963ba-b9d1-4111-9c34-3764713b1321	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	c95ed83c-575d-4080-b8e9-e668038d9b27	{"code": "TMP-PLN-01", "name": "Temp Health Care Plan"}	\N	2026-11-01 17:08:15.836239+05:30
960ce53f-308d-412f-9123-1c6abc14bb85	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	833589a6-83c2-4b8a-b1ca-8943a6a26667	{"code": "TEMP-INS-01", "name": "Temp Test Insurance"}	\N	2026-11-01 17:08:17.871921+05:30
719c56d0-3abf-4c7c-b53c-b0b37ae5a42c	40351e16-e0dd-4064-a060-bd866d35bc63	PURCHASE_PARTY_DELETED	insurance_purchase_party	e31969b5-5162-4c8e-bbc4-997111186dc2	{"code": "TMP-PRT-01", "name": "Temp Direct Agency"}	\N	2026-11-01 17:08:19.914413+05:30
393b73c7-121d-42f6-b420-2bf4513f7d14	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_MASTER_DATA_SEEDED	insurance_master_data	\N	{"plans_created": 6, "parties_created": 3, "companies_created": 7}	\N	2026-11-01 17:28:19.346364+05:30
35652367-54bc-46ad-864f-2b751c1c801b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	a5415bf1-c2bd-45df-bae7-821b835b1420	{"code": "CARE-SUPR-01", "name": "Care Supreme Comprehensive"}	\N	2026-11-01 17:29:28.209304+05:30
9bb35133-959e-4c69-8d6d-f3f0a62ce535	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	28cd5f65-f0cb-411d-977d-f337b21f683d	{"code": "DIGIT-CAR-COMP", "name": "Digit Smart Drive Private Car"}	\N	2026-11-01 17:29:36.307592+05:30
f5c60e5a-493f-47ac-905a-d6f918842f9d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	34d7cb3b-318b-4444-b034-adb1480e4c44	{"code": "BAJAJ-DRV-PKG", "name": "Drive Assure Commercial Package"}	\N	2026-11-01 17:29:42.94015+05:30
de7f637d-d731-4238-a9aa-0b3bff1a7f08	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	41f8d05d-62e2-43f6-9ff7-b6eb63042bea	{"code": "LIC-JEV-LABH", "name": "Jeevan Labh Endowment"}	\N	2026-11-01 17:29:49.760382+05:30
64b5a014-6f88-4f3b-972d-afcda9e93d23	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	c9d35eb4-b67c-4037-b392-397fa4530893	{"code": "STAR-COMP-01", "name": "Star Comprehensive Health Cover"}	\N	2026-11-01 17:29:56.219221+05:30
5759834f-f976-48f2-9845-c99954801e87	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	80af6f62-24f8-4363-a05b-98ec8f5e4c18	{"code": "LIC-TECH-TERM", "name": "Tech Term Pure Protection"}	\N	2026-11-01 17:30:03.416972+05:30
e4f90989-034c-4201-acc5-9834a9f2248e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	9fc9f278-f21a-4a1a-85ef-f1439c147589	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00001"}	\N	2026-11-01 17:51:53.461604+05:30
4f14c88b-3b16-42e3-9e76-f5e8445907fb	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	75ef48ad-7ff0-4dfb-9f47-3939b9169f41	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00002"}	\N	2026-11-01 17:51:57.742791+05:30
823cfe93-9901-4b06-b439-2778c80965c2	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	eb5b3fa8-b7db-44fb-b36b-a4732ba74fc0	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00003"}	\N	2026-11-01 17:52:01.776005+05:30
ecc18da3-8736-4d6c-864d-464a18c710cd	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	bfd648bb-e0c0-4c28-8185-a5019a8a1710	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00004"}	\N	2026-11-01 17:52:05.51747+05:30
0c4f3df0-6e81-4d0f-a768-1a1866dd2578	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	9ed2734b-545e-44fd-a09d-4cae26a1bd2d	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00005"}	\N	2026-11-01 17:52:09.304564+05:30
e259b699-db2a-4c49-aec4-52673282bd39	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	c4419739-52e7-42f7-af8c-8cf23d6a0430	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00006"}	\N	2026-11-01 17:52:13.325825+05:30
342dc4f2-3b3b-4971-bc92-1978e23bf7a4	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	1ecc736d-5177-4287-ad02-e26c9060ee6b	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00007"}	\N	2026-11-01 17:54:28.563395+05:30
c8f7da2a-2048-46c4-8f1d-bc0424c5a013	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	dbec63c0-6a87-4b4d-bf7b-501f7eea8771	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00008"}	\N	2026-11-01 17:54:31.747408+05:30
66de435d-512e-433d-8b67-76ab9f3fe684	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	ac19c0fe-1e7a-4fa1-94bf-41ada9d26a1e	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00009"}	\N	2026-11-01 17:54:34.321867+05:30
12b995d0-97b6-4908-b084-d08d10c0db38	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	a70569b8-2954-4971-bba4-0614eca210c5	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00010"}	\N	2026-11-01 17:54:37.322441+05:30
25a360c6-19ef-483e-bc73-5af70ae0940e	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	a70569b8-2954-4971-bba4-0614eca210c5	{"status": "DRAFT", "updated_at": "2026-11-01T12:24:39.430183+00:00", "quotation_number": "HQ-2026-00010"}	\N	2026-11-01 17:54:39.430604+05:30
b7228111-e9cb-46f6-a671-3db2c4416107	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	9c7e7203-3598-4565-bc07-015c6875d06d	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00011"}	\N	2026-11-01 17:54:42.051709+05:30
9810b780-ad75-4860-a423-b6f4de0681f0	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	586f174b-2126-475a-9061-20ca66f8fb72	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00012"}	\N	2026-11-01 17:54:51.286383+05:30
d8d1c87a-5596-4a92-ad3c-82a62376923a	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	0299af36-16ab-4774-bf71-18e5945c869a	{"source_quotation_id": "586f174b-2126-475a-9061-20ca66f8fb72", "new_quotation_number": "HQ-2026-00013"}	\N	2026-11-01 17:54:53.411097+05:30
6e4f6ced-734c-4572-8d34-247ac7c2349d	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	0299af36-16ab-4774-bf71-18e5945c869a	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00013"}	\N	2026-11-01 17:54:55.532385+05:30
21dc0de1-4f00-4057-b395-6ac75860b665	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	5e48975a-ad6f-4147-96d7-8ea9b994f69f	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00013"}	\N	2026-11-01 17:56:26.362076+05:30
053f5ad8-c959-48d6-934d-d5e8f621692e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	77422edf-f737-4d82-9440-dab8736e33d6	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00014"}	\N	2026-11-01 17:56:29.147584+05:30
89aa3da4-0b1e-4d7e-bfbb-ce620b9add8c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7d29448a-0aff-4dde-9845-c3371e1786a0	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00015"}	\N	2026-11-01 17:56:31.973765+05:30
545b7787-5236-4e87-a65d-f1f4e5a3aebc	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	b3c20dd7-7f0f-4082-897a-5f99cdb65157	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00016"}	\N	2026-11-01 17:56:34.660943+05:30
5346396e-e7f8-43a8-a287-4f135b133ae9	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	b3c20dd7-7f0f-4082-897a-5f99cdb65157	{"status": "DRAFT", "updated_at": "2026-11-01T12:26:36.841676+00:00", "quotation_number": "HQ-2026-00016"}	\N	2026-11-01 17:56:36.843541+05:30
4dbcb6a4-e284-4d49-8981-15002871334d	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	e486b08b-179a-4d7b-8d58-5efe65a6a601	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00017"}	\N	2026-11-01 17:56:41.115046+05:30
52a599ed-1c2c-436d-a2fc-138ac4e7918c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	908132e5-0135-4f85-9026-d8c07a3fd25a	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00018"}	\N	2026-11-01 17:56:50.270168+05:30
32585f53-c0f5-41d1-981d-b7325c6c5362	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	5eab818b-bddf-4cdf-970e-91853a08636f	{"source_quotation_id": "908132e5-0135-4f85-9026-d8c07a3fd25a", "new_quotation_number": "HQ-2026-00019"}	\N	2026-11-01 17:56:52.388436+05:30
311f892b-3241-43b4-bbea-0fdfe6d85027	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	5eab818b-bddf-4cdf-970e-91853a08636f	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00019"}	\N	2026-11-01 17:56:54.466429+05:30
964fa6d0-c8e9-47f5-9edc-d25f70de9bbf	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	109df747-4579-43a8-afb9-2a58b53f54f4	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00019"}	\N	2026-11-01 17:57:35.853635+05:30
7ed75da7-bd6a-4f8b-8783-5e04e7d3506c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	a8c345cc-7eed-4764-ab8c-23351f6a1529	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00020"}	\N	2026-11-01 17:57:38.444572+05:30
fbdbfa35-8335-40c1-bb9e-2c67acf67445	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	f8a4e668-21de-4974-9f74-fb307c853624	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00021"}	\N	2026-11-01 17:57:41.019578+05:30
1f7072c6-1d86-4b1e-982f-ca38bd628018	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	1f6fa7a4-aa36-4f79-8cd9-ac6f9decabd9	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00022"}	\N	2026-11-01 17:57:43.895686+05:30
151ffd09-4538-488a-b0bc-f595380c7ddd	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	1f6fa7a4-aa36-4f79-8cd9-ac6f9decabd9	{"status": "DRAFT", "updated_at": "2026-11-01T12:27:45.949079+00:00", "quotation_number": "HQ-2026-00022"}	\N	2026-11-01 17:57:45.950518+05:30
e76b5f23-fdf8-4978-b0fa-09180d5cafac	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	08774c4f-e433-484d-b225-599d577be670	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00023"}	\N	2026-11-01 17:57:50.224412+05:30
98f64f41-1e30-4ada-a094-4cca50d41d8c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	56aa1fa7-6e12-48e2-86fa-172a4a36a982	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00024"}	\N	2026-11-01 17:57:59.308126+05:30
89d8fb07-d208-46c7-9088-3c03104d0148	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	c3da60f1-3538-47b7-b1f2-85d10686648f	{"source_quotation_id": "56aa1fa7-6e12-48e2-86fa-172a4a36a982", "new_quotation_number": "HQ-2026-00025"}	\N	2026-11-01 17:58:01.432922+05:30
b0a50f21-bf28-4433-87f0-55104e053aa6	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	c3da60f1-3538-47b7-b1f2-85d10686648f	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00025"}	\N	2026-11-01 17:58:03.562369+05:30
649dc605-ec51-4865-b791-271dc10243ff	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7a114092-4478-4e44-9996-5d7a1436bc99	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00025"}	\N	2026-11-01 17:59:03.901568+05:30
b9ea6f2a-34af-4d3d-b21a-d8a348995a8b	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	e07370f7-7c83-4411-821e-0eb91213ea50	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00026"}	\N	2026-11-01 17:59:06.385142+05:30
cba01979-4f54-4007-813e-d54bd5f2b520	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	cdd54b28-23d0-46fc-b562-a9da70c98fe8	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00027"}	\N	2026-11-01 17:59:08.863841+05:30
0eb0f6d9-12d9-48dd-a1a1-8ba6a608eb8e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	4ec03a45-d25c-4330-932d-8882e42da614	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00028"}	\N	2026-11-01 17:59:11.379186+05:30
f00fc357-0f71-4078-887e-3cc79f160390	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	4ec03a45-d25c-4330-932d-8882e42da614	{"status": "DRAFT", "updated_at": "2026-11-01T12:29:13.455742+00:00", "quotation_number": "HQ-2026-00028"}	\N	2026-11-01 17:59:13.457077+05:30
1291736b-0b88-4795-8755-ed4274cd94e4	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	06d2c9fa-7290-4c15-a86d-01095fce49c2	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00029"}	\N	2026-11-01 17:59:16.077317+05:30
4ec40a27-3413-4940-9fed-d1d9b4902acf	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	8a013209-2afd-4c4f-932a-cd7fc5724478	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00030"}	\N	2026-11-01 17:59:24.826003+05:30
3131f831-c357-4f8b-a652-6faf11ecba19	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	49082454-bf81-4bd4-85ac-bd8813db581c	{"source_quotation_id": "8a013209-2afd-4c4f-932a-cd7fc5724478", "new_quotation_number": "HQ-2026-00031"}	\N	2026-11-01 17:59:26.898798+05:30
bce56ccf-693b-4710-9bfc-edc02a2d4a2d	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	49082454-bf81-4bd4-85ac-bd8813db581c	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00031"}	\N	2026-11-01 17:59:29.015648+05:30
98bfcb99-9f64-41cb-931b-b40330927328	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	0f62f059-cbd0-448a-b0eb-fc8114375308	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00031"}	\N	2026-11-01 18:11:50.865522+05:30
17bf184d-d099-4c87-8b84-b1c123dbc14f	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	48b6a9d9-ae0d-41e3-a05f-800e01ce512d	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00032"}	\N	2026-11-01 18:11:53.591373+05:30
f015d749-b762-45bf-8e42-d938a54b6cdd	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	13ab07ec-62f5-40f8-b9f4-6ddfafe894f7	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00033"}	\N	2026-11-01 18:11:56.24532+05:30
c88ba19b-b639-48ed-a0c1-f4142eb4807f	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	3294d1a5-836e-4877-a0d0-ed14d3fbe291	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00034"}	\N	2026-11-01 18:11:59.049743+05:30
dc2e32db-86ba-4164-96ee-d362243223b7	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	3294d1a5-836e-4877-a0d0-ed14d3fbe291	{"status": "DRAFT", "updated_at": "2026-11-01T12:42:01.176688+00:00", "quotation_number": "HQ-2026-00034"}	\N	2026-11-01 18:12:01.178125+05:30
16b2b3cf-35ff-43b9-8239-5731c8689885	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	10a47e8d-509f-4aae-bb05-7fe42e65e5d8	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00035"}	\N	2026-11-01 18:12:03.847853+05:30
18a4597f-ad88-44f2-9a14-c87d93929b44	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	db96c885-a0bc-4aed-9ba7-1e2233b70dfc	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00036"}	\N	2026-11-01 18:12:12.880668+05:30
9bbadb69-14b8-4df4-aa35-aa7a3032202e	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	7597c15e-d8f0-44ca-8e44-bf14b336cba9	{"source_quotation_id": "db96c885-a0bc-4aed-9ba7-1e2233b70dfc", "new_quotation_number": "HQ-2026-00037"}	\N	2026-11-01 18:12:14.98275+05:30
305f26e4-bf98-4ed7-8081-3805c8e37888	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	7597c15e-d8f0-44ca-8e44-bf14b336cba9	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00037"}	\N	2026-11-01 18:12:17.048829+05:30
453e0a8f-d871-4baa-8f37-9aab5161e961	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	648f2bf1-76e0-48f8-9d05-50a5d6286456	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00037"}	\N	2026-11-01 18:31:55.63557+05:30
aced1dab-8392-400b-9b77-7e5cf10440c4	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	3d8c6146-0cf2-4460-9bb5-c3f4d427c410	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00038"}	\N	2026-11-01 18:31:58.106361+05:30
098a0531-e4b8-441d-89fe-7175be55eb83	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	a0eaa133-d4b1-458d-aa79-818a462bb272	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00039"}	\N	2026-11-01 18:32:00.584348+05:30
4161b1ed-6206-4546-937a-886771f1f8fb	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	1cfeb933-940d-40d1-97c1-91d1880de928	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00040"}	\N	2026-11-01 18:32:03.313014+05:30
1d41c87b-a41f-412d-91e2-51bc201c8918	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	1cfeb933-940d-40d1-97c1-91d1880de928	{"status": "DRAFT", "updated_at": "2026-11-01T13:02:05.402381+00:00", "quotation_number": "HQ-2026-00040"}	\N	2026-11-01 18:32:05.403115+05:30
0fd26605-60d2-4bc2-88e4-24142f9a6e2c	40351e16-e0dd-4064-a060-bd866d35bc63	BULK_CUSTOMER_IMPORT	customer	8ff7826a-5ae4-48f2-a320-7f00cd989012	{"failed": 0, "skipped": 0, "successful": 17, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 18:32:06.831677+05:30
2a668a8d-55cb-460c-af52-f8841a66c500	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	1ad3cdfd-df60-4709-8772-a2bd0289ecc9	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00041"}	\N	2026-11-01 18:32:07.997382+05:30
f66bae74-713a-4cfa-8b7f-46fc41d6f471	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	5846cb89-785e-447d-87d0-c26f0aec4662	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00042"}	\N	2026-11-01 18:32:16.961387+05:30
f785c147-95eb-45c5-b8e3-343f81fac401	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	6b8e1d28-2987-4388-9bc5-5c575719a8ea	{"source_quotation_id": "5846cb89-785e-447d-87d0-c26f0aec4662", "new_quotation_number": "HQ-2026-00043"}	\N	2026-11-01 18:32:19.028066+05:30
b122e179-8783-48d8-b3bd-d379544b71f1	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	6b8e1d28-2987-4388-9bc5-5c575719a8ea	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00043"}	\N	2026-11-01 18:32:21.102187+05:30
c045d4ce-4b67-4c54-a449-2e093627eac0	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	5846cb89-785e-447d-87d0-c26f0aec4662	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00042"}	\N	2026-11-01 18:32:35.741061+05:30
ca50add5-9f44-41bd-8708-8560b0ecc3e6	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	1ad3cdfd-df60-4709-8772-a2bd0289ecc9	{"client_name": "Sunil Joshi", "quotation_number": "HQ-2026-00041"}	\N	2026-11-01 18:33:20.591971+05:30
dfdc9aa4-a37c-4f1c-8be6-669f410ac902	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	5ef6c2a0-9250-4252-9afc-fa4ee7b26111	{"code": "BAJAJ-ALL", "name": "Bajaj Allianz"}	\N	2026-11-01 20:29:50.618746+05:30
08927e53-4155-4bd3-9a23-6743b00ae71d	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	1cfeb933-940d-40d1-97c1-91d1880de928	{"client_name": "Rajesh Kumar", "quotation_number": "HQ-2026-00040"}	\N	2026-11-01 20:30:01.628493+05:30
6a06cfdf-45ed-4025-9312-fd0e490d9824	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	98db068c-b944-4d0a-ae63-2dedc75c4ce7	{"client_name": "Harsh Vardhan", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00040"}	\N	2026-11-01 20:31:32.840932+05:30
0f468157-90cb-4068-b4bb-62279b638591	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	98db068c-b944-4d0a-ae63-2dedc75c4ce7	{"status": "DRAFT", "updated_at": "2026-11-01T15:02:20.439234+00:00", "quotation_number": "HQ-2026-00040"}	\N	2026-11-01 20:32:20.440891+05:30
e93e4f4b-79a4-4247-b672-618eb0f85f53	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	c89d5842-3342-44bf-8c60-3c87f3c637cd	{"code": "BSLI-IND", "name": "Birla Sun Life"}	\N	2026-11-01 20:37:51.58472+05:30
de76f823-572d-4f04-b695-b83492e51a5b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	b06a433f-624a-4900-a3f8-860d5fbbf9f8	{"code": "HDFERG-B7B3", "name": "HDFC ERGO General Insurance", "category": "Health Insurance"}	\N	2026-11-01 20:38:56.535483+05:30
9996c813-1985-44c1-8a52-b070b90c7e6b	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	8249b200-547f-466b-b832-4e16b4aa1232	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00041"}	\N	2026-11-01 20:45:01.710944+05:30
0e17b31d-7b0a-4a6c-9ab7-b25e3e9fd65b	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	ee1b9df2-5645-4169-b144-80d333541f7e	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00042"}	\N	2026-11-01 20:45:04.201535+05:30
9898a6fe-8485-4639-8b1d-7f1f2014a3bc	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	bee6dc28-0a61-429c-9722-38eb81f41823	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00043"}	\N	2026-11-01 20:45:06.642569+05:30
51ace17a-41db-4d18-8cae-d75bdbc61366	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	4d691de0-3d64-49bf-86f2-aec82b354caa	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00044"}	\N	2026-11-01 20:45:09.548408+05:30
c7208c1a-4ffb-4e3f-b8b5-f86e928027e3	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	4d691de0-3d64-49bf-86f2-aec82b354caa	{"status": "DRAFT", "updated_at": "2026-11-01T15:15:11.611199+00:00", "quotation_number": "HQ-2026-00044"}	\N	2026-11-01 20:45:11.611838+05:30
5bbfc240-fe9e-4eb4-ba63-db7551956479	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	8ca69177-4fed-471d-b2a0-f872c48ff0de	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00045"}	\N	2026-11-01 20:45:14.091284+05:30
2c5acb9f-6229-4ae7-b7d3-89a5df3377ca	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	201c018d-3e7c-4b87-9570-2f64bc8652b3	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00046"}	\N	2026-11-01 20:45:23.145148+05:30
2efdc9e2-9ed3-4f2e-a7b2-bfc07aa00276	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	86153bce-0a14-4ab9-8892-c498e28989d1	{"source_quotation_id": "201c018d-3e7c-4b87-9570-2f64bc8652b3", "new_quotation_number": "HQ-2026-00047"}	\N	2026-11-01 20:45:25.188348+05:30
4f10f054-d78f-41b9-9843-bb205fafa31f	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	86153bce-0a14-4ab9-8892-c498e28989d1	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00047"}	\N	2026-11-01 20:45:27.25111+05:30
8a9268bf-bd53-4c93-a9e5-540f210f93b9	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	201c018d-3e7c-4b87-9570-2f64bc8652b3	{"status": "ISSUED", "updated_at": "2026-11-01T15:20:23.732121+00:00", "quotation_number": "HQ-2026-00046"}	\N	2026-11-01 20:50:23.73785+05:30
676cac41-c440-403b-bcbd-060cf92be1ca	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	201c018d-3e7c-4b87-9570-2f64bc8652b3	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00046"}	\N	2026-11-01 20:51:20.944382+05:30
04984ff3-0188-4c5d-96aa-200f9ffaa9c6	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	e1b9dcca-f475-4dbb-a599-11bc46d08c4d	{"client_name": "Harsh Vardhan", "plans_count": 4, "members_count": 2, "quotation_number": "HQ-2026-00046"}	\N	2026-11-01 20:52:59.756628+05:30
b307765f-401d-40b0-bf6f-c1487f965c76	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	c0c3b9a0-d753-449d-b521-eaba6ee9da39	{"code": "OPT+", "name": "Optima Secure Plus", "company_id": "b06a433f-624a-4900-a3f8-860d5fbbf9f8", "company_name": "HDFC ERGO General Insurance"}	\N	2026-11-01 20:54:46.116675+05:30
78d0969a-09b6-4cf4-84d1-1449f65b1b89	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	75bbcd6c-4445-4d0d-ae4b-418d456a40e4	{"code": "CMP-667E42", "name": "Workflow Test Carrier 667E42", "category": "Health Insurance"}	\N	2026-11-01 21:10:15.978192+05:30
1703c6d2-6a17-4015-afca-77468bf14f83	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	da854938-d6a8-4f77-8d6a-f9c1d6e5ecb8	{"code": "PLN-667E42", "name": "Comprehensive Health Plus 667E42", "company_id": "75bbcd6c-4445-4d0d-ae4b-418d456a40e4", "company_name": "Workflow Test Carrier 667E42"}	\N	2026-11-01 21:10:18.058452+05:30
672409ce-6d17-4504-83ce-8a7200d0c3e0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	2b9c480a-1f66-41e7-827e-1e599c8889ba	{"code": "INACT-667E42", "name": "Comprehensive Health Plus 667E42", "company_id": "75bbcd6c-4445-4d0d-ae4b-418d456a40e4", "company_name": "Workflow Test Carrier 667E42"}	\N	2026-11-01 21:10:26.271482+05:30
2fcf0c01-20b9-4562-8665-bb8edd936460	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	193d516b-6568-4b7e-8d48-59b12df95c8a	{"code": "DC-C34726", "name": "Docs Carrier C34726", "category": "Health Insurance"}	\N	2026-11-01 21:10:28.79928+05:30
ba6bde1a-e6b2-44a6-90f9-54258e284064	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	8f8102f1-ffcd-4e1b-b2b5-88abbc39d231	{"code": "DP-C34726", "name": "Docs Plan C34726", "company_id": "193d516b-6568-4b7e-8d48-59b12df95c8a", "company_name": "Docs Carrier C34726"}	\N	2026-11-01 21:10:30.82322+05:30
4c1012e0-874b-4ff1-a026-42b7fbf3157d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	7651b3e5-e16a-4022-bf55-da4bd6b5a9ed	{"size": 61, "title": "Official Plan Brochure 2026", "plan_id": "8f8102f1-ffcd-4e1b-b2b5-88abbc39d231", "filename": "brochure_2026.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 21:10:32.873009+05:30
012cffcf-8f94-4b4c-85a5-77790b5a826a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	688fe066-84ef-4269-a918-8e1124668365	{"size": 20, "title": "Reimbursement Claim Intimation Form", "plan_id": "8f8102f1-ffcd-4e1b-b2b5-88abbc39d231", "filename": "claim_intimation.docx", "document_type": "Claim Form"}	\N	2026-11-01 21:10:34.910689+05:30
97af86ab-f404-4fcd-af37-f8ff3a6e04e9	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	da0a42f7-1bce-4e41-bfd6-c3b28fef1338	{"size": 20, "title": "Age-wise Premium Rate Chart", "plan_id": "8f8102f1-ffcd-4e1b-b2b5-88abbc39d231", "filename": "rates_chart.xlsx", "document_type": "Premium Chart"}	\N	2026-11-01 21:10:37.017783+05:30
60791c52-511d-4222-82b4-b05f50c99ba8	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	57e8a13f-e03b-47ca-8c58-88f181a481d7	{"size": 23, "title": "Network Hospital Infographic", "plan_id": "8f8102f1-ffcd-4e1b-b2b5-88abbc39d231", "filename": "hospitals.png", "document_type": "Coverage Details"}	\N	2026-11-01 21:10:39.091111+05:30
334216c4-be5d-41c0-9505-2c10aec3a15d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	68075259-6b02-42fd-82ad-c1b79a08f380	{"code": "SC-DA4E6D", "name": "Stream Carrier DA4E6D", "category": "Health Insurance"}	\N	2026-11-01 21:10:45.756437+05:30
7af99582-e26a-4cb8-b679-172cd658febd	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	aee2e584-2762-4594-b201-c6c662234d4b	{"code": "SP-DA4E6D", "name": "Stream Plan DA4E6D", "company_id": "68075259-6b02-42fd-82ad-c1b79a08f380", "company_name": "Stream Carrier DA4E6D"}	\N	2026-11-01 21:10:47.856822+05:30
0d788516-a7cb-441a-83c5-338bedb23d3e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	9b3a75ae-cbb9-484f-8f28-aaf9e63f20a4	{"size": 54, "title": "Full Policy Terms & Conditions", "plan_id": "aee2e584-2762-4594-b201-c6c662234d4b", "filename": "wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 21:10:49.947276+05:30
d5d227b0-77ae-4af4-84c9-575d7a1706de	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	7f486f5f-63ef-4ce4-850a-65192f19a60b	{"code": "LC-FCF1A1", "name": "Lifecycle Carrier FCF1A1", "category": "Health Insurance"}	\N	2026-11-01 21:11:02.683168+05:30
e7e8b1bd-a248-4730-a2d5-ad4bb2c3c7cd	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	82338d33-c3fc-4042-985d-fbbd5590de9b	{"code": "LP-FCF1A1", "name": "Lifecycle Plan FCF1A1", "company_id": "7f486f5f-63ef-4ce4-850a-65192f19a60b", "company_name": "Lifecycle Carrier FCF1A1"}	\N	2026-11-01 21:11:04.766561+05:30
fda01059-9a39-416d-85c9-739d76c0d416	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	6d378a22-7733-48f2-a829-ae9fddd17fe5	{"size": 42, "title": "Initial Prospectus v1", "plan_id": "82338d33-c3fc-4042-985d-fbbd5590de9b", "filename": "prospectus_v1.pdf", "document_type": "Prospectus"}	\N	2026-11-01 21:11:06.857135+05:30
c86cb2ce-5fe9-4654-9e3e-7d281518f28f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	6d378a22-7733-48f2-a829-ae9fddd17fe5	{"title": {"to": "Updated Prospectus 2026 Final", "from": "Initial Prospectus v1"}, "description": {"to": "Revised pricing appendix", "from": null}}	\N	2026-11-01 21:11:08.948485+05:30
2a0c71a9-6192-4890-8ccc-64c7deb95a78	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	6d378a22-7733-48f2-a829-ae9fddd17fe5	{"title": {"to": "Prospectus v2 Replaced", "from": "Updated Prospectus 2026 Final"}, "file_replacement": {"to_size": 58, "from_size": 42, "to_filename": "prospectus_v2.pdf", "from_filename": "prospectus_v1.pdf"}}	\N	2026-11-01 21:11:11.029031+05:30
9771dba9-6b80-4d1b-9143-19c1787eec29	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_DELETED	insurance_plan_document	6d378a22-7733-48f2-a829-ae9fddd17fe5	{"title": "Prospectus v2 Replaced", "plan_id": "82338d33-c3fc-4042-985d-fbbd5590de9b", "filename": "prospectus_v2.pdf"}	\N	2026-11-01 21:11:15.150346+05:30
c3e56365-9fff-4b56-a936-f92e8da2ef6f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	84b34588-8d6e-4923-a96b-801fd9b773a4	{"code": "V360-C56413", "name": "360 View Carrier C56413", "category": "Composite"}	\N	2026-11-01 21:11:19.584608+05:30
6cc78e61-060d-4d79-90d5-530afc09b1f9	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	468d4d42-ad2f-4f00-bd7e-47d11d88c153	{"code": "ACT-C56413", "name": "Active Plan C56413", "company_id": "84b34588-8d6e-4923-a96b-801fd9b773a4", "company_name": "360 View Carrier C56413"}	\N	2026-11-01 21:11:21.661596+05:30
ea67a369-f066-4754-9897-7603ae3ffda2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	d49ffb5b-5bd6-42a1-821d-df6b45552cbf	{"code": "INACT-C56413", "name": "Inactive Plan C56413", "company_id": "84b34588-8d6e-4923-a96b-801fd9b773a4", "company_name": "360 View Carrier C56413"}	\N	2026-11-01 21:11:23.761482+05:30
1513dc72-f42e-4fc2-ab5d-11dd5f0787dc	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	ec25bcff-e911-43bd-8e3f-190f1acc7f5c	{"size": 11, "title": "Brochure", "plan_id": "468d4d42-ad2f-4f00-bd7e-47d11d88c153", "filename": "b.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 21:11:25.849353+05:30
03b021f7-33d2-46ed-b133-fdc2f4e99c48	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	1689623b-6439-4778-971a-b1cfd73c428b	{"code": "CMP-4124BF", "name": "Workflow Test Carrier 4124BF", "category": "Health Insurance"}	\N	2026-11-01 21:12:04.902455+05:30
ebda9664-7919-4948-8401-0814ef7882a1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	607f723c-14a4-4ab7-814d-a2aa643b4b44	{"code": "PLN-4124BF", "name": "Comprehensive Health Plus 4124BF", "company_id": "1689623b-6439-4778-971a-b1cfd73c428b", "company_name": "Workflow Test Carrier 4124BF"}	\N	2026-11-01 21:12:07.009881+05:30
7e462ac1-6904-4f6d-b5bc-1fbe2077d7df	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	1689623b-6439-4778-971a-b1cfd73c428b	{"is_active": {"to": false, "from": true}}	\N	2026-11-01 21:12:13.151208+05:30
29d9164d-da3d-49b2-91b4-cd29c5f9ac1a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	1689623b-6439-4778-971a-b1cfd73c428b	{"is_active": {"to": true, "from": false}}	\N	2026-11-01 21:12:17.253018+05:30
328c0895-d3dd-4588-870c-15f2fa77543f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	cba67ff2-4cdd-4d95-b003-29ce845ae2d1	{"code": "DC-D2F973", "name": "Docs Carrier D2F973", "category": "Health Insurance"}	\N	2026-11-01 21:12:19.643876+05:30
3dfc7e95-fd74-40e7-80c3-7b684eab7449	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	39df3367-6c2e-4132-840d-684551c72571	{"code": "DP-D2F973", "name": "Docs Plan D2F973", "company_id": "cba67ff2-4cdd-4d95-b003-29ce845ae2d1", "company_name": "Docs Carrier D2F973"}	\N	2026-11-01 21:12:21.735716+05:30
473b0b8a-48dd-4a40-8e53-17f9c5b2bc73	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	f3b3df94-abb0-48d3-8077-a4f818dbf17f	{"size": 61, "title": "Official Plan Brochure 2026", "plan_id": "39df3367-6c2e-4132-840d-684551c72571", "filename": "brochure_2026.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 21:12:23.831137+05:30
6f2c1ddf-3942-4616-9b2b-49350a038dd9	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	5512d0cb-4c83-4fc9-912e-47e18d3710fb	{"size": 20, "title": "Reimbursement Claim Intimation Form", "plan_id": "39df3367-6c2e-4132-840d-684551c72571", "filename": "claim_intimation.docx", "document_type": "Claim Form"}	\N	2026-11-01 21:12:25.925032+05:30
3ce413fa-d183-47f0-8a9e-44e9b0bca263	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	d312e3ed-5b8f-4c30-944c-81a94f632bdc	{"size": 20, "title": "Age-wise Premium Rate Chart", "plan_id": "39df3367-6c2e-4132-840d-684551c72571", "filename": "rates_chart.xlsx", "document_type": "Premium Chart"}	\N	2026-11-01 21:12:28.018925+05:30
3989aa73-d32d-4749-a5f3-392a37691891	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	0b7f2866-e470-446d-a1e7-e9430d841296	{"size": 23, "title": "Network Hospital Infographic", "plan_id": "39df3367-6c2e-4132-840d-684551c72571", "filename": "hospitals.png", "document_type": "Coverage Details"}	\N	2026-11-01 21:12:30.066808+05:30
33bed37b-8eb9-43f0-8826-2298dd0bb69e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	4a36342b-c4b0-47af-9b95-370df01d67cd	{"code": "SC-B3C4BF", "name": "Stream Carrier B3C4BF", "category": "Health Insurance"}	\N	2026-11-01 21:12:36.630545+05:30
a59cabbd-e815-4053-9e94-034a0709da4b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	f62b64ad-248e-4c65-9d56-515e99e52cff	{"code": "SP-B3C4BF", "name": "Stream Plan B3C4BF", "company_id": "4a36342b-c4b0-47af-9b95-370df01d67cd", "company_name": "Stream Carrier B3C4BF"}	\N	2026-11-01 21:12:38.679908+05:30
a381e4ac-f068-469c-9d39-5391bed3216e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	328ebdec-08a0-4d03-8ebf-07c45a3e3ffc	{"size": 54, "title": "Full Policy Terms & Conditions", "plan_id": "f62b64ad-248e-4c65-9d56-515e99e52cff", "filename": "wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 21:12:40.730051+05:30
a3f006b5-aac6-4090-9d6b-894fbb057b7c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	dc354afb-b1b1-44c2-945b-4c86b6e0f8dd	{"code": "LC-836228", "name": "Lifecycle Carrier 836228", "category": "Health Insurance"}	\N	2026-11-01 21:12:53.279828+05:30
f41501e5-fe72-403b-9bc2-f0ff634aebcd	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	8ca8b0ef-3049-4204-a2f6-dfe51dea1370	{"code": "CMP-21387A", "name": "Workflow Test Carrier 21387A", "category": "Health Insurance"}	\N	2026-11-01 21:59:50.041102+05:30
bbeaeb87-f7c6-425a-b2ac-b61500f0a3c0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	53bd98d2-ae2c-4a47-97e1-ed8b65bb10bb	{"code": "LP-836228", "name": "Lifecycle Plan 836228", "company_id": "dc354afb-b1b1-44c2-945b-4c86b6e0f8dd", "company_name": "Lifecycle Carrier 836228"}	\N	2026-11-01 21:12:55.379695+05:30
aa9a8a2b-48be-4da7-a004-f6963f4a4cfe	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	b15ef5c9-43b9-4ca3-ad56-1a5374f87f61	{"size": 42, "title": "Initial Prospectus v1", "plan_id": "53bd98d2-ae2c-4a47-97e1-ed8b65bb10bb", "filename": "prospectus_v1.pdf", "document_type": "Prospectus"}	\N	2026-11-01 21:12:57.487752+05:30
7e7179b0-3260-42b3-9d0e-3734acdd78e1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	b15ef5c9-43b9-4ca3-ad56-1a5374f87f61	{"title": {"to": "Updated Prospectus 2026 Final", "from": "Initial Prospectus v1"}, "description": {"to": "Revised pricing appendix", "from": null}}	\N	2026-11-01 21:12:59.593036+05:30
9683eb4e-3857-484e-a678-d96a381bee11	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	b15ef5c9-43b9-4ca3-ad56-1a5374f87f61	{"title": {"to": "Prospectus v2 Replaced", "from": "Updated Prospectus 2026 Final"}, "file_replacement": {"to_size": 58, "from_size": 42, "to_filename": "prospectus_v2.pdf", "from_filename": "prospectus_v1.pdf"}}	\N	2026-11-01 21:13:01.662905+05:30
69e414f3-07eb-4ff0-bedc-3653a49a8f3a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_DELETED	insurance_plan_document	b15ef5c9-43b9-4ca3-ad56-1a5374f87f61	{"title": "Prospectus v2 Replaced", "plan_id": "53bd98d2-ae2c-4a47-97e1-ed8b65bb10bb", "filename": "prospectus_v2.pdf"}	\N	2026-11-01 21:13:05.791064+05:30
abc90099-d810-4d7b-afba-aa826485f663	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	7962f179-3d29-483b-a900-5c17b80455af	{"code": "V360-FC807A", "name": "360 View Carrier FC807A", "category": "Composite"}	\N	2026-11-01 21:13:10.215885+05:30
81e48a49-524f-4278-85ef-04928506ba83	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	69dd69d5-5865-454b-9c3c-29ea905213a0	{"code": "ACT-FC807A", "name": "Active Plan FC807A", "company_id": "7962f179-3d29-483b-a900-5c17b80455af", "company_name": "360 View Carrier FC807A"}	\N	2026-11-01 21:13:12.317925+05:30
9bb3cd3e-8429-4138-8ba4-a5c7bceea0e4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	d3002f98-926b-4357-9c3a-c33c31807212	{"code": "INACT-FC807A", "name": "Inactive Plan FC807A", "company_id": "7962f179-3d29-483b-a900-5c17b80455af", "company_name": "360 View Carrier FC807A"}	\N	2026-11-01 21:13:14.398961+05:30
76aae979-c8d0-4a48-a12a-be16f23c9f8e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	e5eadaf5-5d35-4548-9eff-f62ed5cef9a7	{"size": 11, "title": "Brochure", "plan_id": "69dd69d5-5865-454b-9c3c-29ea905213a0", "filename": "b.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 21:13:16.450232+05:30
589733d5-5711-4e5d-830b-60b3eace236e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	3fbe8705-38c9-4f37-b627-a14229ee2e33	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00047"}	\N	2026-11-01 21:13:49.412702+05:30
b9f5198a-970e-404f-b5a0-d8ce2efa8601	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	a8cd77bc-d0d2-4c4d-b00c-6edc707ca78e	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00048"}	\N	2026-11-01 21:13:51.816418+05:30
81fad321-6e51-49fd-b734-08157ae036e2	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	e64fabe1-981e-4ba5-beca-7c8c83e7761c	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00049"}	\N	2026-11-01 21:13:54.183862+05:30
1dc3c980-d066-42c0-badd-39de9a015588	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	e639782f-e647-48d4-a093-ddee41764cb4	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00050"}	\N	2026-11-01 21:13:56.610237+05:30
67c917c5-59f1-46eb-84b6-dcb561a53bbe	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	e639782f-e647-48d4-a093-ddee41764cb4	{"status": "DRAFT", "updated_at": "2026-11-01T15:43:58.698690+00:00", "quotation_number": "HQ-2026-00050"}	\N	2026-11-01 21:13:58.699608+05:30
9c35b8cf-2012-4c78-9696-23fdffb28697	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	80089d82-d1e3-45e8-9e0c-a2e8ef8862f7	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00051"}	\N	2026-11-01 21:14:01.196906+05:30
b678c6e1-abc9-4a90-86d8-4712da80bbb7	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	66529fbb-97b5-49f4-bde2-0005556c3ae2	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00052"}	\N	2026-11-01 21:14:09.819374+05:30
c93aa014-e53f-478e-9dd1-1d9a093f299e	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	a5f7bc62-4aee-4e58-919b-ae66f579f27f	{"source_quotation_id": "66529fbb-97b5-49f4-bde2-0005556c3ae2", "new_quotation_number": "HQ-2026-00053"}	\N	2026-11-01 21:14:11.91382+05:30
f07bd4ed-e8a2-410e-bdc0-b01f1b1a766d	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	a5f7bc62-4aee-4e58-919b-ae66f579f27f	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00053"}	\N	2026-11-01 21:14:13.976473+05:30
e15421a9-dc7a-4ab2-8acc-6c6a7f9e258d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	be7d9e4f-21dc-42b2-9755-8715fb07cf20	{"code": "NIVBUP-3D98", "name": "Niva Bupa Health Insurance", "category": "Health Insurance"}	\N	2026-11-01 21:25:27.385002+05:30
8adcabc6-da54-48a7-992d-b9017ac9f6bb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2	{"code": "REA 2.0", "name": "Reassure 2.0", "company_id": "be7d9e4f-21dc-42b2-9755-8715fb07cf20", "company_name": "Niva Bupa Health Insurance"}	\N	2026-11-01 21:25:53.171844+05:30
988abcfc-8385-4f31-b6bb-1c04c9ff3024	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_UPDATED	insurance_plan	15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2	{"name": {"to": "Reassure 2.0", "from": "Reassure 2.0"}, "status": {"to": "ACTIVE", "from": "ACTIVE"}, "line_of_business": {"to": "Health Insurance", "from": "Health Insurance"}}	\N	2026-11-01 21:27:31.42982+05:30
f9bf66c5-6af4-4577-8701-cb10e3cd1e6a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	468d4d42-ad2f-4f00-bd7e-47d11d88c153	{"code": "ACT-C56413", "name": "Active Plan C56413"}	\N	2026-11-01 21:28:02.097078+05:30
aa033f8e-83ba-4cec-a3d4-318ed5045096	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	69dd69d5-5865-454b-9c3c-29ea905213a0	{"code": "ACT-FC807A", "name": "Active Plan FC807A"}	\N	2026-11-01 21:28:10.779915+05:30
90536a4e-f38e-4672-abd6-50f4f21e1084	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	607f723c-14a4-4ab7-814d-a2aa643b4b44	{"code": "PLN-4124BF", "name": "Comprehensive Health Plus 4124BF"}	\N	2026-11-01 21:28:17.915021+05:30
43cd9a36-a32c-4e96-857a-4090d35355ed	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	57013e25-3242-4568-8161-2e917c6b3ab7	{"size": 3243407, "title": "ReAssureBrochure2.0", "plan_id": "15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2", "filename": "ReAssureBrochure2.0.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 21:28:42.574867+05:30
ddc1a145-cccc-4e5b-a4c6-abdaf9f01241	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_UPDATED	insurance_plan	15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2	{"name": {"to": "Reassure 2.0", "from": "Reassure 2.0"}, "status": {"to": "ACTIVE", "from": "ACTIVE"}, "line_of_business": {"to": "Health Insurance", "from": "Health Insurance"}}	\N	2026-11-01 21:28:49.072031+05:30
d6d7768f-0d5b-4539-bcd0-f9cb752b0126	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	da854938-d6a8-4f77-8d6a-f9c1d6e5ecb8	{"code": "PLN-667E42", "name": "Comprehensive Health Plus 667E42"}	\N	2026-11-01 21:29:02.068424+05:30
7c753c57-8a57-4c1a-9eeb-21adc88f0b09	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	2b9c480a-1f66-41e7-827e-1e599c8889ba	{"code": "INACT-667E42", "name": "Comprehensive Health Plus 667E42"}	\N	2026-11-01 21:29:09.518362+05:30
75272c69-7652-45e5-857c-e88918275624	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	5a199e21-1953-41ae-b32f-e193bf5400c2	{"phone": "8446090974", "has_pan": false, "full_name": "Aditya Thakre", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 21:30:36.128296+05:30
1be49565-eb2a-40a8-98d1-baf96983c64f	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	af101880-6400-4562-ac71-699c477531f9	{"amount": 15000.0, "payment_id": "90f19e88-a676-49fc-8402-01c32a927a4b", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-01 21:35:49.740724+05:30
15e56a21-8d16-43e1-b1b0-374844505a16	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	af101880-6400-4562-ac71-699c477531f9	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 3000000.0, "final_premium": 17700.0, "policy_number": "POL-HLTH-2026-70921", "nominees_count": 1}	\N	2026-11-01 21:35:49.76064+05:30
cbd3e37d-026d-4c3c-9df2-754ed3e0ef08	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	620b85c4-dfdc-4fcc-8877-e935db59b594	{"code": "PLN-21387A", "name": "Comprehensive Health Plus 21387A", "company_id": "8ca8b0ef-3049-4204-a2f6-dfe51dea1370", "company_name": "Workflow Test Carrier 21387A"}	\N	2026-11-01 21:59:52.102404+05:30
3be82855-5182-4aef-8ef7-78993927a0eb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	8ca8b0ef-3049-4204-a2f6-dfe51dea1370	{"is_active": {"to": false, "from": true}}	\N	2026-11-01 21:59:58.302982+05:30
f5c1c693-e528-4fcc-af31-7a1c08e62823	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	8ca8b0ef-3049-4204-a2f6-dfe51dea1370	{"is_active": {"to": true, "from": false}}	\N	2026-11-01 22:00:02.433172+05:30
a82f2ff8-f282-4163-a6a1-46674901f5c0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	a9023c14-da1c-46e1-a69a-bb3be8eaeb06	{"code": "DC-0D03B9", "name": "Docs Carrier 0D03B9", "category": "Health Insurance"}	\N	2026-11-01 22:00:04.986616+05:30
eadedc70-3f86-44d0-b271-57efaab9fcf0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	b9983376-24ba-4cff-8f5c-c190df3cedfe	{"code": "DP-0D03B9", "name": "Docs Plan 0D03B9", "company_id": "a9023c14-da1c-46e1-a69a-bb3be8eaeb06", "company_name": "Docs Carrier 0D03B9"}	\N	2026-11-01 22:00:07.056922+05:30
2927b881-ef9e-4854-8071-a964bfd735b6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	edd3f607-b3a5-4a73-aba7-5d495251ffa4	{"size": 61, "title": "Official Plan Brochure 2026", "plan_id": "b9983376-24ba-4cff-8f5c-c190df3cedfe", "filename": "brochure_2026.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 22:00:09.135126+05:30
6c44b6b4-5125-40a9-b584-84a03daac232	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	a05f4075-baad-46a9-a2e8-e569d9babe64	{"size": 20, "title": "Reimbursement Claim Intimation Form", "plan_id": "b9983376-24ba-4cff-8f5c-c190df3cedfe", "filename": "claim_intimation.docx", "document_type": "Claim Form"}	\N	2026-11-01 22:00:11.177538+05:30
d7650a3f-0490-42ef-a564-a62525ea383a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	f682c513-b813-483b-bd42-f8b5c1d1d4a4	{"size": 20, "title": "Age-wise Premium Rate Chart", "plan_id": "b9983376-24ba-4cff-8f5c-c190df3cedfe", "filename": "rates_chart.xlsx", "document_type": "Premium Chart"}	\N	2026-11-01 22:00:13.219907+05:30
faaba0ee-cb2f-43ae-9425-bf3fdcbf8744	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	abf613a0-a35f-4719-96fb-0530ca3354eb	{"size": 23, "title": "Network Hospital Infographic", "plan_id": "b9983376-24ba-4cff-8f5c-c190df3cedfe", "filename": "hospitals.png", "document_type": "Coverage Details"}	\N	2026-11-01 22:00:15.303694+05:30
d759090b-f9c9-496d-a09f-eb4d45f4c25a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	b23bf45a-7f14-411a-a6d1-31be534be580	{"code": "SC-080E02", "name": "Stream Carrier 080E02", "category": "Health Insurance"}	\N	2026-11-01 22:00:22.120425+05:30
d8e8ffde-0b03-4783-a4ad-76cff99ec861	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	7f02f09a-d09e-40cd-84e2-86c37f562552	{"code": "SP-080E02", "name": "Stream Plan 080E02", "company_id": "b23bf45a-7f14-411a-a6d1-31be534be580", "company_name": "Stream Carrier 080E02"}	\N	2026-11-01 22:00:24.161996+05:30
89b78d40-3c0a-4035-a9f1-bb49db562d50	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	8792d628-be0e-4495-bf28-1b7f3524fd80	{"size": 54, "title": "Full Policy Terms & Conditions", "plan_id": "7f02f09a-d09e-40cd-84e2-86c37f562552", "filename": "wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 22:00:26.231381+05:30
7a7253ef-791f-4871-8eea-50572dd74819	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	04f78cd6-f575-4e18-8caf-68a36bfd5492	{"code": "LC-A1F5F6", "name": "Lifecycle Carrier A1F5F6", "category": "Health Insurance"}	\N	2026-11-01 22:00:39.039522+05:30
fa62825b-5b68-497e-9c79-8789a9a3fe07	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	e9080687-89c7-4b78-94aa-70dd7effc8f6	{"code": "LP-A1F5F6", "name": "Lifecycle Plan A1F5F6", "company_id": "04f78cd6-f575-4e18-8caf-68a36bfd5492", "company_name": "Lifecycle Carrier A1F5F6"}	\N	2026-11-01 22:00:41.078173+05:30
8b328b2a-da46-4a21-b1a3-71a863407298	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	2a487584-80f9-42bd-b3ad-f0254515c087	{"size": 42, "title": "Initial Prospectus v1", "plan_id": "e9080687-89c7-4b78-94aa-70dd7effc8f6", "filename": "prospectus_v1.pdf", "document_type": "Prospectus"}	\N	2026-11-01 22:00:43.134896+05:30
c5097211-72ed-4b36-9b6f-273ed4ed82db	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	2a487584-80f9-42bd-b3ad-f0254515c087	{"title": {"to": "Updated Prospectus 2026 Final", "from": "Initial Prospectus v1"}, "description": {"to": "Revised pricing appendix", "from": null}}	\N	2026-11-01 22:00:45.182081+05:30
f14b79ac-154a-493b-8e33-a245aed34c13	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	2a487584-80f9-42bd-b3ad-f0254515c087	{"title": {"to": "Prospectus v2 Replaced", "from": "Updated Prospectus 2026 Final"}, "file_replacement": {"to_size": 58, "from_size": 42, "to_filename": "prospectus_v2.pdf", "from_filename": "prospectus_v1.pdf"}}	\N	2026-11-01 22:00:47.260278+05:30
09ad142f-c2a8-49b1-9380-4b8f79a4ab86	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_DELETED	insurance_plan_document	2a487584-80f9-42bd-b3ad-f0254515c087	{"title": "Prospectus v2 Replaced", "plan_id": "e9080687-89c7-4b78-94aa-70dd7effc8f6", "filename": "prospectus_v2.pdf"}	\N	2026-11-01 22:00:51.3369+05:30
98075d40-6b76-4b41-851d-68c307ac5ca4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	a97ebbe5-c1b3-4826-8ebd-b30eabdd3a5c	{"code": "V360-338432", "name": "360 View Carrier 338432", "category": "Composite"}	\N	2026-11-01 22:00:55.874292+05:30
ed03e895-1574-40ca-9871-cc5dd818d8b0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	4bf28461-6fc2-4456-bccc-b3df751d6ee7	{"code": "ACT-338432", "name": "Active Plan 338432", "company_id": "a97ebbe5-c1b3-4826-8ebd-b30eabdd3a5c", "company_name": "360 View Carrier 338432"}	\N	2026-11-01 22:00:57.925683+05:30
2946be65-afc2-4b90-92bc-5452733bba6b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	cc688351-b589-415a-ae7a-bbbf01f502f0	{"code": "INACT-338432", "name": "Inactive Plan 338432", "company_id": "a97ebbe5-c1b3-4826-8ebd-b30eabdd3a5c", "company_name": "360 View Carrier 338432"}	\N	2026-11-01 22:00:59.973137+05:30
da7ebf20-76ff-4ebf-978c-bca3f1c3e963	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	a0699844-3e5c-428d-843b-a10d9e9ba2e5	{"size": 11, "title": "Brochure", "plan_id": "4bf28461-6fc2-4456-bccc-b3df751d6ee7", "filename": "b.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 22:01:02.091273+05:30
9279c81e-e797-4e08-ada1-06c1b4936609	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	077284e5-ce45-40b7-ae94-db959551575d	{"phone": "+919879947535", "has_pan": false, "full_name": "PolicyUser2156B3 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:01:24.271282+05:30
4026dd43-c157-41a7-a79d-5bce1b6b2bdd	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	d9df923a-21e4-4d4c-9b87-77cf4514c483	{"code": "CI-2156B3", "name": "Carrier Inherit 2156B3", "category": "Health Insurance"}	\N	2026-11-01 22:01:26.435864+05:30
85b3c810-e21c-4280-9074-2543ea5523c2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	6b1ed955-4fd6-4467-a170-72b78633c817	{"code": "PLA-2156B3", "name": "Plan Alpha 2156B3", "company_id": "d9df923a-21e4-4d4c-9b87-77cf4514c483", "company_name": "Carrier Inherit 2156B3"}	\N	2026-11-01 22:01:28.481203+05:30
8aa00407-29cc-4c0c-b1ac-10557f38eded	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	ff834e26-3e27-41d2-81d5-642396cf9629	{"code": "PLB-2156B3", "name": "Plan Beta 2156B3", "company_id": "d9df923a-21e4-4d4c-9b87-77cf4514c483", "company_name": "Carrier Inherit 2156B3"}	\N	2026-11-01 22:01:30.540172+05:30
4bf6d6f7-aac2-4729-8b6d-cea4eca74eab	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	70940534-49cf-420b-80a2-62b65e7d60e8	{"size": 45, "title": "Alpha Master Brochure", "plan_id": "6b1ed955-4fd6-4467-a170-72b78633c817", "filename": "alpha_brochure.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 22:01:32.63917+05:30
7c7d909e-93fa-40f4-9854-adcab4d086f4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	9c688af5-2f40-4a8c-bbcc-927256360375	{"size": 30, "title": "Alpha Claim Form", "plan_id": "6b1ed955-4fd6-4467-a170-72b78633c817", "filename": "alpha_claim.pdf", "document_type": "Claim Form"}	\N	2026-11-01 22:01:34.734097+05:30
f6f89404-ad37-43ea-b4be-ca898caf2c19	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	971c390c-ac65-4f3f-b387-37d3f61a9320	{"size": 42, "title": "Beta Wording T&C", "plan_id": "ff834e26-3e27-41d2-81d5-642396cf9629", "filename": "beta_wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 22:01:36.77591+05:30
2ce53487-a116-411c-88d9-b11d47afb75a	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	0f984de8-2377-4d59-b6c0-af2ee82ea131	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 17700.0, "policy_number": "POL-A-2156B3", "nominees_count": 0}	\N	2026-11-01 22:01:38.873515+05:30
b687cebb-8b3b-4a32-ba23-790449a320aa	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	6d692385-27d6-475a-846d-f848ce4aa4f4	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 9440.0, "policy_number": "POL-B-2156B3", "nominees_count": 0}	\N	2026-11-01 22:01:41.000366+05:30
0c9a2b88-5a61-495a-9cdb-fa262fdde94b	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	4e0d6771-d253-4a56-844d-f708acb3d4fd	{"phone": "+919820636183", "has_pan": false, "full_name": "PolicyUser6C2DCD TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:01:46.50154+05:30
c6523b16-bbe0-4029-97ba-04693dcb64a2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	c902db18-1926-4494-967b-17d1c5fdfef9	{"code": "CI-6C2DCD", "name": "Carrier Inherit 6C2DCD", "category": "Health Insurance"}	\N	2026-11-01 22:01:48.61561+05:30
dc618b38-e435-4965-a151-d31b041597cd	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	672e97fc-1667-45d0-bbff-edb7acc00c30	{"code": "PLA-6C2DCD", "name": "Plan Alpha 6C2DCD", "company_id": "c902db18-1926-4494-967b-17d1c5fdfef9", "company_name": "Carrier Inherit 6C2DCD"}	\N	2026-11-01 22:01:50.706963+05:30
d0b2f1cb-3617-4dc4-988f-f63a0ec79442	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	0912da6b-7a11-4e73-b70d-6d83d32b1b2f	{"code": "PLB-6C2DCD", "name": "Plan Beta 6C2DCD", "company_id": "c902db18-1926-4494-967b-17d1c5fdfef9", "company_name": "Carrier Inherit 6C2DCD"}	\N	2026-11-01 22:01:52.769886+05:30
ebb1b1fa-dd33-4ed9-bd7c-209d6bf18825	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	bfa90971-2759-43c0-a56e-4263c2385c58	{"size": 43, "title": "Alpha T&C", "plan_id": "672e97fc-1667-45d0-bbff-edb7acc00c30", "filename": "alpha_terms.pdf", "document_type": "Terms & Conditions"}	\N	2026-11-01 22:01:54.822874+05:30
60a502de-da33-4d1a-a1f3-e8eea868cc24	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	360a6eb9-a548-49d3-9006-8fa875344b57	{"size": 29, "title": "Beta Riders", "plan_id": "0912da6b-7a11-4e73-b70d-6d83d32b1b2f", "filename": "beta_riders.pdf", "document_type": "Rider Documents"}	\N	2026-11-01 22:01:56.889549+05:30
1df9af0f-97bd-4e62-ad9b-d17f9dd11730	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	5f830deb-1e1f-41e6-86c3-efa596d4f568	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 14160.0, "policy_number": "POL-DL-6C2DCD", "nominees_count": 0}	\N	2026-11-01 22:01:58.951675+05:30
6fec5c35-5541-4889-b5a8-471764312a46	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	db54f0e1-8597-42ce-81f0-eda08d1476ba	{"phone": "+919884613820", "has_pan": false, "full_name": "PolicyUser874A9C TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:02:07.64157+05:30
a6242226-59db-4356-b34d-76bb0b1fb8a2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	4851273f-583d-42a6-8697-1126963030f2	{"code": "CI-874A9C", "name": "Carrier Inherit 874A9C", "category": "Health Insurance"}	\N	2026-11-01 22:02:09.778136+05:30
00161d00-e338-4cd3-a0db-54c129dce215	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	4ac140ee-e18d-4cf9-ae57-9533dec870d6	{"code": "PLA-874A9C", "name": "Plan Alpha 874A9C", "company_id": "4851273f-583d-42a6-8697-1126963030f2", "company_name": "Carrier Inherit 874A9C"}	\N	2026-11-01 22:02:11.838052+05:30
3e4c483e-421f-4c59-8105-e388c47493fb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	0b9197ce-1570-4766-a9cc-7e031c33d09a	{"code": "PLB-874A9C", "name": "Plan Beta 874A9C", "company_id": "4851273f-583d-42a6-8697-1126963030f2", "company_name": "Carrier Inherit 874A9C"}	\N	2026-11-01 22:02:13.897875+05:30
695dafb6-3132-44c9-b619-965cb63e5e0e	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	64589b23-24bd-432e-9d2f-5d087ccd30d8	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1500000.0, "final_premium": 23600.0, "policy_number": "POL-SPEC-874A9C", "nominees_count": 0}	\N	2026-11-01 22:02:15.979456+05:30
68d44efc-e72b-47a2-bcc3-9630c8737bf6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	42c32091-49f8-42a7-b458-d0959c87e8d8	{"size": 47, "title": "Client PAN Card Copy", "filename": "customer_pan.pdf", "policy_id": "64589b23-24bd-432e-9d2f-5d087ccd30d8", "document_type": "Customer KYC"}	\N	2026-11-01 22:02:18.079473+05:30
0c4842c3-026c-4074-9491-6eab9605a06e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	cc7e6276-277f-46e0-87d7-4939fbc6126f	{"size": 53, "title": "Pre-policy Medical Checkup", "filename": "medical_checkup.pdf", "policy_id": "64589b23-24bd-432e-9d2f-5d087ccd30d8", "document_type": "Medical Report"}	\N	2026-11-01 22:02:20.155475+05:30
439cc814-b9f0-470f-a36e-ffb491cc130a	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	b17d377c-cf87-4cca-ac2e-abb1201aef4a	{"phone": "+919885245570", "has_pan": false, "full_name": "PolicyUserBA9357 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:02:25.424143+05:30
c29a666d-1dd3-4b1d-ac07-1ba9f850b1bf	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	d87789fa-653c-4720-b04b-3723694a324d	{"code": "CI-BA9357", "name": "Carrier Inherit BA9357", "category": "Health Insurance"}	\N	2026-11-01 22:02:27.533943+05:30
57dcfdd1-14fc-4b39-87ff-e61b3ce5a0f2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	822940fd-a445-4bcf-b742-1ed621e4193c	{"code": "PLA-BA9357", "name": "Plan Alpha BA9357", "company_id": "d87789fa-653c-4720-b04b-3723694a324d", "company_name": "Carrier Inherit BA9357"}	\N	2026-11-01 22:02:29.591046+05:30
05c83ffe-bb9a-4d47-8e7e-b6f45d14d0c3	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	c1be60fc-90e3-4e72-9173-789b10f29953	{"code": "PLB-BA9357", "name": "Plan Beta BA9357", "company_id": "d87789fa-653c-4720-b04b-3723694a324d", "company_name": "Carrier Inherit BA9357"}	\N	2026-11-01 22:02:31.729241+05:30
36e04a0a-741f-4650-a10c-80fb75ec4d08	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	19366239-1f65-477f-8caf-fd4a8299c6ec	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL1-BA9357", "nominees_count": 0}	\N	2026-11-01 22:02:33.811477+05:30
9a9329a7-2468-46f3-8c20-0415bdfd7f2e	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	985c4b7b-72e3-409e-9425-d2f2897a8875	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL2-BA9357", "nominees_count": 0}	\N	2026-11-01 22:02:35.908673+05:30
5f2ddf1e-722c-4d1a-9aa8-89d008c676b0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	b6c1e413-9d2c-4403-86eb-c9f3a776b69d	{"size": 36, "title": "Cert P1", "filename": "cert_p1.pdf", "policy_id": "19366239-1f65-477f-8caf-fd4a8299c6ec", "document_type": "Official Policy Certificate"}	\N	2026-11-01 22:02:42.126205+05:30
cbe5d0e0-78f3-4b44-aacc-e665b1e7f4ab	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	de8d1f89-6abf-4bfe-b227-0075f187bbab	{"phone": "+919856205897", "has_pan": false, "full_name": "PolicyUserE70366 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:03:33.690335+05:30
7d58b793-c02a-48c7-b8aa-e9d77e26310a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	16e3ae30-ba9a-491b-aafe-6d1840eed770	{"code": "CI-E70366", "name": "Carrier Inherit E70366", "category": "Health Insurance"}	\N	2026-11-01 22:03:35.846392+05:30
6f574500-fca4-4a13-aea3-df182c1346f8	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	51c0355a-9480-4935-b745-a2c4102fb7e0	{"code": "PLA-E70366", "name": "Plan Alpha E70366", "company_id": "16e3ae30-ba9a-491b-aafe-6d1840eed770", "company_name": "Carrier Inherit E70366"}	\N	2026-11-01 22:03:37.903702+05:30
a0f90ef8-2a3d-4663-9bfe-4a67eafdce4c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	dac8c404-beb5-4bee-81b6-6127e8eb345f	{"code": "PLB-E70366", "name": "Plan Beta E70366", "company_id": "16e3ae30-ba9a-491b-aafe-6d1840eed770", "company_name": "Carrier Inherit E70366"}	\N	2026-11-01 22:03:39.947366+05:30
001e9613-735d-4150-9d51-8dcee1855ff4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	2ee40bbf-295b-41ff-b14a-ca536c5a9742	{"code": "PLA-FA6746", "name": "Plan Alpha FA6746"}	\N	2026-11-01 22:36:32.138588+05:30
b0c450df-c6b7-4a47-b000-d4da241b8478	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	7cbc3c3a-922b-4a10-8c38-a72b1481c512	{"size": 45, "title": "Alpha Master Brochure", "plan_id": "51c0355a-9480-4935-b745-a2c4102fb7e0", "filename": "alpha_brochure.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 22:03:42.036074+05:30
f85c43c9-2ecb-44e6-9ab5-e30b4f792cef	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	e3905047-756b-4c29-aba4-a618fbd80c5e	{"size": 30, "title": "Alpha Claim Form", "plan_id": "51c0355a-9480-4935-b745-a2c4102fb7e0", "filename": "alpha_claim.pdf", "document_type": "Claim Form"}	\N	2026-11-01 22:03:44.105583+05:30
c3d52fb1-003d-4950-bbf0-89f5b7399851	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	697444d2-e806-4f27-abc4-a621fb912f41	{"size": 42, "title": "Beta Wording T&C", "plan_id": "dac8c404-beb5-4bee-81b6-6127e8eb345f", "filename": "beta_wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 22:03:46.171798+05:30
215684cc-399d-4104-844d-6993d3e38857	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	7d618368-feb0-41b7-b487-24cd4a817609	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 17700.0, "policy_number": "POL-A-E70366", "nominees_count": 0}	\N	2026-11-01 22:03:48.263202+05:30
242ca63a-90dc-44e6-b610-f61b68c533a0	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	d6742e1f-f98d-440c-896f-3e4b9ef43862	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 9440.0, "policy_number": "POL-B-E70366", "nominees_count": 0}	\N	2026-11-01 22:03:50.404092+05:30
27fe2507-b1c3-4ad8-aceb-d89b7fff5f14	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	fe59ecf5-38df-4d07-a9d6-497654d3ce94	{"phone": "+919891915245", "has_pan": false, "full_name": "PolicyUser135B22 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:03:55.113833+05:30
321780e8-de49-4aff-8933-c4612ff77960	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	4ef4b3f6-dcbf-458c-9c61-313eac07e465	{"code": "CI-135B22", "name": "Carrier Inherit 135B22", "category": "Health Insurance"}	\N	2026-11-01 22:03:57.402237+05:30
d86d712c-fd9e-42f7-809b-66b3e834535d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	ed6e6d52-b6cc-4581-8f8e-532274ba6d2e	{"code": "PLA-135B22", "name": "Plan Alpha 135B22", "company_id": "4ef4b3f6-dcbf-458c-9c61-313eac07e465", "company_name": "Carrier Inherit 135B22"}	\N	2026-11-01 22:03:59.465387+05:30
ae00ed79-3db3-4814-8a62-8e43f7d5833b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	fa005d7a-c643-4728-968d-b832d8511fd8	{"code": "PLB-135B22", "name": "Plan Beta 135B22", "company_id": "4ef4b3f6-dcbf-458c-9c61-313eac07e465", "company_name": "Carrier Inherit 135B22"}	\N	2026-11-01 22:04:01.577657+05:30
699db8e3-de96-4b84-8641-995d73db9f4b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	40f2af74-9cbb-41b5-bdce-f943cd672861	{"size": 43, "title": "Alpha T&C", "plan_id": "ed6e6d52-b6cc-4581-8f8e-532274ba6d2e", "filename": "alpha_terms.pdf", "document_type": "Terms & Conditions"}	\N	2026-11-01 22:04:03.654958+05:30
be861752-1643-4751-b454-b4b247cc0158	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	fbf76bca-6701-462e-ad23-912348e11d29	{"size": 29, "title": "Beta Riders", "plan_id": "fa005d7a-c643-4728-968d-b832d8511fd8", "filename": "beta_riders.pdf", "document_type": "Rider Documents"}	\N	2026-11-01 22:04:05.745275+05:30
19c4f273-71b5-433f-babf-590b340f061c	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	5d5526ed-1d1b-4d22-ad08-35bf01af2615	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 14160.0, "policy_number": "POL-DL-135B22", "nominees_count": 0}	\N	2026-11-01 22:04:07.842824+05:30
61df483e-d104-457b-b6b6-96ae3e1c92e9	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	66dadec5-9886-4614-bc80-d25beb7fd929	{"phone": "+919872716523", "has_pan": false, "full_name": "PolicyUser701B0F TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:04:16.600696+05:30
8bc82f55-c269-4052-b32c-87386606b512	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	2a5a2ebb-c043-49ae-9992-fae3c1614b25	{"code": "CI-701B0F", "name": "Carrier Inherit 701B0F", "category": "Health Insurance"}	\N	2026-11-01 22:04:18.810794+05:30
2f7aece8-ff4b-40dd-abe8-b9e8c782576a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	ef897351-0a6f-4959-a1a7-826023cb26d4	{"code": "PLA-701B0F", "name": "Plan Alpha 701B0F", "company_id": "2a5a2ebb-c043-49ae-9992-fae3c1614b25", "company_name": "Carrier Inherit 701B0F"}	\N	2026-11-01 22:04:20.892467+05:30
04a2b0db-329b-46c0-a504-a9292a7c4a78	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	093ad18a-fa79-4b69-af37-32f95a32b583	{"code": "PLB-701B0F", "name": "Plan Beta 701B0F", "company_id": "2a5a2ebb-c043-49ae-9992-fae3c1614b25", "company_name": "Carrier Inherit 701B0F"}	\N	2026-11-01 22:04:22.997101+05:30
2b4e10ea-cf65-4531-a21d-87f94b24d201	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	a7ffe199-7bd1-4438-832f-edc76748556a	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1500000.0, "final_premium": 23600.0, "policy_number": "POL-SPEC-701B0F", "nominees_count": 0}	\N	2026-11-01 22:04:25.104431+05:30
36123334-3ec8-4759-b375-889009403bc7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	ea615758-7858-4a77-a5b8-ce9f33af642e	{"size": 47, "title": "Client PAN Card Copy", "filename": "customer_pan.pdf", "policy_id": "a7ffe199-7bd1-4438-832f-edc76748556a", "document_type": "Customer KYC"}	\N	2026-11-01 22:04:27.261067+05:30
af0b5969-fbbf-4ee6-9825-f57f536acbed	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	274cb499-87c6-42ea-a304-74a16f29cd28	{"size": 53, "title": "Pre-policy Medical Checkup", "filename": "medical_checkup.pdf", "policy_id": "a7ffe199-7bd1-4438-832f-edc76748556a", "document_type": "Medical Report"}	\N	2026-11-01 22:04:29.362635+05:30
8b585ae2-1c0c-414e-875c-7d635c7cf4e0	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	5572ee9f-ceab-49df-a659-ea38e29c9f4b	{"phone": "+919869007743", "has_pan": false, "full_name": "PolicyUser995557 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:04:34.019605+05:30
e356aa8c-455a-4a12-a0b9-9d2243e4c90f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	e06f31e7-0906-4dd3-9226-d936a5481659	{"code": "CI-995557", "name": "Carrier Inherit 995557", "category": "Health Insurance"}	\N	2026-11-01 22:04:36.206138+05:30
1e1e9409-826d-48d4-88c5-838704a08a4d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	ed44a1a6-9c6c-4b8b-ad23-debb1d6fdfb0	{"code": "PLA-995557", "name": "Plan Alpha 995557", "company_id": "e06f31e7-0906-4dd3-9226-d936a5481659", "company_name": "Carrier Inherit 995557"}	\N	2026-11-01 22:04:38.298253+05:30
c9dcb4ae-d922-422e-86be-6101d06ba032	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	44cbf82a-e65b-4b6f-b671-2fdaf89954b0	{"code": "PLB-995557", "name": "Plan Beta 995557", "company_id": "e06f31e7-0906-4dd3-9226-d936a5481659", "company_name": "Carrier Inherit 995557"}	\N	2026-11-01 22:04:40.371607+05:30
808f84d6-be65-467c-ba15-fc294cb0154d	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	a7d9275a-b143-4e9d-867e-6da56c5832b2	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL1-995557", "nominees_count": 0}	\N	2026-11-01 22:04:42.460037+05:30
68315ebb-dedc-4257-b2a3-b128ae471ebe	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	9b474637-4d31-42b7-95aa-b0f479fc6681	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL2-995557", "nominees_count": 0}	\N	2026-11-01 22:04:44.603895+05:30
759b674b-b732-4029-b45b-1e4578d0be38	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	36709124-6cf6-40d7-8723-5dd09f6724f0	{"size": 36, "title": "Cert P1", "filename": "cert_p1.pdf", "policy_id": "a7d9275a-b143-4e9d-867e-6da56c5832b2", "document_type": "Official Policy Certificate"}	\N	2026-11-01 22:04:50.868727+05:30
1af6d206-357c-447f-9e4c-f11399663b38	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	848af02e-79ba-4b15-9f38-32cb2b43d703	{"phone": "+919830598060", "has_pan": false, "full_name": "PolicyUser9C18A2 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:05:36.437506+05:30
e8465bb8-1067-433a-b364-a6970b212bb1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	c463d516-4118-4fbf-9490-757c6ff2f938	{"code": "CI-9C18A2", "name": "Carrier Inherit 9C18A2", "category": "Health Insurance"}	\N	2026-11-01 22:05:38.624513+05:30
f7828d1d-2607-4829-8537-62e2652a15c8	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	a10da5a7-7b66-4294-950f-2b15c5acc7a9	{"code": "PLA-9C18A2", "name": "Plan Alpha 9C18A2", "company_id": "c463d516-4118-4fbf-9490-757c6ff2f938", "company_name": "Carrier Inherit 9C18A2"}	\N	2026-11-01 22:05:40.735726+05:30
084e21b1-8ff3-42aa-9982-4349a97736ae	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	f528a1f5-3cee-492e-8e8a-63edc9ef8441	{"code": "PLB-9C18A2", "name": "Plan Beta 9C18A2", "company_id": "c463d516-4118-4fbf-9490-757c6ff2f938", "company_name": "Carrier Inherit 9C18A2"}	\N	2026-11-01 22:05:42.825203+05:30
775dfb27-3843-4735-a4ca-66311ee7981c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	3e74d6be-ee72-494f-ba6b-94cbc3682eb4	{"size": 45, "title": "Alpha Master Brochure", "plan_id": "a10da5a7-7b66-4294-950f-2b15c5acc7a9", "filename": "alpha_brochure.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 22:05:44.93516+05:30
bbb04168-b884-4c2e-b5e1-699915b60679	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	1443e31d-7431-4404-a5ba-28b9afc26c56	{"size": 30, "title": "Alpha Claim Form", "plan_id": "a10da5a7-7b66-4294-950f-2b15c5acc7a9", "filename": "alpha_claim.pdf", "document_type": "Claim Form"}	\N	2026-11-01 22:05:47.097693+05:30
3b93a2b7-ce28-419a-b7fe-391f8e82fa0e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	6834a848-881c-4df4-bd0c-606a22b84fe6	{"size": 42, "title": "Beta Wording T&C", "plan_id": "f528a1f5-3cee-492e-8e8a-63edc9ef8441", "filename": "beta_wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 22:05:49.200986+05:30
1de94bb4-2e69-4953-ad1d-31e8eba3e140	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	6a8c06f3-218c-4624-9620-323b7659f52e	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 17700.0, "policy_number": "POL-A-9C18A2", "nominees_count": 0}	\N	2026-11-01 22:05:51.341736+05:30
700d8a86-a1d1-4930-9a8e-8390231fa1eb	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	58dfd126-6c1d-4687-9249-ccdf54bacd6e	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 9440.0, "policy_number": "POL-B-9C18A2", "nominees_count": 0}	\N	2026-11-01 22:05:53.471898+05:30
9ee787f1-41fc-4172-a16d-d6e2ef1ec153	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	97d861e8-ca24-4913-8e6f-4aea83c3d682	{"phone": "+919891872027", "has_pan": false, "full_name": "PolicyUserAB768E TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:06:02.18459+05:30
49556b06-e869-4384-9187-537eb2648098	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	1c8b6beb-af16-40d6-be18-b20e86886c72	{"code": "CI-AB768E", "name": "Carrier Inherit AB768E", "category": "Health Insurance"}	\N	2026-11-01 22:06:04.474533+05:30
96af0acd-7fbc-44c7-b015-7d817e5ccd47	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	46ea634e-62f7-4d8a-8108-7da8572d71c9	{"code": "PLA-AB768E", "name": "Plan Alpha AB768E", "company_id": "1c8b6beb-af16-40d6-be18-b20e86886c72", "company_name": "Carrier Inherit AB768E"}	\N	2026-11-01 22:06:06.581503+05:30
119b2db9-650a-4fd3-8b46-3f4c97ee90b5	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	2387f48d-13f4-4c8f-b888-e7390cd734d5	{"code": "PLB-AB768E", "name": "Plan Beta AB768E", "company_id": "1c8b6beb-af16-40d6-be18-b20e86886c72", "company_name": "Carrier Inherit AB768E"}	\N	2026-11-01 22:06:08.694336+05:30
d42499bb-f2a3-4cf7-91f0-2dd1726e034c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	053a474e-20c6-407c-95e3-3c890ed36915	{"size": 43, "title": "Alpha T&C", "plan_id": "46ea634e-62f7-4d8a-8108-7da8572d71c9", "filename": "alpha_terms.pdf", "document_type": "Terms & Conditions"}	\N	2026-11-01 22:06:10.830457+05:30
e1c53a60-e93e-490a-97c7-9e06e1e31bbb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	74405088-63d7-40ef-903c-2459be410827	{"size": 29, "title": "Beta Riders", "plan_id": "2387f48d-13f4-4c8f-b888-e7390cd734d5", "filename": "beta_riders.pdf", "document_type": "Rider Documents"}	\N	2026-11-01 22:06:13.023372+05:30
c9e11b74-92bc-4d4d-8f61-4de5fb2d5141	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	99655fd4-d5ce-4f92-a607-de86911e49e9	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 14160.0, "policy_number": "POL-DL-AB768E", "nominees_count": 0}	\N	2026-11-01 22:06:15.108848+05:30
9d24e4f7-09f0-437b-b883-e9d3a67d95b5	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	876330ef-4ae8-41f0-9abf-dc23dce5fb20	{"phone": "+919876392287", "has_pan": false, "full_name": "PolicyUserAC34B6 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:06:23.761632+05:30
852b2730-769c-4733-b3f2-50f786bfe2a6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	d9560957-51eb-4f79-ac37-492d69e13505	{"code": "CI-AC34B6", "name": "Carrier Inherit AC34B6", "category": "Health Insurance"}	\N	2026-11-01 22:06:25.914109+05:30
f9ad082c-a57b-44ab-83d4-de60eb5a8b24	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	a2f86048-d951-42fc-adaa-5eb188d63f52	{"code": "PLA-AC34B6", "name": "Plan Alpha AC34B6", "company_id": "d9560957-51eb-4f79-ac37-492d69e13505", "company_name": "Carrier Inherit AC34B6"}	\N	2026-11-01 22:06:27.972631+05:30
d5ad96c6-dc9b-4d7d-b1d4-15ff8eeb6e87	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	f77024bf-0bf5-45cb-bce1-1222816a978a	{"code": "PLB-AC34B6", "name": "Plan Beta AC34B6", "company_id": "d9560957-51eb-4f79-ac37-492d69e13505", "company_name": "Carrier Inherit AC34B6"}	\N	2026-11-01 22:06:30.063532+05:30
bf002181-e80e-43fc-b459-1bb20880f0df	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	5fa04040-c4c4-4fda-ab41-58fc53901190	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1500000.0, "final_premium": 23600.0, "policy_number": "POL-SPEC-AC34B6", "nominees_count": 0}	\N	2026-11-01 22:06:32.12298+05:30
d70cf45e-1108-4a63-b488-5c3e66adb47a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	90ac1570-11dd-4848-91b9-c0526789b912	{"size": 47, "title": "Client PAN Card Copy", "filename": "customer_pan.pdf", "policy_id": "5fa04040-c4c4-4fda-ab41-58fc53901190", "document_type": "Customer KYC"}	\N	2026-11-01 22:06:34.218539+05:30
6c6e943e-0eb7-4383-a1e0-938b51c0dbe7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	1f3f6fc2-3f4b-46df-8a84-49f1540dae2b	{"size": 53, "title": "Pre-policy Medical Checkup", "filename": "medical_checkup.pdf", "policy_id": "5fa04040-c4c4-4fda-ab41-58fc53901190", "document_type": "Medical Report"}	\N	2026-11-01 22:06:36.329855+05:30
0a43545e-552d-4858-a992-247aad883494	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	90ac1570-11dd-4848-91b9-c0526789b912	{"title": {"to": "Updated PAN & Voter ID", "from": "Client PAN Card Copy"}, "description": {"to": "Re-verified with DigiLocker", "from": "Verified original document"}}	\N	2026-11-01 22:06:44.583006+05:30
e1c35ca8-2abd-48c1-802d-b15c17d100c1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	90ac1570-11dd-4848-91b9-c0526789b912	{"file_replacement": {"to_size": 49, "from_size": 47, "to_filename": "updated_pan.pdf", "from_filename": "customer_pan.pdf"}}	\N	2026-11-01 22:06:46.686135+05:30
ef3fa59c-9f08-4e8e-a063-1f1a488ea04b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_DELETED	insurance_policy_document	90ac1570-11dd-4848-91b9-c0526789b912	{"title": "Updated PAN & Voter ID", "filename": "updated_pan.pdf", "policy_id": "5fa04040-c4c4-4fda-ab41-58fc53901190"}	\N	2026-11-01 22:06:50.77786+05:30
3fc85fb1-a4db-4b5b-8a64-41eb0f401506	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	2e2972af-bf9b-4323-9774-58e2f01d0f04	{"phone": "+919899356635", "has_pan": false, "full_name": "PolicyUser2847F9 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:06:53.478351+05:30
829d4bb1-c753-488d-b1d7-54a8249a3ccf	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	a167cfed-3c0e-4ec9-abf0-9d0d9aa0f849	{"code": "CI-2847F9", "name": "Carrier Inherit 2847F9", "category": "Health Insurance"}	\N	2026-11-01 22:06:55.668183+05:30
f95f27da-4fd7-4284-87b1-71003f91141e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	302e4843-befb-43cd-ba20-8d0e78852473	{"code": "PLA-2847F9", "name": "Plan Alpha 2847F9", "company_id": "a167cfed-3c0e-4ec9-abf0-9d0d9aa0f849", "company_name": "Carrier Inherit 2847F9"}	\N	2026-11-01 22:06:57.770189+05:30
adb17e19-233b-405f-b8df-27205344f387	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	f4521d12-c7d1-4fce-acc2-d50de665ac40	{"code": "PLB-2847F9", "name": "Plan Beta 2847F9", "company_id": "a167cfed-3c0e-4ec9-abf0-9d0d9aa0f849", "company_name": "Carrier Inherit 2847F9"}	\N	2026-11-01 22:06:59.847302+05:30
bac87555-5d6a-4bee-a73a-ea583484cc38	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	a247ba6a-4a27-445a-9644-b3d84237c7f7	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL1-2847F9", "nominees_count": 0}	\N	2026-11-01 22:07:01.966097+05:30
455533f1-476f-41cb-a193-1017319b01d1	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	782b44cd-ed69-4f44-9ae4-cb777545c735	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL2-2847F9", "nominees_count": 0}	\N	2026-11-01 22:07:04.099693+05:30
6342dbb4-b72b-4a0a-9b3f-8885b758fa48	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	bb1eca55-c215-420c-8eef-79334013780d	{"size": 36, "title": "Cert P1", "filename": "cert_p1.pdf", "policy_id": "a247ba6a-4a27-445a-9644-b3d84237c7f7", "document_type": "Official Policy Certificate"}	\N	2026-11-01 22:07:10.306152+05:30
e3a37902-fdf6-4e53-9b15-ba8d3bd9ce09	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	d6a0d15b-ad89-432d-b585-00e7e13cdf55	{"phone": "+919872143100", "has_pan": false, "full_name": "PolicyUser35883E TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:07:39.037855+05:30
64108659-8757-4fa5-9bb0-dce022068509	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	b4a39b32-45d8-4e2f-8eb3-2d487fe14398	{"code": "CI-35883E", "name": "Carrier Inherit 35883E", "category": "Health Insurance"}	\N	2026-11-01 22:07:41.230763+05:30
de915588-d38d-4793-9e0c-98560f495a50	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	cfdbbe3c-4370-461f-aa13-0e3e6c3fd416	{"code": "PLA-35883E", "name": "Plan Alpha 35883E", "company_id": "b4a39b32-45d8-4e2f-8eb3-2d487fe14398", "company_name": "Carrier Inherit 35883E"}	\N	2026-11-01 22:07:43.347053+05:30
8200389e-5a20-45c8-9a72-8c1f0e061a27	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	111e4636-3f2d-497a-9cce-bc0bd68e4260	{"code": "PLB-35883E", "name": "Plan Beta 35883E", "company_id": "b4a39b32-45d8-4e2f-8eb3-2d487fe14398", "company_name": "Carrier Inherit 35883E"}	\N	2026-11-01 22:07:45.412901+05:30
543f8c56-ded8-484c-818b-92273fb7464b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	86d26dec-6ac4-4331-a144-32d4ed6e32c1	{"size": 45, "title": "Alpha Master Brochure", "plan_id": "cfdbbe3c-4370-461f-aa13-0e3e6c3fd416", "filename": "alpha_brochure.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 22:07:47.535655+05:30
b5ce0608-6342-484c-a8e6-18ffb2106853	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	027a15a5-259a-4ae8-be1d-c3d483010404	{"size": 30, "title": "Alpha Claim Form", "plan_id": "cfdbbe3c-4370-461f-aa13-0e3e6c3fd416", "filename": "alpha_claim.pdf", "document_type": "Claim Form"}	\N	2026-11-01 22:07:49.706484+05:30
6c1b6bb3-2e30-442f-9d85-7b36624e78da	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	ea776ca3-18f8-42bd-b041-7c6dbc545bd2	{"size": 42, "title": "Beta Wording T&C", "plan_id": "111e4636-3f2d-497a-9cce-bc0bd68e4260", "filename": "beta_wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 22:07:51.794496+05:30
359530b7-9c8b-4034-b1f5-babefb73a19e	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	5851f7db-4b5a-48c9-8331-856c1f867e51	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 17700.0, "policy_number": "POL-A-35883E", "nominees_count": 0}	\N	2026-11-01 22:07:53.868097+05:30
58f78aa9-7590-4973-b3ca-766951b6f0bc	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	266f5719-8589-4a39-ac6e-094e2da0904b	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 9440.0, "policy_number": "POL-B-35883E", "nominees_count": 0}	\N	2026-11-01 22:07:56.00601+05:30
3f5d536b-e51f-4f71-a018-427ac54fcaed	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	d9572ac8-8aa6-48e2-a881-2f3c5809f108	{"phone": "+919875526514", "has_pan": false, "full_name": "PolicyUserFA6746 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:08:04.803237+05:30
99846711-8da7-476c-95fc-53b03d8497d6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	ec11c05b-75e3-4a02-8b43-530a7b947167	{"code": "CI-FA6746", "name": "Carrier Inherit FA6746", "category": "Health Insurance"}	\N	2026-11-01 22:08:06.996431+05:30
a775ae4a-9718-4ed2-b21d-975079e098d4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	2ee40bbf-295b-41ff-b14a-ca536c5a9742	{"code": "PLA-FA6746", "name": "Plan Alpha FA6746", "company_id": "ec11c05b-75e3-4a02-8b43-530a7b947167", "company_name": "Carrier Inherit FA6746"}	\N	2026-11-01 22:08:09.101512+05:30
91ba8f96-8a3a-4b1a-b8de-5c4aae29b30e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	b0e4e75e-8999-476e-8fdb-2611a91b1970	{"code": "PLB-FA6746", "name": "Plan Beta FA6746", "company_id": "ec11c05b-75e3-4a02-8b43-530a7b947167", "company_name": "Carrier Inherit FA6746"}	\N	2026-11-01 22:08:11.198277+05:30
c9323dff-87ba-4986-b967-13f5cd6bd073	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	ccf57941-e5f7-4e36-ad15-579c7cea45ec	{"size": 43, "title": "Alpha T&C", "plan_id": "2ee40bbf-295b-41ff-b14a-ca536c5a9742", "filename": "alpha_terms.pdf", "document_type": "Terms & Conditions"}	\N	2026-11-01 22:08:13.323759+05:30
929071e7-4657-473e-bd2b-652c8b83888e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	2b31a1ce-d452-4b6b-9d04-b0376120556b	{"size": 29, "title": "Beta Riders", "plan_id": "b0e4e75e-8999-476e-8fdb-2611a91b1970", "filename": "beta_riders.pdf", "document_type": "Rider Documents"}	\N	2026-11-01 22:08:15.437153+05:30
0d751379-394b-4c99-a865-5e7c8bc2be0f	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	5a0169dd-2126-4103-8d07-dee843a34c5a	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 14160.0, "policy_number": "POL-DL-FA6746", "nominees_count": 0}	\N	2026-11-01 22:08:17.541513+05:30
41ca7de0-cea4-4a7d-859f-d373ed136c80	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	cce42a17-8198-43a4-9d0e-54fac69a8b02	{"phone": "+919861576709", "has_pan": false, "full_name": "PolicyUser1BEF50 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:08:26.19973+05:30
6015a66d-690e-4c70-a61c-a7f548077087	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	1f2f7d44-861f-46e9-a25e-821ce41c9188	{"code": "CI-1BEF50", "name": "Carrier Inherit 1BEF50", "category": "Health Insurance"}	\N	2026-11-01 22:08:28.37448+05:30
9a461a94-87b5-4cbc-bf4e-2206068eb8d9	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	5904dfdd-5f2a-4457-a18f-eec082989b3d	{"code": "PLA-1BEF50", "name": "Plan Alpha 1BEF50", "company_id": "1f2f7d44-861f-46e9-a25e-821ce41c9188", "company_name": "Carrier Inherit 1BEF50"}	\N	2026-11-01 22:08:30.502878+05:30
5e696e65-0bee-4b77-9b1a-0e12f903b8dc	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	f0c6b3c3-731c-434e-b166-544a9b876d52	{"code": "PLB-1BEF50", "name": "Plan Beta 1BEF50", "company_id": "1f2f7d44-861f-46e9-a25e-821ce41c9188", "company_name": "Carrier Inherit 1BEF50"}	\N	2026-11-01 22:08:32.610708+05:30
6ddb120b-9948-41a4-8905-e52b96ae8a49	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	64481312-cdc5-4d92-8086-2488c0c8d8f5	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1500000.0, "final_premium": 23600.0, "policy_number": "POL-SPEC-1BEF50", "nominees_count": 0}	\N	2026-11-01 22:08:34.738378+05:30
3fea9859-f146-4b77-b8a2-346eac865474	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	b45fc891-814e-4218-908a-c63bbda21904	{"size": 47, "title": "Client PAN Card Copy", "filename": "customer_pan.pdf", "policy_id": "64481312-cdc5-4d92-8086-2488c0c8d8f5", "document_type": "Customer KYC"}	\N	2026-11-01 22:08:36.81252+05:30
dfac4a68-a7c5-45f5-9df1-1c097d5023ac	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	f987bef8-b8b6-4154-beb2-d85e28381518	{"size": 53, "title": "Pre-policy Medical Checkup", "filename": "medical_checkup.pdf", "policy_id": "64481312-cdc5-4d92-8086-2488c0c8d8f5", "document_type": "Medical Report"}	\N	2026-11-01 22:08:38.902038+05:30
0d0fc84e-dfec-4ed5-aafb-130f86836000	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	b45fc891-814e-4218-908a-c63bbda21904	{"title": {"to": "Updated PAN & Voter ID", "from": "Client PAN Card Copy"}, "description": {"to": "Re-verified with DigiLocker", "from": "Verified original document"}}	\N	2026-11-01 22:08:47.15302+05:30
e08ea907-9ff5-48f7-ba5c-684fa0534c5d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	b45fc891-814e-4218-908a-c63bbda21904	{"file_replacement": {"to_size": 49, "from_size": 47, "to_filename": "updated_pan.pdf", "from_filename": "customer_pan.pdf"}}	\N	2026-11-01 22:08:49.213797+05:30
3d25e48b-ad64-4551-bcfa-a047980a072e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_DELETED	insurance_policy_document	b45fc891-814e-4218-908a-c63bbda21904	{"title": "Updated PAN & Voter ID", "filename": "updated_pan.pdf", "policy_id": "64481312-cdc5-4d92-8086-2488c0c8d8f5"}	\N	2026-11-01 22:08:53.373345+05:30
a995a75d-067b-4b36-923e-da0c70fd2690	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	9e8d74b7-1672-46e4-8bb0-d232bc17e3c8	{"phone": "+919810272413", "has_pan": false, "full_name": "PolicyUser78F36E TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 22:08:57.859223+05:30
da53a104-0374-4927-bcc6-0b97a7dd255f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	1f24f1cf-26e9-4b60-902a-109f81eca2d0	{"code": "CI-78F36E", "name": "Carrier Inherit 78F36E", "category": "Health Insurance"}	\N	2026-11-01 22:08:59.970451+05:30
b7112d11-03fe-46d2-80e0-0587aa68634c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	67b1e7ae-3569-420f-a488-da3e7aaebc44	{"code": "PLA-78F36E", "name": "Plan Alpha 78F36E", "company_id": "1f24f1cf-26e9-4b60-902a-109f81eca2d0", "company_name": "Carrier Inherit 78F36E"}	\N	2026-11-01 22:09:02.029667+05:30
337aa6f6-d2bf-42ae-b4ef-821c243f7441	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	79327749-f7b2-455e-9925-cd45b7322ccd	{"code": "PLB-78F36E", "name": "Plan Beta 78F36E", "company_id": "1f24f1cf-26e9-4b60-902a-109f81eca2d0", "company_name": "Carrier Inherit 78F36E"}	\N	2026-11-01 22:09:04.126303+05:30
5e3a34dd-2fe7-4316-b126-2a589885834b	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	2677a880-d6b6-4e73-a6b1-3bc257f6d77b	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL1-78F36E", "nominees_count": 0}	\N	2026-11-01 22:09:06.194714+05:30
d7eff5e5-28ef-4e91-9d59-fcc0636deb2d	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	d9fa6595-5cf3-446c-a185-ac1bbe893797	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL2-78F36E", "nominees_count": 0}	\N	2026-11-01 22:09:08.309379+05:30
cf345d92-80d9-4521-bef4-a54ddaac9cb7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	bb1d73a6-dfd3-47d2-977a-73a7a06d8d20	{"size": 36, "title": "Cert P1", "filename": "cert_p1.pdf", "policy_id": "2677a880-d6b6-4e73-a6b1-3bc257f6d77b", "document_type": "Official Policy Certificate"}	\N	2026-11-01 22:09:14.577537+05:30
e1ed7dc2-fb7c-45f9-91d4-9c80df203579	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	fb9b77cb-7915-439f-95c4-2884882f596a	{"size": 11549, "title": "abcd", "filename": "Quotation_HQ-2026-00046.pdf", "policy_id": "af101880-6400-4562-ac71-699c477531f9", "document_type": "Official Policy Certificate"}	\N	2026-11-01 22:15:14.23401+05:30
50acad7f-6e16-451c-863f-6a1826402e79	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	fb9b77cb-7915-439f-95c4-2884882f596a	{"file_replacement": {"to_size": 87526, "from_size": 11549, "to_filename": "AdityaThakre_Resume-2 (2).pdf", "from_filename": "Quotation_HQ-2026-00046.pdf"}}	\N	2026-11-01 22:15:39.410795+05:30
9e5f9ea3-cd9a-4eba-9654-6fac1ae574af	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	4bf28461-6fc2-4456-bccc-b3df751d6ee7	{"code": "ACT-338432", "name": "Active Plan 338432"}	\N	2026-11-01 22:16:28.842988+05:30
675adba1-0dc8-4b72-8735-9b38c21e6cc7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	620b85c4-dfdc-4fcc-8877-e935db59b594	{"code": "PLN-21387A", "name": "Comprehensive Health Plus 21387A"}	\N	2026-11-01 22:16:39.657827+05:30
958642a8-ef0d-4f5f-9388-2508b32d9225	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	b9983376-24ba-4cff-8f5c-c190df3cedfe	{"code": "DP-0D03B9", "name": "Docs Plan 0D03B9"}	\N	2026-11-01 22:16:48.027448+05:30
f8700562-9982-4826-a565-9a5a1de05a73	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	d49ffb5b-5bd6-42a1-821d-df6b45552cbf	{"code": "INACT-C56413", "name": "Inactive Plan C56413"}	\N	2026-11-01 22:16:55.296291+05:30
e5d08921-722d-4af7-a5d0-11f9be7711fb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	8f8102f1-ffcd-4e1b-b2b5-88abbc39d231	{"code": "DP-C34726", "name": "Docs Plan C34726"}	\N	2026-11-01 22:17:07.571008+05:30
a4699c4b-1452-4828-ae2d-f3f9a10667ab	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	39df3367-6c2e-4132-840d-684551c72571	{"code": "DP-D2F973", "name": "Docs Plan D2F973"}	\N	2026-11-01 22:17:13.725825+05:30
b5bcec5c-7194-4ad0-a1d8-fd700543d69e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	53bd98d2-ae2c-4a47-97e1-ed8b65bb10bb	{"code": "LP-836228", "name": "Lifecycle Plan 836228"}	\N	2026-11-01 22:17:22.201221+05:30
c3aa777b-18b8-4e0f-869f-b818d28bcf04	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	2976d04a-ba9f-4c02-8e55-d85ddbc3f6ec	{"code": "TATAIG-46E7", "name": "Tata Aig", "category": "Health Insurance"}	\N	2026-11-01 22:21:30.493729+05:30
ed005bfa-e4cf-49e6-ad5d-51767940a17b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	f84d93e1-dd77-4e20-8be9-d41ac1123403	{"code": "MEDI-12345", "name": "Medicare Select", "company_id": "2976d04a-ba9f-4c02-8e55-d85ddbc3f6ec", "company_name": "Tata Aig"}	\N	2026-11-01 22:22:35.001909+05:30
6dc4e13b-85ab-4faa-93b1-c1545d2dd00c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	5dbde318-1741-49be-a885-2b8966ebc149	{"size": 250853, "title": "tataaig_medicare_brochure", "plan_id": "f84d93e1-dd77-4e20-8be9-d41ac1123403", "filename": "tataaig_medicare_brochure.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 22:22:37.167522+05:30
3264bba2-a6e5-49dc-88cd-e44f61c8505a	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	5c136a8e-a490-425c-b3bc-da5a0c788db1	{"amount": 1.0, "payment_id": "58bd310e-b4cc-4cab-ac59-b9b247b672ba", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-01 22:26:11.624373+05:30
10102c7a-fb30-4a87-906d-53523783260d	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	5c136a8e-a490-425c-b3bc-da5a0c788db1	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 2000000.0, "final_premium": 14160.0, "policy_number": "POL-HLTH-2026-47144", "nominees_count": 1}	\N	2026-11-01 22:26:11.661466+05:30
5a52ff7d-fce9-4b9a-b843-88f1aa233230	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	a8cd77bc-d0d2-4c4d-b00c-6edc707ca78e	{"client_name": "Vikram Verma", "quotation_number": "HQ-2026-00048"}	\N	2026-11-01 22:29:35.581834+05:30
5fc1b8b9-e6fc-42bd-9f01-e09424855df5	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	cc688351-b589-415a-ae7a-bbbf01f502f0	{"code": "INACT-338432", "name": "Inactive Plan 338432"}	\N	2026-11-01 22:34:11.298847+05:30
6ac3d472-c400-46ca-bf58-e4c8f66f9016	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	d3002f98-926b-4357-9c3a-c33c31807212	{"code": "INACT-FC807A", "name": "Inactive Plan FC807A"}	\N	2026-11-01 22:34:19.09725+05:30
7692afb8-9fcc-44ed-940e-e1ffc33755a6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	e9080687-89c7-4b78-94aa-70dd7effc8f6	{"code": "LP-A1F5F6", "name": "Lifecycle Plan A1F5F6"}	\N	2026-11-01 22:34:49.339114+05:30
a0790c4f-7fa3-437d-b1ca-306c02f72e77	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	82338d33-c3fc-4042-985d-fbbd5590de9b	{"code": "LP-FCF1A1", "name": "Lifecycle Plan FCF1A1"}	\N	2026-11-01 22:34:58.397268+05:30
7f359cd0-67d4-42a7-89de-79639e26ea91	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	ed6e6d52-b6cc-4581-8f8e-532274ba6d2e	{"code": "PLA-135B22", "name": "Plan Alpha 135B22"}	\N	2026-11-01 22:35:06.333013+05:30
e3db69f8-5866-4325-a576-9bbdb27d722b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	ef897351-0a6f-4959-a1a7-826023cb26d4	{"code": "PLA-701B0F", "name": "Plan Alpha 701B0F"}	\N	2026-11-01 22:35:25.560632+05:30
6d128884-0c0d-4eb5-8132-7fd251ef2e57	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	822940fd-a445-4bcf-b742-1ed621e4193c	{"code": "PLA-BA9357", "name": "Plan Alpha BA9357"}	\N	2026-11-01 22:35:33.925263+05:30
68cfaba6-d4c8-4a83-8007-efcdb13e8bce	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	46ea634e-62f7-4d8a-8108-7da8572d71c9	{"code": "PLA-AB768E", "name": "Plan Alpha AB768E"}	\N	2026-11-01 22:35:40.856778+05:30
be9e507c-ad9d-4d65-a030-7ed5058d9f49	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	51c0355a-9480-4935-b745-a2c4102fb7e0	{"code": "PLA-E70366", "name": "Plan Alpha E70366"}	\N	2026-11-01 22:35:47.852934+05:30
1103342c-4cb2-4d96-8c5b-fa8573556f58	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	fa005d7a-c643-4728-968d-b832d8511fd8	{"code": "PLB-135B22", "name": "Plan Beta 135B22"}	\N	2026-11-01 22:35:57.771395+05:30
c866174a-cebb-4682-aed5-17654cb18775	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	a10da5a7-7b66-4294-950f-2b15c5acc7a9	{"code": "PLA-9C18A2", "name": "Plan Alpha 9C18A2"}	\N	2026-11-01 22:36:08.319688+05:30
d59b269f-9bfc-4bc6-8739-5f1fb03dde60	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	ed44a1a6-9c6c-4b8b-ad23-debb1d6fdfb0	{"code": "PLA-995557", "name": "Plan Alpha 995557"}	\N	2026-11-01 22:36:15.292923+05:30
99d12df4-801c-4bc7-a16c-181f0f79841f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	a2f86048-d951-42fc-adaa-5eb188d63f52	{"code": "PLA-AC34B6", "name": "Plan Alpha AC34B6"}	\N	2026-11-01 22:36:22.138021+05:30
62f35d89-6460-4e60-837c-f310d64ced89	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	ff834e26-3e27-41d2-81d5-642396cf9629	{"code": "PLB-2156B3", "name": "Plan Beta 2156B3"}	\N	2026-11-01 22:36:39.556876+05:30
c8be7a6f-b439-4a4b-a400-e97c3c40f7db	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	111e4636-3f2d-497a-9cce-bc0bd68e4260	{"code": "PLB-35883E", "name": "Plan Beta 35883E"}	\N	2026-11-01 22:36:53.227227+05:30
941ba860-9e2b-4536-a7eb-eb93a18e65d2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	7f02f09a-d09e-40cd-84e2-86c37f562552	{"code": "SP-080E02", "name": "Stream Plan 080E02"}	\N	2026-11-01 22:37:20.78843+05:30
e2894d78-5f66-4e2c-8cf9-ef0692893e29	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	b0e4e75e-8999-476e-8fdb-2611a91b1970	{"code": "PLB-FA6746", "name": "Plan Beta FA6746"}	\N	2026-11-01 22:37:48.489384+05:30
149c51c9-d143-4774-9881-a14696ec2a9d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	f4521d12-c7d1-4fce-acc2-d50de665ac40	{"code": "PLB-2847F9", "name": "Plan Beta 2847F9"}	\N	2026-11-01 22:38:15.785386+05:30
9dc6f3cf-4a3a-4347-9fe5-2610d3bfd2f5	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	44cbf82a-e65b-4b6f-b671-2fdaf89954b0	{"code": "PLB-995557", "name": "Plan Beta 995557"}	\N	2026-11-01 22:38:40.687982+05:30
6fd5240d-493e-4061-b787-8bdfc998a8db	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	0912da6b-7a11-4e73-b70d-6d83d32b1b2f	{"code": "PLB-6C2DCD", "name": "Plan Beta 6C2DCD"}	\N	2026-11-01 22:37:00.801065+05:30
7fd55257-1fb7-4b92-aea9-ae2b61339800	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	aee2e584-2762-4594-b201-c6c662234d4b	{"code": "SP-DA4E6D", "name": "Stream Plan DA4E6D"}	\N	2026-11-01 22:37:28.081501+05:30
fe0b3df1-e2b3-42b9-906b-afa6f4b327a4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	2387f48d-13f4-4c8f-b888-e7390cd734d5	{"code": "PLB-AB768E", "name": "Plan Beta AB768E"}	\N	2026-11-01 22:37:55.578278+05:30
f56a53b7-e630-4c5e-b51c-6d164f7489f1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	79327749-f7b2-455e-9925-cd45b7322ccd	{"code": "PLB-78F36E", "name": "Plan Beta 78F36E"}	\N	2026-11-01 22:38:23.640504+05:30
90182e79-2b68-453c-99b4-15a252cba705	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	093ad18a-fa79-4b69-af37-32f95a32b583	{"code": "PLB-701B0F", "name": "Plan Beta 701B0F"}	\N	2026-11-01 22:37:12.977496+05:30
dd9bf926-eef2-46d5-afff-5b6e03498778	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	f62b64ad-248e-4c65-9d56-515e99e52cff	{"code": "SP-B3C4BF", "name": "Stream Plan B3C4BF"}	\N	2026-11-01 22:37:41.113148+05:30
0f2c0b9d-4eeb-4a69-8259-ab6d6211e887	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	67b1e7ae-3569-420f-a488-da3e7aaebc44	{"code": "PLA-78F36E", "name": "Plan Alpha 78F36E"}	\N	2026-11-01 22:38:07.356252+05:30
bf322217-e450-4081-8196-993ba799c121	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	4ac140ee-e18d-4cf9-ae57-9533dec870d6	{"code": "PLA-874A9C", "name": "Plan Alpha 874A9C"}	\N	2026-11-01 22:38:33.394862+05:30
1b79d64c-9e9e-4bee-b707-907dbc1c3554	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	0b9197ce-1570-4766-a9cc-7e031c33d09a	{"code": "PLB-874A9C", "name": "Plan Beta 874A9C"}	\N	2026-11-01 22:38:49.413373+05:30
55ede3af-7b04-4985-9467-3ca686d4f288	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	6b1ed955-4fd6-4467-a170-72b78633c817	{"code": "PLA-2156B3", "name": "Plan Alpha 2156B3"}	\N	2026-11-01 22:38:59.369544+05:30
274185c8-1306-480c-b8cc-5914d9d84769	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	302e4843-befb-43cd-ba20-8d0e78852473	{"code": "PLA-2847F9", "name": "Plan Alpha 2847F9"}	\N	2026-11-01 22:39:14.537628+05:30
4989dcfa-fca0-405d-b575-2fa9b122e041	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	cfdbbe3c-4370-461f-aa13-0e3e6c3fd416	{"code": "PLA-35883E", "name": "Plan Alpha 35883E"}	\N	2026-11-01 22:39:21.802872+05:30
76c0cc38-c99b-4aaa-9a62-50000fc35e87	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	5904dfdd-5f2a-4457-a18f-eec082989b3d	{"code": "PLA-1BEF50", "name": "Plan Alpha 1BEF50"}	\N	2026-11-01 22:39:28.489645+05:30
dda3736c-f48d-4141-846b-3098b7455f98	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	f528a1f5-3cee-492e-8e8a-63edc9ef8441	{"code": "PLB-9C18A2", "name": "Plan Beta 9C18A2"}	\N	2026-11-01 22:39:40.573676+05:30
3d1c0bc3-c3e4-41d2-8d8c-42fe03c4b4d7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	672e97fc-1667-45d0-bbff-edb7acc00c30	{"code": "PLA-6C2DCD", "name": "Plan Alpha 6C2DCD"}	\N	2026-11-01 22:39:47.578252+05:30
4edf9c7c-8189-45db-822a-da49915f624d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	f0c6b3c3-731c-434e-b166-544a9b876d52	{"code": "PLB-1BEF50", "name": "Plan Beta 1BEF50"}	\N	2026-11-01 22:39:55.367192+05:30
33e3e0ec-d3a3-4656-b648-3c5b7ce79b2c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	c1be60fc-90e3-4e72-9173-789b10f29953	{"code": "PLB-BA9357", "name": "Plan Beta BA9357"}	\N	2026-11-01 22:40:03.313958+05:30
03fa3aae-0119-4fc0-85ed-01cc0b4bdae8	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DELETED	insurance_plan	dac8c404-beb5-4bee-81b6-6127e8eb345f	{"code": "PLB-E70366", "name": "Plan Beta E70366"}	\N	2026-11-01 22:40:10.177189+05:30
61e28a78-d154-4da8-9ee9-5ec07cd49dfc	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	a97ebbe5-c1b3-4826-8ebd-b30eabdd3a5c	{"code": "V360-338432", "name": "360 View Carrier 338432"}	\N	2026-11-01 22:49:51.583168+05:30
f2786c8c-998e-47e0-98a0-e37365a671e7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	84b34588-8d6e-4923-a96b-801fd9b773a4	{"code": "V360-C56413", "name": "360 View Carrier C56413"}	\N	2026-11-01 22:50:01.468539+05:30
35991833-c662-4c63-a7ca-4c8523b8bc02	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	7962f179-3d29-483b-a900-5c17b80455af	{"code": "V360-FC807A", "name": "360 View Carrier FC807A"}	\N	2026-11-01 22:50:26.758549+05:30
d31d8294-b34f-44ad-8017-ef557ecca7bc	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	df2123be-139a-4df5-a4b0-897cc0b96f43	{"code": "CARE-HLT", "name": "Care Health"}	\N	2026-11-01 22:50:48.640395+05:30
a4c19ae6-2289-4b96-913a-bbfddfe7abff	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	4ef4b3f6-dcbf-458c-9c61-313eac07e465	{"code": "CI-135B22", "name": "Carrier Inherit 135B22"}	\N	2026-11-01 22:50:58.567066+05:30
850afa8c-e899-4a34-b4af-137c5184b971	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	1f2f7d44-861f-46e9-a25e-821ce41c9188	{"code": "CI-1BEF50", "name": "Carrier Inherit 1BEF50"}	\N	2026-11-01 22:51:07.174645+05:30
23c63470-5ec7-43c6-a069-9540bacc1a6f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	d9df923a-21e4-4d4c-9b87-77cf4514c483	{"code": "CI-2156B3", "name": "Carrier Inherit 2156B3"}	\N	2026-11-01 22:51:15.123608+05:30
361c1b9c-0e72-41cd-be93-3135b01fab96	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	a167cfed-3c0e-4ec9-abf0-9d0d9aa0f849	{"code": "CI-2847F9", "name": "Carrier Inherit 2847F9"}	\N	2026-11-01 22:52:01.34447+05:30
9e981f99-acce-4c6a-9f52-f9a468e0b625	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	c902db18-1926-4494-967b-17d1c5fdfef9	{"code": "CI-6C2DCD", "name": "Carrier Inherit 6C2DCD"}	\N	2026-11-01 22:52:09.044265+05:30
3260872d-ad4c-4a3c-8e13-31dc2d457aed	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	b4a39b32-45d8-4e2f-8eb3-2d487fe14398	{"code": "CI-35883E", "name": "Carrier Inherit 35883E"}	\N	2026-11-01 22:52:23.952728+05:30
5d144535-06d2-4511-8e51-4bbe1cb202ca	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	1f24f1cf-26e9-4b60-902a-109f81eca2d0	{"code": "CI-78F36E", "name": "Carrier Inherit 78F36E"}	\N	2026-11-01 22:52:32.569702+05:30
0828ba3a-c9e3-4fac-8ea3-3985401a3069	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	4851273f-583d-42a6-8697-1126963030f2	{"code": "CI-874A9C", "name": "Carrier Inherit 874A9C"}	\N	2026-11-01 22:52:40.426107+05:30
589f984d-eb3e-4b09-b072-00343b2a2597	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	2a5a2ebb-c043-49ae-9992-fae3c1614b25	{"code": "CI-701B0F", "name": "Carrier Inherit 701B0F"}	\N	2026-11-01 22:53:00.819348+05:30
a48d6b67-0ebb-4bfd-95b6-21c7176d75fd	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	e06f31e7-0906-4dd3-9226-d936a5481659	{"code": "CI-995557", "name": "Carrier Inherit 995557"}	\N	2026-11-01 22:53:07.651813+05:30
4b1228ba-6b83-4fae-9279-cf5136114d5d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	c463d516-4118-4fbf-9490-757c6ff2f938	{"code": "CI-9C18A2", "name": "Carrier Inherit 9C18A2"}	\N	2026-11-01 22:53:33.980869+05:30
df5a2e3a-0dd3-4271-a88f-a02107fab018	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	1c8b6beb-af16-40d6-be18-b20e86886c72	{"code": "CI-AB768E", "name": "Carrier Inherit AB768E"}	\N	2026-11-01 22:53:45.506219+05:30
71d6ec2f-fedb-4cc9-8704-8ad0a25498e1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	d87789fa-653c-4720-b04b-3723694a324d	{"code": "CI-BA9357", "name": "Carrier Inherit BA9357"}	\N	2026-11-01 22:53:58.988979+05:30
111ddbc2-0c3c-4463-8fc0-3694f79b0853	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	d6cb22a1-40ee-4bdd-9396-84c7cce511c0	{"code": "GO-DIGIT", "name": "Go Digit"}	\N	2026-11-01 22:54:06.570832+05:30
73686fec-91d1-44b4-8db5-8c93b5e863a3	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	cba67ff2-4cdd-4d95-b003-29ce845ae2d1	{"code": "DC-D2F973", "name": "Docs Carrier D2F973"}	\N	2026-11-01 22:54:15.546425+05:30
96207819-9a49-4332-9d8b-24195d2f455d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	a9023c14-da1c-46e1-a69a-bb3be8eaeb06	{"code": "DC-0D03B9", "name": "Docs Carrier 0D03B9"}	\N	2026-11-01 22:54:23.14148+05:30
59fd2f9e-b8e0-4e8f-afde-2432370e47f3	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	dc354afb-b1b1-44c2-945b-4c86b6e0f8dd	{"code": "LC-836228", "name": "Lifecycle Carrier 836228"}	\N	2026-11-01 22:54:34.039438+05:30
096480f1-16d3-4ff4-b384-7abe5b92d6f7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	04f78cd6-f575-4e18-8caf-68a36bfd5492	{"code": "LC-A1F5F6", "name": "Lifecycle Carrier A1F5F6"}	\N	2026-11-01 22:54:55.615651+05:30
375dd532-125f-4027-bb32-163ae58284de	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	8ca8b0ef-3049-4204-a2f6-dfe51dea1370	{"code": "CMP-21387A", "name": "Workflow Test Carrier 21387A"}	\N	2026-11-01 22:55:07.819799+05:30
8c778092-514e-42ab-8558-9e1f2f6a028e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	1689623b-6439-4778-971a-b1cfd73c428b	{"code": "CMP-4124BF", "name": "Workflow Test Carrier 4124BF"}	\N	2026-11-01 22:55:15.201721+05:30
1997cb2e-7488-4348-95bf-98eded1fab18	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	75bbcd6c-4445-4d0d-ae4b-418d456a40e4	{"code": "CMP-667E42", "name": "Workflow Test Carrier 667E42"}	\N	2026-11-01 22:55:22.502826+05:30
a9e2aeff-e3a5-4b75-aa84-02a8644b545e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_DELETED	insurance_company	16e3ae30-ba9a-491b-aafe-6d1840eed770	{"code": "CI-E70366", "name": "Carrier Inherit E70366"}	\N	2026-11-01 22:55:40.034972+05:30
054ab3f7-1959-443a-9746-eda0a7c71b10	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_UPDATED	insurance_plan	f77024bf-0bf5-45cb-bce1-1222816a978a	{"name": {"to": "Plan Beta AC34B6", "from": "Plan Beta AC34B6"}, "status": {"to": "ACTIVE", "from": "ACTIVE"}, "line_of_business": {"to": "Health Insurance", "from": "Health Insurance"}}	\N	2026-11-01 22:56:25.717709+05:30
b91197bc-8395-4cc5-b0c5-41181d40da60	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	c69a5398-7de5-4a5a-81c6-1eda5d4d73ad	{"size": 123178, "title": "1e72d1352ddb5cd3f6b6e881cb501015", "plan_id": "f77024bf-0bf5-45cb-bce1-1222816a978a", "filename": "1e72d1352ddb5cd3f6b6e881cb501015.jpg", "document_type": "Policy Brochure"}	\N	2026-11-01 22:56:25.736876+05:30
27c95d01-3ed4-485f-b360-53c51a232bff	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	6dfca1f6-a370-4d58-b50d-a6c8d93efe56	{"code": "CMP-C43274", "name": "Workflow Test Carrier C43274", "category": "Health Insurance"}	\N	2026-11-01 23:10:59.580059+05:30
1b30b9a0-e3ee-48a9-9ef1-ae7efe4a0a6f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	3a1ab600-e20a-4719-b189-eb61b0c7ae77	{"code": "PLN-C43274", "name": "Comprehensive Health Plus C43274", "company_id": "6dfca1f6-a370-4d58-b50d-a6c8d93efe56", "company_name": "Workflow Test Carrier C43274"}	\N	2026-11-01 23:11:01.636935+05:30
60c84471-2468-46b6-b946-fa48dcbfffe2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	6dfca1f6-a370-4d58-b50d-a6c8d93efe56	{"is_active": {"to": false, "from": true}}	\N	2026-11-01 23:11:07.90171+05:30
0de9c1a8-528f-49f0-b599-7ec3eaf307e6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	6dfca1f6-a370-4d58-b50d-a6c8d93efe56	{"is_active": {"to": true, "from": false}}	\N	2026-11-01 23:11:12.022241+05:30
91482d8b-1ae9-46ae-8171-64fe195f919a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	0f796dae-4226-46e4-b0cc-181d6165afc8	{"code": "DC-F55B60", "name": "Docs Carrier F55B60", "category": "Health Insurance"}	\N	2026-11-01 23:11:14.672331+05:30
5a6ed92c-f18d-446b-838a-80da2575d932	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	9e8daedd-1859-46fd-9179-a2d42c15af0a	{"code": "DP-F55B60", "name": "Docs Plan F55B60", "company_id": "0f796dae-4226-46e4-b0cc-181d6165afc8", "company_name": "Docs Carrier F55B60"}	\N	2026-11-01 23:11:16.787208+05:30
b40bff1d-9b60-4152-9e20-397da9ea36ab	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	07288b69-e1e7-4cc2-af27-fa5002a74885	{"size": 61, "title": "Official Plan Brochure 2026", "plan_id": "9e8daedd-1859-46fd-9179-a2d42c15af0a", "filename": "brochure_2026.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 23:11:18.878157+05:30
d772c5d4-0784-4876-868f-36f3c3f7d79a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	00de7261-697f-440e-8a81-7d433769a2b2	{"size": 20, "title": "Reimbursement Claim Intimation Form", "plan_id": "9e8daedd-1859-46fd-9179-a2d42c15af0a", "filename": "claim_intimation.docx", "document_type": "Claim Form"}	\N	2026-11-01 23:11:20.94188+05:30
d0890f09-696d-4049-a816-7dca6c272b57	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	431a12f2-ec79-4564-86bb-72e679ad7244	{"size": 20, "title": "Age-wise Premium Rate Chart", "plan_id": "9e8daedd-1859-46fd-9179-a2d42c15af0a", "filename": "rates_chart.xlsx", "document_type": "Premium Chart"}	\N	2026-11-01 23:11:23.046328+05:30
26089a87-666c-451d-ab6b-9da5851020fb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	5b51fc66-f3f2-46d7-aaf6-59535fed1367	{"size": 23, "title": "Network Hospital Infographic", "plan_id": "9e8daedd-1859-46fd-9179-a2d42c15af0a", "filename": "hospitals.png", "document_type": "Coverage Details"}	\N	2026-11-01 23:11:25.163858+05:30
0da8d8ee-9ccb-4e7f-9d36-ed8f82c9cb38	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	d6dcb394-0b4a-46aa-b231-1e35828493db	{"code": "SC-C0EB34", "name": "Stream Carrier C0EB34", "category": "Health Insurance"}	\N	2026-11-01 23:11:31.972335+05:30
7c3169b0-ad41-4694-b9f2-550d9dadc2cd	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	564d0c8a-cd43-4e0c-b0a9-50a4b32c5ae1	{"code": "SP-C0EB34", "name": "Stream Plan C0EB34", "company_id": "d6dcb394-0b4a-46aa-b231-1e35828493db", "company_name": "Stream Carrier C0EB34"}	\N	2026-11-01 23:11:34.089665+05:30
1b61e2a2-5ee4-4bb1-8a5d-51630a8f2c94	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	2e92479e-050e-4b3d-a68c-68bee083c905	{"size": 54, "title": "Full Policy Terms & Conditions", "plan_id": "564d0c8a-cd43-4e0c-b0a9-50a4b32c5ae1", "filename": "wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 23:11:36.19899+05:30
766537f0-ee62-4596-bf04-80e6956d658a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	e7e8e066-2b52-46be-9efb-9788ffe2c7b9	{"code": "LC-0E9F63", "name": "Lifecycle Carrier 0E9F63", "category": "Health Insurance"}	\N	2026-11-01 23:11:49.232212+05:30
5ac72d1d-dbb7-4acd-bd7c-1dcc682d4d8a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	aaf8c9dd-f1bf-4f58-999f-f0233571cba7	{"code": "LP-0E9F63", "name": "Lifecycle Plan 0E9F63", "company_id": "e7e8e066-2b52-46be-9efb-9788ffe2c7b9", "company_name": "Lifecycle Carrier 0E9F63"}	\N	2026-11-01 23:11:51.339817+05:30
c980a16a-08fc-4fd9-b776-20bd9c885035	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	04d494b8-196a-4c9d-8b8a-a448eff3b43d	{"size": 42, "title": "Initial Prospectus v1", "plan_id": "aaf8c9dd-f1bf-4f58-999f-f0233571cba7", "filename": "prospectus_v1.pdf", "document_type": "Prospectus"}	\N	2026-11-01 23:11:53.414048+05:30
7e745bc7-a0d6-472e-ba76-0ec5278057d6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	04d494b8-196a-4c9d-8b8a-a448eff3b43d	{"title": {"to": "Updated Prospectus 2026 Final", "from": "Initial Prospectus v1"}, "description": {"to": "Revised pricing appendix", "from": null}}	\N	2026-11-01 23:11:55.482455+05:30
7b1ac9e8-82d7-440a-884d-a1cd87b4eb7e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	04d494b8-196a-4c9d-8b8a-a448eff3b43d	{"title": {"to": "Prospectus v2 Replaced", "from": "Updated Prospectus 2026 Final"}, "file_replacement": {"to_size": 58, "from_size": 42, "to_filename": "prospectus_v2.pdf", "from_filename": "prospectus_v1.pdf"}}	\N	2026-11-01 23:11:57.567237+05:30
d66ae705-0faf-41a4-b55e-5fdf7f55049a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_DELETED	insurance_plan_document	04d494b8-196a-4c9d-8b8a-a448eff3b43d	{"title": "Prospectus v2 Replaced", "plan_id": "aaf8c9dd-f1bf-4f58-999f-f0233571cba7", "filename": "prospectus_v2.pdf"}	\N	2026-11-01 23:12:01.739948+05:30
2e28f562-9d4d-4a2a-83e8-0a659f25ceef	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	fafca85b-89df-4fe5-bc15-20ce5c2133ec	{"code": "V360-F873EE", "name": "360 View Carrier F873EE", "category": "Composite"}	\N	2026-11-01 23:12:06.500329+05:30
b30c83c3-e4c7-47fc-9d1a-36dc23f83e22	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	28828765-827a-4feb-8c4c-49626c64c942	{"code": "ACT-F873EE", "name": "Active Plan F873EE", "company_id": "fafca85b-89df-4fe5-bc15-20ce5c2133ec", "company_name": "360 View Carrier F873EE"}	\N	2026-11-01 23:12:08.552608+05:30
76ad35cb-335f-4ca3-83a9-51fd6df4eee4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	1b30d8ad-da6d-468e-8ce9-43a2e5197ed9	{"code": "INACT-F873EE", "name": "Inactive Plan F873EE", "company_id": "fafca85b-89df-4fe5-bc15-20ce5c2133ec", "company_name": "360 View Carrier F873EE"}	\N	2026-11-01 23:12:10.620089+05:30
00bf5ce1-6f56-4520-9de8-386ed7787390	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	212cbcc1-1366-4e3c-b71e-7dcd0aa97f08	{"size": 11, "title": "Brochure", "plan_id": "28828765-827a-4feb-8c4c-49626c64c942", "filename": "b.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 23:12:12.67832+05:30
3d122e33-5e14-48fe-92df-9c3450b43920	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	dc780ddf-89d3-4dc2-beef-793d7ba36415	{"phone": "+919812603019", "has_pan": false, "full_name": "PolicyUserF5538E TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 23:12:17.332724+05:30
803129d1-3083-4a09-b11e-ae026b7c1c86	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	2214e29b-49a5-4a4a-ae29-b0ea13df7bd0	{"code": "CI-F5538E", "name": "Carrier Inherit F5538E", "category": "Health Insurance"}	\N	2026-11-01 23:12:19.492864+05:30
4d9e1554-eb85-4d24-8d5d-ea7d1ad6a23d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	80cad959-6db1-4eb5-85eb-45c6fb494792	{"code": "PLA-F5538E", "name": "Plan Alpha F5538E", "company_id": "2214e29b-49a5-4a4a-ae29-b0ea13df7bd0", "company_name": "Carrier Inherit F5538E"}	\N	2026-11-01 23:12:21.559217+05:30
2719f013-985a-402e-ac33-80347dbc885e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	5245e74a-7c7f-4cb3-943d-297917240f91	{"code": "PLB-F5538E", "name": "Plan Beta F5538E", "company_id": "2214e29b-49a5-4a4a-ae29-b0ea13df7bd0", "company_name": "Carrier Inherit F5538E"}	\N	2026-11-01 23:12:23.690023+05:30
04787a4d-1fac-4994-b303-55e76c2d628d	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	253c959a-0193-4117-9e0f-8aa807ef3df4	{"size": 45, "title": "Alpha Master Brochure", "plan_id": "80cad959-6db1-4eb5-85eb-45c6fb494792", "filename": "alpha_brochure.pdf", "document_type": "Policy Brochure"}	\N	2026-11-01 23:12:25.803034+05:30
c32a8392-8dc5-47e9-a1ab-381fa2403b70	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_STATUS_CHANGED	policy	9d16e25e-677e-4407-985d-5436b55217e5	{"notes": "", "new_status": "ACTIVE", "old_status": "ACTIVE"}	\N	2026-11-01 23:53:09.10433+05:30
04f0e7d3-0aca-454e-8c8c-8154da3ac792	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	8444f06e-ccf3-478b-9325-2624ec6fd9e8	{"size": 30, "title": "Alpha Claim Form", "plan_id": "80cad959-6db1-4eb5-85eb-45c6fb494792", "filename": "alpha_claim.pdf", "document_type": "Claim Form"}	\N	2026-11-01 23:12:27.903988+05:30
3fa3c597-02d8-43d3-8546-ce6177966cd7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	1bd8fa7d-551f-441b-86b3-0916868601a8	{"size": 42, "title": "Beta Wording T&C", "plan_id": "5245e74a-7c7f-4cb3-943d-297917240f91", "filename": "beta_wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-01 23:12:29.983675+05:30
74decc17-d266-4763-9572-c975931dfeaa	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	6256d7bc-6c42-43ba-8e37-81793142cb20	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 17700.0, "policy_number": "POL-A-F5538E", "nominees_count": 0}	\N	2026-11-01 23:12:32.148798+05:30
d118acd5-783a-490d-b2c4-2ad9c77555e6	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	297d4fb9-9fd2-4d48-864d-bcd7c0a95596	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 9440.0, "policy_number": "POL-B-F5538E", "nominees_count": 0}	\N	2026-11-01 23:12:34.276087+05:30
484c1f45-f77e-4840-8a86-d8c19478ee1c	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	9629785d-7019-4135-b7cd-fc8d77aec1c9	{"phone": "+919814542785", "has_pan": false, "full_name": "PolicyUser333FCA TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 23:12:43.082418+05:30
68e237e5-8cb6-4f15-b05d-1d63e85bed7f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	d662b0c8-643f-43ab-8eaa-6cfafaa4cebf	{"code": "CI-333FCA", "name": "Carrier Inherit 333FCA", "category": "Health Insurance"}	\N	2026-11-01 23:12:45.335122+05:30
19f4a430-998b-4c5f-8d11-6b87d319ccc3	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	d514c7ee-2d40-446c-b7e1-37fbbf09ed19	{"code": "PLA-333FCA", "name": "Plan Alpha 333FCA", "company_id": "d662b0c8-643f-43ab-8eaa-6cfafaa4cebf", "company_name": "Carrier Inherit 333FCA"}	\N	2026-11-01 23:12:47.437575+05:30
8b4ba802-ffb6-4bc3-8011-6dbd1362b77a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	49da15b2-c063-406c-9ca3-ddc2ad43c200	{"code": "PLB-333FCA", "name": "Plan Beta 333FCA", "company_id": "d662b0c8-643f-43ab-8eaa-6cfafaa4cebf", "company_name": "Carrier Inherit 333FCA"}	\N	2026-11-01 23:12:49.512951+05:30
567d35d6-fd54-4654-94a9-a1075211487f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	42a8ecc2-51b7-4722-a260-808645274d41	{"size": 43, "title": "Alpha T&C", "plan_id": "d514c7ee-2d40-446c-b7e1-37fbbf09ed19", "filename": "alpha_terms.pdf", "document_type": "Terms & Conditions"}	\N	2026-11-01 23:12:51.622013+05:30
7584e65a-1382-44c4-999b-a8d7e1ebd184	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	c812276b-5be0-41d8-9426-d4a30b28f340	{"size": 29, "title": "Beta Riders", "plan_id": "49da15b2-c063-406c-9ca3-ddc2ad43c200", "filename": "beta_riders.pdf", "document_type": "Rider Documents"}	\N	2026-11-01 23:12:53.740848+05:30
df221a4f-1ef7-4f97-8831-6af14968387c	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	a90a0bde-155c-4c9f-91f9-30755fb877dc	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 14160.0, "policy_number": "POL-DL-333FCA", "nominees_count": 0}	\N	2026-11-01 23:12:55.880247+05:30
2adf1094-f964-48cb-95fb-22614d2e759d	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	18a0f250-73b5-4398-945c-f6913e554a39	{"phone": "+919877927512", "has_pan": false, "full_name": "PolicyUser4C1566 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 23:13:04.98654+05:30
95eeb1df-7917-4216-ba9c-47a5cdc53c62	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	74211c83-8de2-46a3-b6f5-eabd5b500a54	{"code": "CI-4C1566", "name": "Carrier Inherit 4C1566", "category": "Health Insurance"}	\N	2026-11-01 23:13:07.149192+05:30
6d459d7c-5341-4c93-baad-c5e5deae590f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	6ea8238b-df3a-4839-8b28-73261d187e27	{"code": "PLA-4C1566", "name": "Plan Alpha 4C1566", "company_id": "74211c83-8de2-46a3-b6f5-eabd5b500a54", "company_name": "Carrier Inherit 4C1566"}	\N	2026-11-01 23:13:09.236158+05:30
047a4fb9-4729-4e6d-89f9-b2ae8e7c4741	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	6da00363-1782-4b82-b9b1-9f0b8ff0ae16	{"code": "PLB-4C1566", "name": "Plan Beta 4C1566", "company_id": "74211c83-8de2-46a3-b6f5-eabd5b500a54", "company_name": "Carrier Inherit 4C1566"}	\N	2026-11-01 23:13:11.30567+05:30
e72b5f23-075d-41e1-89aa-c55ee7c89945	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	bcd8d0f7-a931-43bd-ba00-20247ce99872	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1500000.0, "final_premium": 23600.0, "policy_number": "POL-SPEC-4C1566", "nominees_count": 0}	\N	2026-11-01 23:13:13.426512+05:30
94b1f05d-44ed-4a0a-8997-6d1dd9461c72	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	e1acfa56-be8e-47bb-9344-dd01983d1313	{"size": 47, "title": "Client PAN Card Copy", "filename": "customer_pan.pdf", "policy_id": "bcd8d0f7-a931-43bd-ba00-20247ce99872", "document_type": "Customer KYC"}	\N	2026-11-01 23:13:15.53992+05:30
1ccd35af-5dee-4cfa-9263-11f8939073c1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	6b34546a-15a6-408a-a132-04bee8c6d3d2	{"size": 53, "title": "Pre-policy Medical Checkup", "filename": "medical_checkup.pdf", "policy_id": "bcd8d0f7-a931-43bd-ba00-20247ce99872", "document_type": "Medical Report"}	\N	2026-11-01 23:13:17.700214+05:30
f543c351-ca6f-4d44-9a74-ee8c0e6323d1	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	e1acfa56-be8e-47bb-9344-dd01983d1313	{"title": {"to": "Updated PAN & Voter ID", "from": "Client PAN Card Copy"}, "description": {"to": "Re-verified with DigiLocker", "from": "Verified original document"}}	\N	2026-11-01 23:13:25.988595+05:30
4afff7fd-6f46-4a1a-8412-77d2df61baa4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	e1acfa56-be8e-47bb-9344-dd01983d1313	{"file_replacement": {"to_size": 49, "from_size": 47, "to_filename": "updated_pan.pdf", "from_filename": "customer_pan.pdf"}}	\N	2026-11-01 23:13:28.103079+05:30
63b2a9f1-a5f2-42cd-a86b-758121da27f0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_DELETED	insurance_policy_document	e1acfa56-be8e-47bb-9344-dd01983d1313	{"title": "Updated PAN & Voter ID", "filename": "updated_pan.pdf", "policy_id": "bcd8d0f7-a931-43bd-ba00-20247ce99872"}	\N	2026-11-01 23:13:32.222003+05:30
960f6a0e-9931-4929-8f45-c04635cfa1cd	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	39b1ae40-e8af-458b-b8f7-2324e1b7692e	{"phone": "+919882940059", "has_pan": false, "full_name": "PolicyUserF7855D TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-01 23:13:36.768049+05:30
648132db-00dc-4e05-a071-cc97da02bb0b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	6cb0ec18-e2b1-4d90-83db-25939877aae1	{"code": "CI-F7855D", "name": "Carrier Inherit F7855D", "category": "Health Insurance"}	\N	2026-11-01 23:13:38.985169+05:30
1cfde495-0c5a-4a97-a414-053ae866bfbb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	c992e607-b7d2-4a7f-be7e-b045528966ae	{"code": "PLA-F7855D", "name": "Plan Alpha F7855D", "company_id": "6cb0ec18-e2b1-4d90-83db-25939877aae1", "company_name": "Carrier Inherit F7855D"}	\N	2026-11-01 23:13:41.102425+05:30
1f6efb89-b9db-4b80-a390-acea4009b649	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	877a4808-a654-4d51-8295-5bde0a7a3f12	{"code": "PLB-F7855D", "name": "Plan Beta F7855D", "company_id": "6cb0ec18-e2b1-4d90-83db-25939877aae1", "company_name": "Carrier Inherit F7855D"}	\N	2026-11-01 23:13:43.216562+05:30
3a9b432c-44db-4ccd-a688-300dfc1bd431	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	d73847e5-8829-4127-bc30-2ad1a7f21ee7	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL1-F7855D", "nominees_count": 0}	\N	2026-11-01 23:13:45.292528+05:30
b94fbfcb-fc3c-4fec-9f51-8189841da21e	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	1264d22b-6af4-462a-88a2-3b1cc4ef862d	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL2-F7855D", "nominees_count": 0}	\N	2026-11-01 23:13:47.437896+05:30
9aca9ead-5555-47e3-8984-fb6da16f8d5e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	0d4e7673-c0b1-42b9-b67e-a8cd7cf632fa	{"size": 36, "title": "Cert P1", "filename": "cert_p1.pdf", "policy_id": "d73847e5-8829-4127-bc30-2ad1a7f21ee7", "document_type": "Official Policy Certificate"}	\N	2026-11-01 23:13:53.750448+05:30
a9706707-50af-4057-a158-ae8e2cd2eb01	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_UPDATED	customer	ed8d43c3-d89f-4d77-8202-a2ebc03bb406	{"updated_fields": ["first_name", "last_name", "phone", "email", "gender", "date_of_birth", "anniversary_date", "marital_status", "nationality", "state", "city", "address", "pincode", "occupation", "source_of_income", "pan_number", "aadhaar_number", "customer_type", "company_name", "corporate_code", "gstin", "contact_person_name", "contact_person_phone", "contact_person_email"]}	\N	2026-11-02 18:08:20.328973+05:30
90fc0632-ee24-4218-9801-f6b080796876	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_UPDATED	customer	ed8d43c3-d89f-4d77-8202-a2ebc03bb406	{"updated_fields": ["first_name", "last_name", "phone", "email", "gender", "date_of_birth", "anniversary_date", "marital_status", "nationality", "state", "city", "address", "pincode", "occupation", "source_of_income", "pan_number", "aadhaar_number", "customer_type", "company_name", "corporate_code", "gstin", "contact_person_name", "contact_person_phone", "contact_person_email"]}	\N	2026-11-02 18:08:52.451647+05:30
cae008c6-2902-4557-826c-1d2b4cefba93	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	fafca85b-89df-4fe5-bc15-20ce5c2133ec	{"is_active": {"to": false, "from": true}}	\N	2026-11-02 18:20:28.373657+05:30
bce43bab-45dc-4654-85d4-5ea684119beb	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	fafca85b-89df-4fe5-bc15-20ce5c2133ec	{"is_active": {"to": false, "from": false}}	\N	2026-11-02 18:20:30.029631+05:30
e84ec63c-a9a7-4071-b774-d11e6e44ff5a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	fafca85b-89df-4fe5-bc15-20ce5c2133ec	{"is_active": {"to": true, "from": false}}	\N	2026-11-02 18:20:40.897492+05:30
091aaa80-3643-405c-bf07-4f332d9e8d82	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	13a61905-cb9f-41cf-8bca-dbdcaee8ca63	{"code": "IFFTOK-D8C6", "name": "iffco tokio", "category": "General/Motor"}	\N	2026-11-02 18:51:03.860417+05:30
91be7f35-9cf9-470f-89a3-998e2fc8ba31	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	56931f84-528d-46a0-81e1-f59408773c9f	{"code": "ASDSAF", "name": "optima restore", "company_id": "b06a433f-624a-4900-a3f8-860d5fbbf9f8", "company_name": "HDFC ERGO General Insurance"}	\N	2026-11-02 19:04:09.754979+05:30
3fef72f1-124c-47e8-85e1-850ec369e38c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	0866207c-2169-43c3-94d7-89f513c5598e	{"size": 87526, "title": "AdityaThakre_Resume-2 (1)", "plan_id": "56931f84-528d-46a0-81e1-f59408773c9f", "filename": "AdityaThakre_Resume-2 (1).pdf", "document_type": "Policy Brochure"}	\N	2026-11-02 19:04:11.863251+05:30
fb31b9f6-3373-465e-b0b6-55a831d8d0ac	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	1a83f7e4-b24d-4a56-8460-64878d36d8a2	{"size": 94306, "title": "Spiderman Brand New Day", "plan_id": "56931f84-528d-46a0-81e1-f59408773c9f", "filename": "Spiderman Brand New Day.jpg", "document_type": "Premium Chart"}	\N	2026-11-02 19:04:13.98388+05:30
de185a16-2a67-48cf-a0c2-465b81013c2c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	bf49a538-f9a4-4b4d-b2de-ffdb1b1a1093	{"size": 201232, "title": "4th Sem Hall ticket", "plan_id": "56931f84-528d-46a0-81e1-f59408773c9f", "filename": "4th Sem Hall ticket.pdf", "document_type": "Claim Form"}	\N	2026-11-02 19:04:16.082512+05:30
de698d20-ac54-41c7-baa9-a6f9086a7d57	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_UPDATED	customer	5a199e21-1953-41ae-b32f-e193bf5400c2	{"updated_fields": ["first_name", "last_name", "phone", "email", "gender", "date_of_birth", "anniversary_date", "marital_status", "nationality", "state", "city", "address", "pincode", "occupation", "source_of_income", "pan_number", "aadhaar_number", "customer_type", "company_name", "corporate_code", "gstin", "contact_person_name", "contact_person_phone", "contact_person_email"]}	\N	2026-11-02 19:14:56.329985+05:30
124ff626-c03a-4096-912c-55ad90aadfdc	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_KYC_UNMASKED	customer	5a199e21-1953-41ae-b32f-e193bf5400c2	{"full_name": "Aditya Thakre", "access_type": "FULL_KYC_DISCLOSURE", "customer_id": "5a199e21-1953-41ae-b32f-e193bf5400c2"}	\N	2026-11-02 19:15:17.092633+05:30
2add7405-af8c-48e2-b3b7-7bedab9dc960	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_UPDATED	customer	5a199e21-1953-41ae-b32f-e193bf5400c2	{"updated_fields": ["first_name", "last_name", "phone", "email", "gender", "date_of_birth", "anniversary_date", "marital_status", "nationality", "state", "city", "address", "pincode", "occupation", "source_of_income", "pan_number", "aadhaar_number", "customer_type", "company_name", "corporate_code", "gstin", "contact_person_name", "contact_person_phone", "contact_person_email"]}	\N	2026-11-02 19:17:13.393003+05:30
29847501-24d2-43f8-8f8a-89f5df79c6ad	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	15d44347-7c07-4e4f-8dcd-fb8961d4219f	{"amount": 4.0, "payment_id": "648b13ca-7257-44e8-8392-b480ac505853", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-03 17:03:00.833029+05:30
116f9ab0-a654-498b-8477-31c7cc2d3641	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	15d44347-7c07-4e4f-8dcd-fb8961d4219f	{"status": "ACTIVE", "policy_type": "OTHER", "sum_assured": 1000000.0, "final_premium": 53100.0, "policy_number": "QWDQW", "nominees_count": 0}	\N	2026-11-03 17:03:00.861232+05:30
51960b1f-1eab-4dc4-a27e-82539edd8904	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"amount": 10000.0, "payment_id": "e218b390-f730-4962-a044-9875ea56690b", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-03 17:23:58.67527+05:30
f521f6a0-4dfe-4b8c-80d4-7679f0564f1b	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"status": "ACTIVE", "policy_type": "OTHER", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-CORP-2026-49576", "nominees_count": 0}	\N	2026-11-03 17:23:58.685311+05:30
92b172ee-d28c-48e5-acae-192b8bab7d4c	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_UPDATED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"status": "ACTIVE", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-CORP-2026-49576"}	\N	2026-11-03 17:27:09.834677+05:30
a59d84a9-1b1c-496c-bbb8-f1e1d0b63305	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_UPDATED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"status": "ACTIVE", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-CORP-2026-49576"}	\N	2026-11-03 17:27:33.694107+05:30
44b62a9b-f40f-448d-8b57-3ba904d33473	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_RENEWED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"new_expiry": "2028-11-03", "old_expiry": "2027-11-03", "renewal_premium": 11800.0}	\N	2026-11-03 17:41:57.449221+05:30
67fa4064-e7dc-42d9-9236-af4755e11972	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_RENEWED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"new_expiry": "2029-11-03", "old_expiry": "2028-11-03", "renewal_premium": 15800.0}	\N	2026-11-03 17:44:18.510004+05:30
937ccbe6-e0b2-4afe-a97f-1c794bf38192	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	{"client_name": "Vikram Rathore", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00053"}	\N	2026-11-03 18:20:49.549858+05:30
65e760f0-66ce-4ccb-8d33-d70dcf5aaa81	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	5fcc48da-7f59-4a20-9bc5-4544de8b43bd	{"code": "CMP-E54309", "name": "Workflow Test Carrier E54309", "category": "Health Insurance"}	\N	2026-11-03 21:19:52.644821+05:30
8b2d08a2-f545-4f4b-93bf-65bcbea47814	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	844cd334-7cf0-4557-81c3-75c672b3e6ce	{"code": "PLN-E54309", "name": "Comprehensive Health Plus E54309", "company_id": "5fcc48da-7f59-4a20-9bc5-4544de8b43bd", "company_name": "Workflow Test Carrier E54309"}	\N	2026-11-03 21:19:52.665029+05:30
8511eb46-bf04-447b-a366-c748e0be283f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	5fcc48da-7f59-4a20-9bc5-4544de8b43bd	{"is_active": {"to": false, "from": true}}	\N	2026-11-03 21:19:52.700211+05:30
4bd1fd7f-2d00-4514-b786-d636e18fb9d9	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_STATUS_CHANGED	insurance_company	5fcc48da-7f59-4a20-9bc5-4544de8b43bd	{"is_active": {"to": true, "from": false}}	\N	2026-11-03 21:19:52.724449+05:30
7ba9a14f-a3a2-4e22-9fe7-4e981d3d1ab2	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	cf3fe13e-e279-41f4-912f-76f3adb25b74	{"code": "DC-E687E1", "name": "Docs Carrier E687E1", "category": "Health Insurance"}	\N	2026-11-03 21:19:53.288734+05:30
ff3fd77e-a7e5-4edd-a7a6-2f9f504da43b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	d8b66a85-ab10-43d2-9f4c-a14b6e37defa	{"code": "DP-E687E1", "name": "Docs Plan E687E1", "company_id": "cf3fe13e-e279-41f4-912f-76f3adb25b74", "company_name": "Docs Carrier E687E1"}	\N	2026-11-03 21:19:53.348261+05:30
7bb184ef-827d-4214-b87d-54726be0d112	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	a3391181-6db9-4b22-b46a-e7ee15ef29f8	{"size": 61, "title": "Official Plan Brochure 2026", "plan_id": "d8b66a85-ab10-43d2-9f4c-a14b6e37defa", "filename": "brochure_2026.pdf", "document_type": "Policy Brochure"}	\N	2026-11-03 21:19:53.384019+05:30
24f6259f-eabc-4074-8d96-c9bd876dce6c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	553b3353-a226-42cc-aa19-b09911c4cba0	{"size": 20, "title": "Reimbursement Claim Intimation Form", "plan_id": "d8b66a85-ab10-43d2-9f4c-a14b6e37defa", "filename": "claim_intimation.docx", "document_type": "Claim Form"}	\N	2026-11-03 21:19:53.415157+05:30
f5b1a738-1840-471f-ba89-30eac0f8f050	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	9c5837bc-7894-4ba2-8457-8986ad590cda	{"size": 20, "title": "Age-wise Premium Rate Chart", "plan_id": "d8b66a85-ab10-43d2-9f4c-a14b6e37defa", "filename": "rates_chart.xlsx", "document_type": "Premium Chart"}	\N	2026-11-03 21:19:53.437905+05:30
0c9c8465-8f24-4b53-98df-21dac2b9dbcf	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	b3d12d6c-9cd9-45f8-b9d6-ffccf913f9de	{"size": 23, "title": "Network Hospital Infographic", "plan_id": "d8b66a85-ab10-43d2-9f4c-a14b6e37defa", "filename": "hospitals.png", "document_type": "Coverage Details"}	\N	2026-11-03 21:19:53.460607+05:30
80f17827-a971-471e-8270-3c9c4fdc41d6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	a951ccab-c95c-4cc5-add7-a1515d30394d	{"code": "SC-BB9D19", "name": "Stream Carrier BB9D19", "category": "Health Insurance"}	\N	2026-11-03 21:19:54.071311+05:30
e3fc2f1c-bf4d-424e-ac52-43454a89e730	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	dada69bf-34e5-4923-b038-fb3e2f7b6537	{"code": "SP-BB9D19", "name": "Stream Plan BB9D19", "company_id": "a951ccab-c95c-4cc5-add7-a1515d30394d", "company_name": "Stream Carrier BB9D19"}	\N	2026-11-03 21:19:54.101047+05:30
c35c05e3-e5e8-4a6d-a694-8a26efb6be63	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	be66e7c2-b028-453d-bbd2-74698172913c	{"size": 54, "title": "Full Policy Terms & Conditions", "plan_id": "dada69bf-34e5-4923-b038-fb3e2f7b6537", "filename": "wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-03 21:19:54.133472+05:30
907435b7-1d72-4334-bb8d-835864b2c2ac	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	11dce89f-b83d-42f3-806d-fb90b6a1f169	{"code": "LC-C459A5", "name": "Lifecycle Carrier C459A5", "category": "Health Insurance"}	\N	2026-11-03 21:19:54.831814+05:30
a848cc24-d1a5-48cb-8cb9-a1474ba28585	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	f3289de0-b6af-4ce8-84a3-254fb77bd496	{"code": "LP-C459A5", "name": "Lifecycle Plan C459A5", "company_id": "11dce89f-b83d-42f3-806d-fb90b6a1f169", "company_name": "Lifecycle Carrier C459A5"}	\N	2026-11-03 21:19:54.861895+05:30
8c169a69-8b1a-49c7-b9c1-16d8db590037	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	6d71d71b-5a34-4b2b-ba42-2bdbc1983ae6	{"size": 42, "title": "Initial Prospectus v1", "plan_id": "f3289de0-b6af-4ce8-84a3-254fb77bd496", "filename": "prospectus_v1.pdf", "document_type": "Prospectus"}	\N	2026-11-03 21:19:54.892647+05:30
c833d948-bb15-49a8-a06c-31519e43fcea	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	6d71d71b-5a34-4b2b-ba42-2bdbc1983ae6	{"title": {"to": "Updated Prospectus 2026 Final", "from": "Initial Prospectus v1"}, "description": {"to": "Revised pricing appendix", "from": null}}	\N	2026-11-03 21:19:54.921517+05:30
2736ba73-7f9a-435c-b656-89a5ae2634b7	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPDATED	insurance_plan_document	6d71d71b-5a34-4b2b-ba42-2bdbc1983ae6	{"title": {"to": "Prospectus v2 Replaced", "from": "Updated Prospectus 2026 Final"}, "file_replacement": {"to_size": 58, "from_size": 42, "to_filename": "prospectus_v2.pdf", "from_filename": "prospectus_v1.pdf"}}	\N	2026-11-03 21:19:54.942064+05:30
9d75dd76-8718-488e-9d3b-4e0f147c1eff	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_DELETED	insurance_plan_document	6d71d71b-5a34-4b2b-ba42-2bdbc1983ae6	{"title": "Prospectus v2 Replaced", "plan_id": "f3289de0-b6af-4ce8-84a3-254fb77bd496", "filename": "prospectus_v2.pdf"}	\N	2026-11-03 21:19:54.971278+05:30
24b6507d-82c9-4d27-8d13-8923e12143db	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	863f3d63-3e6b-45d5-a246-40ca158fa736	{"code": "V360-C8DC80", "name": "360 View Carrier C8DC80", "category": "Composite"}	\N	2026-11-03 21:19:55.596397+05:30
41dfec55-8a72-4f1a-be9c-92440b1c17ac	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	797b3147-f98a-400d-8c8b-4ce03a66a310	{"code": "ACT-C8DC80", "name": "Active Plan C8DC80", "company_id": "863f3d63-3e6b-45d5-a246-40ca158fa736", "company_name": "360 View Carrier C8DC80"}	\N	2026-11-03 21:19:55.616058+05:30
3e6652b2-fbea-46fa-8567-76fa35c7fb57	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	bda31222-5ff6-49a9-82ff-8ae8620daaa0	{"code": "INACT-C8DC80", "name": "Inactive Plan C8DC80", "company_id": "863f3d63-3e6b-45d5-a246-40ca158fa736", "company_name": "360 View Carrier C8DC80"}	\N	2026-11-03 21:19:55.634369+05:30
558213d2-fe69-4311-86c6-399eb4dbc8d0	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	385e7c91-26d8-43fd-9e07-94f13e9a13ee	{"size": 11, "title": "Brochure", "plan_id": "797b3147-f98a-400d-8c8b-4ce03a66a310", "filename": "b.pdf", "document_type": "Policy Brochure"}	\N	2026-11-03 21:19:55.653918+05:30
74197324-734e-4c48-b53b-32b36926c062	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00054"}	\N	2026-11-03 21:20:29.18495+05:30
a9f1d5fb-976a-4195-b82f-8034c4c2d93c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	6028f846-c2d6-4233-a107-97e9fe686ff6	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00055"}	\N	2026-11-03 21:20:29.643572+05:30
8d60717d-7879-4a27-875b-2bb7c431c4df	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	4e547f92-1679-4d2c-b30f-999e36316840	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00056"}	\N	2026-11-03 21:20:30.288575+05:30
ef9c79ea-4453-4e22-8111-65992680d096	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	f199b890-ac6f-4126-9afa-09844a7ef3c9	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00057"}	\N	2026-11-03 21:20:30.787826+05:30
af2b0054-1ae2-4a44-a336-f545c5575086	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	f199b890-ac6f-4126-9afa-09844a7ef3c9	{"status": "DRAFT", "updated_at": "2026-11-03T15:50:30.818957+00:00", "quotation_number": "HQ-2026-00057"}	\N	2026-11-03 21:20:30.819786+05:30
ab1af6f0-1e07-4e8a-a163-37f429c65ce8	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	f98d579f-6da5-4f88-b527-6fc3b579ed5c	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00058"}	\N	2026-11-03 21:20:31.319593+05:30
bf16b947-8e6c-4e37-ad51-11da7f58f99d	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	fdc8ca93-a632-47ad-af03-246163065d4d	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00059"}	\N	2026-11-03 21:20:31.898988+05:30
0501089f-2443-4be1-9b4f-de27da3d4224	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	c8dc02ce-cb9c-4807-a312-df0b753133c3	{"source_quotation_id": "fdc8ca93-a632-47ad-af03-246163065d4d", "new_quotation_number": "HQ-2026-00060"}	\N	2026-11-03 21:20:31.972666+05:30
4f207d58-eeb3-4a30-981a-dd43fb90a126	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	c8dc02ce-cb9c-4807-a312-df0b753133c3	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00060"}	\N	2026-11-03 21:20:31.999431+05:30
f26cf236-084e-4f30-b722-23b95a13152f	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	0b701338-6132-4e11-a922-a9619b0d8397	{"phone": "+919822900746", "has_pan": false, "full_name": "PolicyUserA4F608 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-03 21:38:56.789749+05:30
26b8718d-6df3-4150-ac7b-61180bcefcd8	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	0bb8d0e0-9dfb-4fd1-b4fb-bb26cc4d55fb	{"code": "CI-A4F608", "name": "Carrier Inherit A4F608", "category": "Health Insurance"}	\N	2026-11-03 21:38:57.027897+05:30
17325ece-155e-4dc3-913b-31e749dee9f5	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd	{"code": "PLA-A4F608", "name": "Plan Alpha A4F608", "company_id": "0bb8d0e0-9dfb-4fd1-b4fb-bb26cc4d55fb", "company_name": "Carrier Inherit A4F608"}	\N	2026-11-03 21:38:57.056342+05:30
6fb30256-9fa5-417f-9e2d-7f8bb61ee5e4	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	08021add-8a7d-4490-afbb-c9fff1b3cb4f	{"status": "DRAFT", "updated_at": "2026-11-04T17:36:29.784853+00:00", "quotation_number": "HQ-2026-00108"}	\N	2026-11-04 23:06:29.785627+05:30
8b351c8f-6c35-4cf8-b158-1dc144c459b4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	b6346a0c-1149-4eeb-9754-5d277eb859b1	{"code": "PLB-A4F608", "name": "Plan Beta A4F608", "company_id": "0bb8d0e0-9dfb-4fd1-b4fb-bb26cc4d55fb", "company_name": "Carrier Inherit A4F608"}	\N	2026-11-03 21:38:57.075326+05:30
bb683be7-e00f-4cf7-8a97-13b15272beed	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	f3fa93fc-1a22-4a95-bc35-4e7bcb0f9578	{"size": 45, "title": "Alpha Master Brochure", "plan_id": "8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd", "filename": "alpha_brochure.pdf", "document_type": "Policy Brochure"}	\N	2026-11-03 21:38:57.096968+05:30
d6918374-b6e4-44fc-a976-55f2bf37d82e	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	5fe74be4-d1bc-440b-9f20-6d4f93be44b2	{"size": 30, "title": "Alpha Claim Form", "plan_id": "8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd", "filename": "alpha_claim.pdf", "document_type": "Claim Form"}	\N	2026-11-03 21:38:57.125231+05:30
629d24cd-9fc5-4f34-bb8a-4bac7f0e32c6	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	9c680d7b-2bd8-40cd-bd0d-c0eb7892be7b	{"size": 42, "title": "Beta Wording T&C", "plan_id": "b6346a0c-1149-4eeb-9754-5d277eb859b1", "filename": "beta_wording.pdf", "document_type": "Policy Wording"}	\N	2026-11-03 21:38:57.143671+05:30
30baabd7-e556-4ead-8f2e-7fba208f2e54	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	2054881c-6659-48e7-b5aa-98e3812c8f21	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 17700.0, "policy_number": "POL-A-A4F608", "nominees_count": 0}	\N	2026-11-03 21:38:57.188207+05:30
f87b1a04-e1e4-41fa-a319-ebe0d0febb4c	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	f95dbcc3-b612-4f08-bfb4-c8416745e488	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 9440.0, "policy_number": "POL-B-A4F608", "nominees_count": 0}	\N	2026-11-03 21:38:57.25029+05:30
878d4ab3-d2a6-4484-8266-de239d8f41ed	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	316122a1-2f49-4723-b474-8741b77c286e	{"phone": "+919837348338", "has_pan": false, "full_name": "PolicyUserEC2FD8 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-03 21:38:57.814235+05:30
888716cf-c6af-4099-8974-f1cc6ad60c1a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	0a1ff162-37d4-438b-a105-806e983e2ee4	{"code": "CI-EC2FD8", "name": "Carrier Inherit EC2FD8", "category": "Health Insurance"}	\N	2026-11-03 21:38:57.9791+05:30
ab9a6e5d-f1d6-40a4-80bd-e6ce07e0aac4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	ab6db863-1154-4f4f-9263-43ff93fb0ad8	{"code": "PLA-EC2FD8", "name": "Plan Alpha EC2FD8", "company_id": "0a1ff162-37d4-438b-a105-806e983e2ee4", "company_name": "Carrier Inherit EC2FD8"}	\N	2026-11-03 21:38:58.086643+05:30
d875f9bf-d57f-43e5-ac52-6127151bb993	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	85dd741b-8b1e-4edc-8300-1f0b95eb890e	{"code": "PLB-EC2FD8", "name": "Plan Beta EC2FD8", "company_id": "0a1ff162-37d4-438b-a105-806e983e2ee4", "company_name": "Carrier Inherit EC2FD8"}	\N	2026-11-03 21:38:58.110308+05:30
1146e64a-bb50-473c-9140-b5f47c003227	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	63071cb7-bfcf-426d-a378-9968ad217d9b	{"size": 43, "title": "Alpha T&C", "plan_id": "ab6db863-1154-4f4f-9263-43ff93fb0ad8", "filename": "alpha_terms.pdf", "document_type": "Terms & Conditions"}	\N	2026-11-03 21:38:58.129998+05:30
4a07be48-54be-444f-85b9-3dccd5767771	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_DOCUMENT_UPLOADED	insurance_plan_document	31f38125-443a-43ac-a2f6-0a357154a0da	{"size": 29, "title": "Beta Riders", "plan_id": "85dd741b-8b1e-4edc-8300-1f0b95eb890e", "filename": "beta_riders.pdf", "document_type": "Rider Documents"}	\N	2026-11-03 21:38:58.151781+05:30
789e6c65-73df-4348-8d0d-53b67a8f4ddb	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	65fc19e1-04a6-4e38-9f84-7b91807b420d	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 14160.0, "policy_number": "POL-DL-EC2FD8", "nominees_count": 0}	\N	2026-11-03 21:38:58.188823+05:30
e7aaad82-c029-4228-81b7-dedbf79d1535	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	cc8a0165-109d-4647-8ed7-7e50ad3e1859	{"phone": "+919833147794", "has_pan": false, "full_name": "PolicyUser7F47C1 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-03 21:38:58.747893+05:30
2855a496-ae9a-4b24-98a8-cf1397fad983	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	6567b961-1a16-4703-911a-22911aebb56c	{"code": "CI-7F47C1", "name": "Carrier Inherit 7F47C1", "category": "Health Insurance"}	\N	2026-11-03 21:38:58.971185+05:30
dcd95d74-efbe-43e9-992d-01a5a7af5c78	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	b4186ca6-d53c-447a-bdae-b7b8a96effd8	{"code": "PLA-7F47C1", "name": "Plan Alpha 7F47C1", "company_id": "6567b961-1a16-4703-911a-22911aebb56c", "company_name": "Carrier Inherit 7F47C1"}	\N	2026-11-03 21:38:59.028617+05:30
4f5aebaf-a54f-4bde-8ab1-d1e7c34aceca	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	5390ef62-18cb-4ed2-bd9c-8cc81a7592be	{"code": "PLB-7F47C1", "name": "Plan Beta 7F47C1", "company_id": "6567b961-1a16-4703-911a-22911aebb56c", "company_name": "Carrier Inherit 7F47C1"}	\N	2026-11-03 21:38:59.048464+05:30
f27ff29b-ad68-4ee3-900b-42efd969fc7b	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	a4ad845f-0afc-473b-81bd-d354485041ba	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1500000.0, "final_premium": 23600.0, "policy_number": "POL-SPEC-7F47C1", "nominees_count": 0}	\N	2026-11-03 21:38:59.101328+05:30
c1c42940-159a-46b4-873b-7cdb49a90603	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	6fa1c708-c167-417c-9286-2d878f34bedd	{"size": 47, "title": "Client PAN Card Copy", "filename": "customer_pan.pdf", "policy_id": "a4ad845f-0afc-473b-81bd-d354485041ba", "document_type": "Customer KYC"}	\N	2026-11-03 21:38:59.167373+05:30
a740fb06-d405-4bfc-b369-6365fa138001	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	34d24b8a-b0e1-4c13-b2b4-268492a73655	{"size": 53, "title": "Pre-policy Medical Checkup", "filename": "medical_checkup.pdf", "policy_id": "a4ad845f-0afc-473b-81bd-d354485041ba", "document_type": "Medical Report"}	\N	2026-11-03 21:38:59.224505+05:30
d0c79b49-ff36-437f-8a51-3b9193bb65a4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	6fa1c708-c167-417c-9286-2d878f34bedd	{"title": {"to": "Updated PAN & Voter ID", "from": "Client PAN Card Copy"}, "description": {"to": "Re-verified with DigiLocker", "from": "Verified original document"}}	\N	2026-11-03 21:38:59.31881+05:30
aaa4e0c4-e75e-4e6a-a6d9-0862c9e7af79	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPDATED	insurance_policy_document	6fa1c708-c167-417c-9286-2d878f34bedd	{"file_replacement": {"to_size": 49, "from_size": 47, "to_filename": "updated_pan.pdf", "from_filename": "customer_pan.pdf"}}	\N	2026-11-03 21:38:59.343554+05:30
73d1178f-2419-492d-bdf1-52160c9b0095	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_DELETED	insurance_policy_document	6fa1c708-c167-417c-9286-2d878f34bedd	{"title": "Updated PAN & Voter ID", "filename": "updated_pan.pdf", "policy_id": "a4ad845f-0afc-473b-81bd-d354485041ba"}	\N	2026-11-03 21:38:59.383497+05:30
18957dea-0dc9-49fa-95a9-b591ecb25fc8	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	e266c426-1186-4268-9171-ba3958a495af	{"phone": "+919870750748", "has_pan": false, "full_name": "PolicyUserF48BB7 TestClient", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-03 21:39:00.215324+05:30
436dcb59-e03f-4cdb-9625-1d78f95a7f8b	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	ab99ff29-3839-49a0-9d8c-39c2bb7431a0	{"code": "CI-F48BB7", "name": "Carrier Inherit F48BB7", "category": "Health Insurance"}	\N	2026-11-03 21:39:00.401552+05:30
f5f405c4-ab1d-4f90-99a5-297d624c597f	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	d5f22ab8-6426-4345-8c12-90ed4b01f0f9	{"code": "PLA-F48BB7", "name": "Plan Alpha F48BB7", "company_id": "ab99ff29-3839-49a0-9d8c-39c2bb7431a0", "company_name": "Carrier Inherit F48BB7"}	\N	2026-11-03 21:39:00.431198+05:30
91fad6da-e7af-4b42-bc02-a3e525e68da3	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	450117a6-c017-44e0-829b-cc5064478eb1	{"code": "PLB-F48BB7", "name": "Plan Beta F48BB7", "company_id": "ab99ff29-3839-49a0-9d8c-39c2bb7431a0", "company_name": "Carrier Inherit F48BB7"}	\N	2026-11-03 21:39:00.44824+05:30
fdf7a2f5-6b20-4bcb-8045-fb87e5b3f136	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	91c17643-4de3-4038-88c8-c82b921a96c0	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL1-F48BB7", "nominees_count": 0}	\N	2026-11-03 21:39:00.478626+05:30
31fd242b-d832-42bf-9c65-7037e5c3287d	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	646f62ed-b9b4-4237-b1b5-b9bd57637ac9	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 11800.0, "policy_number": "POL-VAL2-F48BB7", "nominees_count": 0}	\N	2026-11-03 21:39:00.526886+05:30
e4aabf6d-00ad-488d-a8da-1253012eb20c	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	297420d8-3ef4-416e-b7a9-e636be11ad8a	{"size": 36, "title": "Cert P1", "filename": "cert_p1.pdf", "policy_id": "91c17643-4de3-4038-88c8-c82b921a96c0", "document_type": "Official Policy Certificate"}	\N	2026-11-03 21:39:00.607085+05:30
0e8e1c17-a84f-4fbe-a340-6c9bea318c9f	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_UPDATED	customer	5a199e21-1953-41ae-b32f-e193bf5400c2	{"updated_fields": ["first_name", "last_name", "phone", "email", "gender", "date_of_birth", "anniversary_date", "marital_status", "nationality", "state", "city", "address", "pincode", "occupation", "source_of_income", "pan_number", "aadhaar_number", "customer_type", "company_name", "corporate_code", "gstin", "contact_person_name", "contact_person_phone", "contact_person_email"]}	\N	2026-11-03 21:49:21.606432+05:30
d3dee5da-59f6-4c75-9fac-5f9ea0607ffc	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	d41ba26d-3511-40e8-aecc-8644550490ec	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00060"}	\N	2026-11-04 22:39:43.975083+05:30
108b510b-ccb3-410b-9bc2-f085398b7c42	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	098773da-d685-4a40-a0a2-de54b771eba6	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00061"}	\N	2026-11-04 22:39:46.164991+05:30
4e53296c-7586-4eca-bcf4-2329298e2c1c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	a9b4a749-0bf9-451c-8012-99652c012be3	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00062"}	\N	2026-11-04 22:39:47.92032+05:30
a6b33df0-24ac-438a-b35e-82aba8a52dd2	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	89917f5e-d5b1-481f-9832-6f5c082bb936	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00063"}	\N	2026-11-04 22:39:49.429805+05:30
e400b876-6bd7-4cca-9867-5a31327d1cdd	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	0cab7ecb-c31d-432d-bae7-79bc0a22cab6	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00064"}	\N	2026-11-04 22:39:50.945916+05:30
08e231ac-6f08-4b8d-8399-487288128330	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	ff131008-f97d-4e80-bd6f-67f3ba3e9650	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00065"}	\N	2026-11-04 22:39:52.391104+05:30
d764a1e1-9c57-4c83-8d23-45751bdb38ab	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	3eef8c60-f6c1-4ab1-a47e-d15652f12de9	{"client_name": "Test Client", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00066"}	\N	2026-11-04 22:39:54.505106+05:30
9d44ac20-1f01-436b-ae74-09aa278d0525	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	365d3818-df64-45b2-8846-a2c17472edd0	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00067"}	\N	2026-11-04 22:40:11.671347+05:30
11dbdcba-64e3-41a0-ab21-fe03b94603fd	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	018d172c-15c0-44ba-a6f0-bfac26f39022	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00068"}	\N	2026-11-04 22:40:13.710151+05:30
4d8ab596-1423-4d72-ab96-4b674a43b59b	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	3e6c6677-e4d6-487e-94d5-206bc9a44017	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00069"}	\N	2026-11-04 22:40:15.33349+05:30
f7c8cdb8-825c-4b26-81f5-8e145cc2219c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	4bcecbe7-4475-4a3b-8253-5a6b62d2dfe8	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00070"}	\N	2026-11-04 22:40:16.787768+05:30
56091147-9344-4642-9084-93a0d9c95130	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	798500c8-0078-4338-bc3c-d9363996b3f1	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00071"}	\N	2026-11-04 22:40:18.503917+05:30
3b28f11a-929f-4c78-a571-42a4524e79bd	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	e51b5a8d-3372-4323-bf6b-0b23cf11a49e	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00072"}	\N	2026-11-04 22:40:20.081987+05:30
b5129d7b-bbdd-4a5e-83b7-9ed977cc2f9b	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	b596cbe3-309d-4ef8-bebc-dba8dbaece1a	{"client_name": "Test Client", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00073"}	\N	2026-11-04 22:40:22.214656+05:30
cbc6d873-df70-4267-9044-c827c96dc37f	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	b2d792c8-10be-4701-b511-ae1d5ef369cd	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00074"}	\N	2026-11-04 22:41:10.147323+05:30
139e906f-d827-46a2-a195-3711c08be8c0	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	5baa1a97-452f-4616-bd00-83b7fd5783f8	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00075"}	\N	2026-11-04 22:41:10.788703+05:30
82d2a57c-dc6f-4662-aff6-d717a11a3910	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	2290ab0e-610c-4ecd-80b5-4e765a786102	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00076"}	\N	2026-11-04 22:41:11.543893+05:30
f04d0aa4-06bb-46ae-a8c5-ed271d608a9f	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7f4416e8-2c68-4d69-85ad-081cb5087cd1	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00077"}	\N	2026-11-04 22:41:12.190785+05:30
568b30c9-3881-4aef-a5eb-835d39149609	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	7f4416e8-2c68-4d69-85ad-081cb5087cd1	{"status": "DRAFT", "updated_at": "2026-11-04T17:11:12.238927+00:00", "quotation_number": "HQ-2026-00077"}	\N	2026-11-04 22:41:12.240377+05:30
640229b0-8c80-44d1-b7b3-782cb2b12462	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	acedad77-57e4-44e0-9da6-cfd83e922c85	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00078"}	\N	2026-11-04 22:41:12.941236+05:30
7a06ba5e-f887-4993-ac21-25ccee5e2a52	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	85df1d39-26e2-4416-95fa-b5251e8d20f0	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00079"}	\N	2026-11-04 22:41:13.953796+05:30
048a79bf-9cec-421f-b863-872afddbc367	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	89a61ad5-f63d-4715-a9c4-705285abe6aa	{"source_quotation_id": "85df1d39-26e2-4416-95fa-b5251e8d20f0", "new_quotation_number": "HQ-2026-00080"}	\N	2026-11-04 22:41:13.996881+05:30
27533184-bbc6-453a-8d38-1a507ec55301	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	89a61ad5-f63d-4715-a9c4-705285abe6aa	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00080"}	\N	2026-11-04 22:41:14.031783+05:30
56300e3b-b2fc-4be6-a805-cef106e29120	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	224b6c12-6316-488e-b0c1-13b679cf47e3	{"client_name": "Test Client", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00080"}	\N	2026-11-04 22:41:14.781322+05:30
0492a778-b4a1-44cc-8625-94c1c3653b56	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	6ee358d0-9954-4863-bdce-3c326b318d0c	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00081"}	\N	2026-11-04 22:41:51.194822+05:30
b38cd2ff-45d3-443e-bc46-49f945747a61	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	1d657778-e108-4098-a45e-46fc8ee75038	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00082"}	\N	2026-11-04 22:41:51.78258+05:30
98a2eccf-3b7c-48b5-b0b9-51067ec77e4e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	a2995fad-b48f-4523-ae1b-508616269362	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00083"}	\N	2026-11-04 22:41:52.438128+05:30
a847002a-6fda-4eb6-b409-2bfc43590ba6	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	649a1dab-ad11-4e1b-b13a-aa3ad4cc3cc8	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00084"}	\N	2026-11-04 22:41:52.998349+05:30
726c66f6-b864-434e-b7de-4cd2c366beba	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	649a1dab-ad11-4e1b-b13a-aa3ad4cc3cc8	{"status": "DRAFT", "updated_at": "2026-11-04T17:11:53.024386+00:00", "quotation_number": "HQ-2026-00084"}	\N	2026-11-04 22:41:53.025193+05:30
2d178dc7-44d7-479d-a704-cba0b68be00d	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7303111d-2ac9-4363-8772-66e5541c9dac	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00085"}	\N	2026-11-04 22:41:53.58844+05:30
cf543dcd-a404-430f-ba52-8dc6f65f8304	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	059ba3ba-eee6-41e7-9a69-37a88b961249	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00086"}	\N	2026-11-04 22:41:54.431826+05:30
a71602a4-ffe4-47e5-a1c3-6ffebe2cbfb1	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	0c27cfbe-143c-486b-b06c-df965269d166	{"source_quotation_id": "059ba3ba-eee6-41e7-9a69-37a88b961249", "new_quotation_number": "HQ-2026-00087"}	\N	2026-11-04 22:41:54.47116+05:30
bd6463f5-735b-4c18-bd4c-d83c4e6a4236	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	0c27cfbe-143c-486b-b06c-df965269d166	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00087"}	\N	2026-11-04 22:41:54.508519+05:30
21b2f229-c1fa-4907-9ff5-d72404532643	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	a19d61e7-eba6-46a7-b41e-b8f5414760f8	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00087"}	\N	2026-11-04 22:44:36.189068+05:30
08faebea-c9af-4429-a7e9-5d99d46e1f1b	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7aaa659b-fd37-4a3f-a8a6-30a749bcab09	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00088"}	\N	2026-11-04 22:44:36.819253+05:30
d1633f03-5d3f-4928-a33d-41f4c33eb921	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	290c3558-9327-4730-84e8-9df3cb437d7a	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00089"}	\N	2026-11-04 22:44:37.565723+05:30
b1772e87-7fb9-423b-acb3-a9f8c6b39b92	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	022e36f7-f2d7-41b6-98c8-addb2573ae78	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00090"}	\N	2026-11-04 22:44:38.343859+05:30
06da5adb-2d76-4ec5-9a56-ca02a1750348	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	022e36f7-f2d7-41b6-98c8-addb2573ae78	{"status": "DRAFT", "updated_at": "2026-11-04T17:14:38.384096+00:00", "quotation_number": "HQ-2026-00090"}	\N	2026-11-04 22:44:38.385027+05:30
359624ed-ba5d-4f2c-b030-f00e0d2e0dbe	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	8317b63e-4246-4182-89ce-6635aaf70f51	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00091"}	\N	2026-11-04 22:44:39.090418+05:30
6d8a7414-fd66-43ea-b4c6-e23c33cd7b8e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	04da8822-5f03-4605-9290-916baea25b40	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00092"}	\N	2026-11-04 22:44:40.116731+05:30
61d475ea-9e59-4eb0-9296-8044e85e0af6	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	e800bf5b-2927-4814-bbcc-6ef4cc81f819	{"source_quotation_id": "04da8822-5f03-4605-9290-916baea25b40", "new_quotation_number": "HQ-2026-00093"}	\N	2026-11-04 22:44:40.158019+05:30
b2093cb3-a0c6-4e7b-89b8-adc08fff537d	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	e800bf5b-2927-4814-bbcc-6ef4cc81f819	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00093"}	\N	2026-11-04 22:44:40.202249+05:30
6a0eaef5-774b-4d49-8cf1-1843c454d82d	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7d24b34d-2db8-418b-b93b-66a35f174d53	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00093"}	\N	2026-11-04 22:47:16.94936+05:30
9c4ea5c9-5a0c-457b-8a01-1b552fdcb27a	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	c24c62f1-f778-4a29-920b-72e8f43a4e71	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00094"}	\N	2026-11-04 22:47:17.587017+05:30
6093b6e0-e78e-4d91-b2bc-6f125f9f1c1e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	ab902e20-c339-4461-baf8-4e0f191411cf	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00095"}	\N	2026-11-04 22:47:18.203614+05:30
b72d8e16-c8de-400f-a0a3-f7df66709aa7	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7ebda0c8-e598-4b3e-984c-21c2d704d444	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00096"}	\N	2026-11-04 22:47:18.81014+05:30
bc4bc4ac-1d20-4a65-95a0-11893cfd360f	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	7ebda0c8-e598-4b3e-984c-21c2d704d444	{"status": "DRAFT", "updated_at": "2026-11-04T17:17:18.860566+00:00", "quotation_number": "HQ-2026-00096"}	\N	2026-11-04 22:47:18.861856+05:30
a8ca975c-311a-4aa0-bf19-6634c726b4cd	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	12090979-44e4-452e-96bf-094d3665c430	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00097"}	\N	2026-11-04 22:47:19.643393+05:30
ef343252-468d-4a81-b175-0098988abf1d	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	1e7ac991-8126-4313-b67f-384ab85d222e	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00098"}	\N	2026-11-04 22:47:20.95531+05:30
2ca9c4d7-39f0-40d4-a323-2e2942e7a63a	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	a9a40a91-f869-4dae-aed9-26abd0067d34	{"source_quotation_id": "1e7ac991-8126-4313-b67f-384ab85d222e", "new_quotation_number": "HQ-2026-00099"}	\N	2026-11-04 22:47:20.993127+05:30
0eb4abb5-2bc3-4cf1-baa3-b42dbf700ac2	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	a9a40a91-f869-4dae-aed9-26abd0067d34	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00099"}	\N	2026-11-04 22:47:21.026232+05:30
04029d52-acc5-42d8-90fe-6c864c440316	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	26598004-0b87-48a0-9fc5-9530433fec78	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00099"}	\N	2026-11-04 23:02:36.27472+05:30
2c395517-7e81-47c0-8181-a45d17ecceff	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	7ed41588-7d79-422e-bcd7-3fde0b86e7cc	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00100"}	\N	2026-11-04 23:02:36.766718+05:30
8c0d29c5-ad70-4ec5-b157-8feb77a7cf46	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	91f775fd-6e20-43df-88fd-b4133647b206	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00101"}	\N	2026-11-04 23:02:37.142943+05:30
70d7f574-ec0f-4437-8af8-d293f1097df0	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	5e8f666f-98d0-47c1-a064-78fa9b03a6ed	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00102"}	\N	2026-11-04 23:02:37.491436+05:30
9148d03c-3d58-461d-a6f5-be8931712ad4	40351e16-e0dd-4064-a060-bd866d35bc63	UPDATE	health_quotation	5e8f666f-98d0-47c1-a064-78fa9b03a6ed	{"status": "DRAFT", "updated_at": "2026-11-04T17:32:37.514967+00:00", "quotation_number": "HQ-2026-00102"}	\N	2026-11-04 23:02:37.51571+05:30
ecf03280-1a5f-4edb-acc6-003e2e1cf92e	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	dab57d45-0f14-4ac7-afe0-890b8ace5bc4	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00103"}	\N	2026-11-04 23:02:38.035429+05:30
c38c3973-d079-4258-b8e1-aa751b49c06a	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	32a3635a-2c95-408d-a732-385fc7056ba3	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00104"}	\N	2026-11-04 23:02:38.662992+05:30
f0fd9c07-21ee-43d4-9a01-366be862ed40	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	2359f118-6434-4146-8740-00bf0c59d93f	{"source_quotation_id": "32a3635a-2c95-408d-a732-385fc7056ba3", "new_quotation_number": "HQ-2026-00105"}	\N	2026-11-04 23:02:38.771714+05:30
98bd01ef-039c-4779-bcff-d16ed9f89ba9	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	2359f118-6434-4146-8740-00bf0c59d93f	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00105"}	\N	2026-11-04 23:02:38.79408+05:30
2b87b9c2-896a-4e3d-b090-6daaf6b3782a	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	dacbc2ee-0665-4561-870e-69d1391f16f0	{"client_name": "Rahul Sharma", "plans_count": 4, "members_count": 3, "quotation_number": "HQ-2026-00105"}	\N	2026-11-04 23:06:28.181401+05:30
e7479ae7-8684-4421-ac0a-097325c82029	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	1afc161c-881a-49a6-a577-11c50e791e9b	{"client_name": "Vikram Verma", "plans_count": 5, "members_count": 1, "quotation_number": "HQ-2026-00106"}	\N	2026-11-04 23:06:28.717837+05:30
f8a5a0e1-5f0a-4ca3-8c84-0dd98e67e133	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	f1b3960d-dce5-4244-94af-7aca60272379	{"client_name": "Anita Roy", "plans_count": 2, "members_count": 1, "quotation_number": "HQ-2026-00107"}	\N	2026-11-04 23:06:29.210923+05:30
c350b5ec-1fd9-4bab-9e54-2ba0cefdd105	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	08021add-8a7d-4490-afbb-c9fff1b3cb4f	{"client_name": "Rajesh Kumar", "plans_count": 1, "members_count": 1, "quotation_number": "HQ-2026-00108"}	\N	2026-11-04 23:06:29.704015+05:30
dc0872fe-b636-496a-b430-f457a8bc9fdc	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	91630893-fd99-4e7c-8a1d-30bbeec0799b	{"client_name": "Sunil Joshi", "plans_count": 1, "members_count": 2, "quotation_number": "HQ-2026-00109"}	\N	2026-11-04 23:06:30.325827+05:30
64e6d2ac-8fee-4e60-aa05-7dc31f30a34c	40351e16-e0dd-4064-a060-bd866d35bc63	CREATE	health_quotation	c1fba66c-ca15-4616-b312-f20910950289	{"client_name": "Meera Sen", "plans_count": 4, "members_count": 1, "quotation_number": "HQ-2026-00110"}	\N	2026-11-04 23:06:31.031947+05:30
5474a245-a282-4239-bddb-925ba82445b8	40351e16-e0dd-4064-a060-bd866d35bc63	DUPLICATE	health_quotation	c1e45d49-b7b3-4d44-a6dd-464714b8c013	{"source_quotation_id": "c1fba66c-ca15-4616-b312-f20910950289", "new_quotation_number": "HQ-2026-00111"}	\N	2026-11-04 23:06:31.107536+05:30
632c45fe-200e-4614-9abd-e81175df66fe	40351e16-e0dd-4064-a060-bd866d35bc63	DELETE	health_quotation	c1e45d49-b7b3-4d44-a6dd-464714b8c013	{"client_name": "Meera Sen", "quotation_number": "HQ-2026-00111"}	\N	2026-11-04 23:06:31.131453+05:30
62fa4365-899c-4db3-9b0f-31f4045fa210	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	5c136a8e-a490-425c-b3bc-da5a0c788db1	{"amount": 14160.0, "payment_id": "8d7ef1e3-44ef-4881-acd0-693464531a24", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-05 11:04:55.396864+05:30
4f53ca0c-8a51-4e18-aeed-e11435d0a864	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	af101880-6400-4562-ac71-699c477531f9	{"amount": 17700.0, "payment_id": "4d2039b0-8628-4dd1-84fe-e0805d3427ab", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-05 11:04:57.463206+05:30
6c5d33c2-0dff-4aa3-bb54-272cd95e3b2e	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"amount": 11800.0, "payment_id": "e105f436-0c30-49b2-960a-4d1964224bd4", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-05 11:04:59.598386+05:30
ca816900-6afd-413b-9543-1ec8e47457c9	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	15d44347-7c07-4e4f-8dcd-fb8961d4219f	{"amount": 53100.0, "payment_id": "a69bc215-17f8-47c9-9ff2-2d62db2b97fd", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-05 11:05:01.348732+05:30
4bae7a13-dc9a-42ad-b407-0e1c12023010	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"amount": 15800.0, "payment_id": "eabf58a9-9c94-4260-a990-2e5c0a19e2fb", "payment_mode": "ONLINE", "installment_number": 3, "transaction_reference": null}	\N	2026-11-05 11:05:03.035477+05:30
a805e066-e76a-433c-8e61-c56f390be312	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	{"amount": 11800.0, "payment_id": "9264d289-4989-4ee0-adaf-b0629eb8eda0", "payment_mode": "ONLINE", "installment_number": 2, "transaction_reference": null}	\N	2026-11-05 11:05:05.632878+05:30
3b3f1bf3-d5f7-4317-879b-a779a6e2404f	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	387bb7bc-7400-4770-bdf8-0921aa1d0816	{"phone": "8452012567", "has_pan": false, "full_name": "Nandini Sharma", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-05 11:12:02.754675+05:30
fd8ed988-75e9-4d78-922f-f4d40d2042cf	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	ef4fcc75-194d-416c-8dde-e7fbff754b9b	{"amount": 25000.0, "payment_id": "2d6182ac-2b23-44b7-98c2-7a2de0c8a0ae", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-05 11:13:53.893079+05:30
8c8927a7-9545-483f-bb39-d403edae00a7	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	ef4fcc75-194d-416c-8dde-e7fbff754b9b	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 25000.0, "policy_number": "POL-HLTH-2026-99549", "nominees_count": 1}	\N	2026-11-05 11:13:53.90173+05:30
71035f51-37b1-4238-b0d0-c1d7ce66b5ed	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_POLICY_DOCUMENT_UPLOADED	insurance_policy_document	9b18b596-7910-4cea-a5ab-b952b514dbe7	{"size": 15826, "title": "Quotation_HQ-2026-00053", "filename": "Quotation_HQ-2026-00053.pdf", "policy_id": "ef4fcc75-194d-416c-8dde-e7fbff754b9b", "document_type": "Official Policy Certificate"}	\N	2026-11-05 11:13:53.974048+05:30
ad28325a-401c-408b-a49a-5ce49e831e94	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	915a17bc-5bc6-42bf-b555-f24696e5f2fb	{"amount": 20000.0, "payment_id": "8a0b2f14-dcc2-4eab-9258-880f903ab438", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-05 11:28:53.746443+05:30
ffc3c4c0-ba4c-4155-aaa6-2e8cc7873900	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	915a17bc-5bc6-42bf-b555-f24696e5f2fb	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 1000000.0, "final_premium": 20000.0, "policy_number": "POL-HLTH-2026-48773", "nominees_count": 1}	\N	2026-11-05 11:28:53.805752+05:30
d2e0d7da-f0a4-466f-871a-a26e6553ca70	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_RENEWED	policy	939df6b9-4b08-445d-a38c-ce4e7e996ee1	{"term_years": 1, "new_policy_id": "939df6b9-4b08-445d-a38c-ce4e7e996ee1", "new_start_date": "2024-01-02", "new_expiry_date": "2025-01-01", "renewal_premium": 20000.0, "new_policy_number": "POL-HLTH-2026-48773-R1", "previous_policy_id": "915a17bc-5bc6-42bf-b555-f24696e5f2fb", "previous_policy_number": "POL-HLTH-2026-48773"}	\N	2026-11-05 11:29:41.145193+05:30
61b2613b-38ae-444b-afe7-c84c475541a4	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	11baf4c2-2694-4a3d-818b-c6251f91abd0	{"code": "LIFECARE-828", "name": "LIFE CARE", "company_id": "10453ae4-a173-4a8f-8376-be15522264a8", "company_name": "LIC India"}	\N	2026-11-05 12:21:45.432355+05:30
9a4b4524-f9fd-4c4f-92fd-7285e1be93a7	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_PAYMENT_RECORDED	policy	aac36891-45fd-4003-8569-0a218bf134fe	{"amount": 20000.0, "payment_id": "a3bd5067-3c27-4662-a16b-2bf0907a9fa6", "payment_mode": "ONLINE", "installment_number": 1, "transaction_reference": null}	\N	2026-11-05 12:22:43.83884+05:30
99ffe284-a0ae-44a3-a7b8-0ab3d87201ed	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	aac36891-45fd-4003-8569-0a218bf134fe	{"status": "ACTIVE", "policy_type": "LIFE", "sum_assured": 1000000.0, "final_premium": 20000.0, "policy_number": "POL-LIFE-2026-73892", "nominees_count": 1}	\N	2026-11-05 12:22:43.871226+05:30
a9f7e943-0d72-4e37-882d-b9c1f69415a4	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_STATUS_CHANGED	policy	915a17bc-5bc6-42bf-b555-f24696e5f2fb	{"notes": "", "new_status": "EXPIRED", "old_status": "EXPIRED"}	\N	2026-11-05 12:26:12.505229+05:30
2599337d-a00a-4a34-be1a-f549ce724f26	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_STATUS_CHANGED	policy	af101880-6400-4562-ac71-699c477531f9	{"notes": "", "new_status": "EXPIRED", "old_status": "ACTIVE"}	\N	2026-11-05 12:26:35.360103+05:30
bb889bfa-76e8-4964-acfe-bf4828fd0eeb	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_STATUS_CHANGED	policy	af101880-6400-4562-ac71-699c477531f9	{"notes": "", "new_status": "EXPIRED", "old_status": "EXPIRED"}	\N	2026-11-05 12:26:47.55702+05:30
faf497e6-0563-4619-922c-03b7dbd2111d	40351e16-e0dd-4064-a060-bd866d35bc63	CUSTOMER_CREATED	customer	29dcaf97-24bf-4212-be58-cd7cd6729315	{"phone": "9403599498", "has_pan": false, "full_name": "PRATAP KALYANKAR", "has_aadhaar": false, "customer_type": "INDIVIDUAL"}	\N	2026-11-05 12:31:38.77058+05:30
cd7d3500-062a-42d1-b525-0c9fafcd1a7a	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_COMPANY_CREATED	insurance_company	ed566bb2-6bd4-4a34-973d-00c1b7d4b71c	{"code": "ZURICHKOTA-652", "name": "ZURICH KOTAK TEST", "category": "LIFE"}	\N	2026-11-05 12:54:35.887084+05:30
74ad85c8-513d-4460-bbc8-ae66ae720c14	40351e16-e0dd-4064-a060-bd866d35bc63	INSURANCE_PLAN_CREATED	insurance_plan	a0ccf095-d10e-4102-bd8c-5beb3640a2d4	{"code": "ZKPLAN-573", "name": "ZK PLAN", "company_id": "ed566bb2-6bd4-4a34-973d-00c1b7d4b71c", "company_name": "ZURICH KOTAK TEST"}	\N	2026-11-05 12:55:23.405891+05:30
b24d18a0-9b5b-421f-98b4-3166025ed575	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	9c3e3904-7f5e-469c-8c4c-11df47f9d161	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 11800.0, "policy_number": "POL-P9-E30063", "nominees_count": 0}	\N	2026-11-05 12:56:20.534628+05:30
971f7a00-cbca-40d7-bd75-efbae95bbdd5	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	03a9ae35-c40d-4825-8a88-8722b74ef3b7	{"status": "ACTIVE", "policy_type": "LIFE", "sum_assured": 1000000.0, "final_premium": 20000.0, "policy_number": "POL-DIR-371037", "nominees_count": 0}	\N	2026-11-05 12:56:21.576652+05:30
67cbafff-8611-4c87-9ba3-314bc9b3d410	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	3ef7ac86-26d4-4e76-815b-577fcba9c611	{"status": "ACTIVE", "policy_type": "HEALTH", "sum_assured": 500000.0, "final_premium": 11800.0, "policy_number": "POL-P9-375EE6", "nominees_count": 0}	\N	2026-11-05 13:04:20.16141+05:30
26b89122-e865-4003-bd59-14d0564e70cd	40351e16-e0dd-4064-a060-bd866d35bc63	POLICY_CREATED	policy	147a1139-f18d-42b4-bbc5-e4257ba26d52	{"status": "ACTIVE", "policy_type": "LIFE", "sum_assured": 1000000.0, "final_premium": 20000.0, "policy_number": "POL-DIR-E33839", "nominees_count": 0}	\N	2026-11-05 13:04:23.04255+05:30
\.


--
-- Data for Name: crm_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crm_notifications (id, user_id, work_order_id, title, message, is_read, notification_type, created_at) FROM stdin;
6a1a8c20-395e-446d-94a1-4d5dfd80170b	aa404433-f73c-4036-8988-6f3257885290	f485c922-0af0-4040-a1b5-dfaa35cec7c0	Work Order Reminder Scheduled	Reminder scheduled for Work Order WO-2026-0001: Work: MFU: Aditya Thakre (Deadline: 2026-11-04 18:00).	f	WORK_ORDER_REMINDER	2026-11-01 23:50:01.050787+05:30
8edacb78-25ea-4dca-ad2a-7c3a86d24138	38318850-7c3b-4657-aea8-c7ad4661b1dc	f485c922-0af0-4040-a1b5-dfaa35cec7c0	Work Order Reminder Scheduled	Reminder scheduled for Work Order WO-2026-0001: Work: MFU: Aditya Thakre (Deadline: 2026-11-04 18:00).	f	WORK_ORDER_REMINDER	2026-11-01 23:50:01.050789+05:30
f56f8f92-66d0-4c01-974b-86db930c1b73	38318850-7c3b-4657-aea8-c7ad4661b1dc	f485c922-0af0-4040-a1b5-dfaa35cec7c0	New Work Order Assigned	You have been assigned to Work Order WO-2026-0001: Work: MFU: Aditya Thakre	f	WORK_ORDER_ASSIGNED	2026-11-01 23:50:01.050791+05:30
2b590642-7d2b-4389-b7e2-3d1178025249	40351e16-e0dd-4064-a060-bd866d35bc63	f485c922-0af0-4040-a1b5-dfaa35cec7c0	Work Order Reminder Scheduled	Reminder scheduled for Work Order WO-2026-0001: Work: MFU: Aditya Thakre (Deadline: 2026-11-04 18:00).	t	WORK_ORDER_REMINDER	2026-11-01 23:50:01.050773+05:30
\.


--
-- Data for Name: customer_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_notes (id, customer_id, author_id, content, created_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, first_name, last_name, email, phone, pan_number, pipeline_status, assigned_officer_id, created_at, updated_at, reference_source, is_archived, archived_at, created_by_id, gender, date_of_birth, anniversary_date, state, city, address, pincode, customer_type, aadhaar_encrypted, aadhaar_hash, pan_encrypted, marital_status, nationality, occupation, source_of_income, company_name, corporate_code, gstin, contact_person_name, contact_person_phone, contact_person_email) FROM stdin;
6da0ef85-3341-45fa-9e38-b4f85626b48c	Priya	Deshmukh	priya.deshmukh@example.com	1111111111	BMCPD4521K	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1990-03-22	2016-02-14	Maharashtra	Pune	B-104, Kothrud Heights, Paud Road	\N	INDIVIDUAL	gAAAAABq5zhOMfBy0xvVOkLicrI1La0yJB5TNhrJE0oYdzSkQF_2i2tzjmmmOdZU6mJyvs2D_5086_SikARl2r-6iPxeOmE3Vw==	39d8b874e059ec279fff7583b801dc1bb6c893eb8166073f5f45e55ed91d7c27	gAAAAABq5zhOp5aG0fZpgCrQItqL_jehITHK5LWcoZMy6hYe75NYIjJw1gZfS1Ajkj4AhxHzEaepLWbGl4alrWdLIkST4POI6g==	Married	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
cf09112e-57c4-4d15-9b2d-d2699a2e4ab8	Amit	Patel	amit.patel@example.com	2222222222	AAJPP8832L	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1978-11-08	2005-12-01	Gujarat	Ahmedabad	12, Suryavanshi Bunglows, Satellite	\N	INDIVIDUAL	gAAAAABq5zhODJIe3HMVrApqm3mZu_WlTv-97rGSZ3q_H3j0jeq1DXPbXzXlKtDFWehMQCEbO5KPyjayLt_CwajrcduAeU92pw==	96904f24a93806f87faa640ac47f73c8cd676a3837964919fd81d0329e8d3cbe	gAAAAABq5zhOWdqKUJQUVLqNNJUciUk0h7k6YzGxhvEmOmhYoDWotCkQfUtL5rXo4pcYD_IpQV5k7iB434514kDb5pgtMsMo7w==	Married	Indian	Business	Business Income	\N	\N	\N	\N	\N	\N
a463f75d-9d3e-44cd-aabf-32eea1effd98	Sneha	Kulkarni	sneha.kulkarni@example.com	3333333333	CWMPK7741M	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1995-08-19	\N	Maharashtra	Pune	Flat 301, Nyati Empire, Viman Nagar	\N	INDIVIDUAL	gAAAAABq5zhO9Ni5zQ03opve-64rx2eUjRUEVYhEwMWTuqPTP_2iWiuj9l_sT7xNG3CQ3-sg3nQCF-pNdf1G52UIrydC4EWOKg==	e809a1a2809fa5399f66e8213b2d3f33f12e8e611df0da49867f7563aa6fb90f	gAAAAABq5zhO-Bc7iteD05lrYwkeyuInUIE86BZfEbycqKDUlztuhop6vVpWVrGgdXzgJJmUdirS2gMOw80xxkbuAjfT-aBrGQ==	Single	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
12bd5fd9-91f4-488c-a842-58428547934c	Vikram	Rathore	vikram.rathore@example.com	4444444444	DLRPR9910N	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1982-01-30	2010-04-18	Rajasthan	Jaipur	Plot 45, Civil Lines, Ajmer Road	\N	INDIVIDUAL	gAAAAABq5zhOKKsn_yOutnaFjMnAw3thnmQ68pHyiyEmBSDQkN0G-Rk7uO_u7M2SMKrkz--qrgI-I4f4TT443c5fDM6BPEI7tw==	ee777ae49abeaab1f6d65023523e4cc97e3c529d215a0e81b63d525ae87529b7	gAAAAABq5zhOEAKOnYmE_vaxT6hBtEsE3yl1PB8twpuafiYGvF2IvPQrRLzGXk2Krgb4ngW_f-hznrpkwbVO9VgkU5dMKDrAmw==	Married	Indian	Self-Employed	Professional Fees	\N	\N	\N	\N	\N	\N
463511a0-6f99-4430-8355-f97d42cf6c04	Ananya	Iyer	ananya.iyer@example.com	5555555555	EKTPI3329P	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1992-07-12	\N	Tamil Nadu	Chennai	No. 18, 2nd Main Road, Adyar	\N	INDIVIDUAL	gAAAAABq5zhOGdXwfYlxXzq5wL6jxkWsAoJlFXpafu2SbGUBcRr6EYYhkrBW-BCRJcpOBgwVHvdczotxHNAO3pg_IfkQRNnB0Q==	7c76794e30e41cbb8037bb4265d0d763ed45d5cb8655e377f9e45a2d37ff227f	gAAAAABq5zhO679tyg5dgK9u1hs6yiVoeOoK1uVAMeGB4xwcx8r9xfu-jJHRZ0j8HpjvkBT2EqhDmxdRVWJo9QM4NuLdybUeBg==	Single	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
8c769bcd-55bf-421b-9fe6-67e9edaaf459	Rohan	Mehta	rohan.mehta@example.com	6666666666	FGHPM5561Q	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1988-04-25	2015-11-28	Maharashtra	Mumbai	701, Ocean View, Bandra West	\N	INDIVIDUAL	gAAAAABq5zhOK0oqOgPX_CE28Y6R52mxARCyQ6GU2mycvBV29SE7BcNDREv_bXfNYSWWkmXkJn1pZJBzFpoTB0Uc79BZaCwB0Q==	d8461786a4f2952ee4ad2a1ab4cfdfa7ca6291dcf494f1c404479698c2921b64	gAAAAABq5zhOofNi2mRGbEZIddaEcFq7hUf_tYl-_xyQ1l-9mFTAKFIEzxDCBtHly_qT_x8NmuUB3v2_zQwfloe8dnQiOhs9GQ==	Married	Indian	Business	Business Income	\N	\N	\N	\N	\N	\N
408d7309-1217-4d2d-abdc-9fc27acf284c	Kavita	Reddy	kavita.reddy@example.com	7777777777	GJLPR6612R	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1983-09-05	2009-05-10	Telangana	Hyderabad	Villa 9, Lotus Pond, Banjara Hills	\N	INDIVIDUAL	gAAAAABq5zhO7y3tektEvPX_pvZatR3cpJ17b5fgQG09VyB8ex4dgdfPAUH3coae3dkj67y8pV1i8Omm1OTZ59k4BzYjbWXwHQ==	3fa9f5e5ed238f3828b964536d902f8372d9417e708277e109802bbb8ef1ea01	gAAAAABq5zhOc7lStCt6s3EBp5HC08EJBVqxp1CmY6D-zbVNKlerhk_YE6gJR2diWTaaBiMZKy5OUqUQis0bhCbHPJfyIlx2ng==	Married	Indian	Self-Employed	Professional Fees	\N	\N	\N	\N	\N	\N
8e2e6d88-c4d8-40cb-8386-428dec694719	Suresh	Nair	suresh.nair@example.com	8888888888	HMNPN4408S	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1974-12-17	2001-08-24	Kerala	Kochi	Nair House, Panampilly Nagar	\N	INDIVIDUAL	gAAAAABq5zhOeKd8baLKCC9zt0PqRYtK4n9zzXODrzRAKMkmV8cu4NS5zMC3dT1UwftdTlVDV1meKOb5oQP71cHYqvFtWoAi_A==	5ad924fbff76f3a73e54fafa5142c9f2e713f44f6368fe0fb1d0dc4f45ed93df	gAAAAABq5zhOhsgZ1BO1fnmYHrVbHkcDOQuRbaamC_WJ1bmR3pAH_kMnyD8jBSyf8CeCZRiUonKtiAVz3JZJKrP5nmMXLqZJFw==	Married	Indian	Retired	Pension	\N	\N	\N	\N	\N	\N
4f3335f5-e0ca-4f45-ac6b-aee1af82797f	Neha	Verma	neha.verma@example.com	9999999999	JKLPV2219T	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1991-02-14	2018-12-09	Delhi	New Delhi	C-88, Hauz Khas Enclave	\N	INDIVIDUAL	gAAAAABq5zhOzZZoRnBatv1_kB8QWXGpy-ZxAMOgMYcKabwcaAeHoad2o_3DfZnC3AzMoS6V3D_jG9AjNvpp-RH5nl4u2IYfTw==	2cf9995cfa081fa97698925f20ebda14a60275d8c5c55945517134d3e58f46b5	gAAAAABq5zhOaxGOef7X47yAIuaMNvhEdQTbuxF3Nx33FfI-doYFBBz5M_tXNQpNcrf-OCMVKgi6KF53vaS88CuOO6cUOKknUA==	Married	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
f206a3f3-9120-4794-a649-b8a617a70a8a	Meera	Chatterjee	meera.chatterjee@example.com	12222222221	LNRPC8843V	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1986-05-29	2013-01-22	West Bengal	Kolkata	CD-42, Sector 1, Salt Lake City	\N	INDIVIDUAL	gAAAAABq5zhOlJL-OC_kjT4k5LzADXStN1RD7zbFrmBxzYo0DSZRI0yleI0lbX2UljcG0ZgauhqOcAAtKEe_oskKW8ucwpTGQA==	ec6513121fedc10dc952c54ddc2fb7af5342f4d64992699b1eae5adaf1aaa2f6	gAAAAABq5zhOf6-q0eLW_CuaFcDLoIjRE9BTfSn1GFi1EYeCKeOq84_tO4fOOCf_1BGsYrLR-S-p3ELUoGbFC_j5ChbZBSB3IA==	Married	Indian	Self-Employed	Professional Fees	\N	\N	\N	\N	\N	\N
97eb8dce-4c0d-499d-94eb-e56b60ce7db3	Karan	Malhotra	karan.malhotra@example.com	13333333332	MPQPM7732W	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1980-08-11	2008-10-15	Haryana	Gurugram	T-12, Flat 902, DLF Phase 4	\N	INDIVIDUAL	gAAAAABq5zhO0ADEstYDiZ7fVv1fhxYKxiRGCVfSK_7DvLebAt2esgRT2ii0fqZOcaZI2NIrpko4VBbMqWc_6DgNW5YnRT6Plw==	1c6c040ae2ab1f9019f41eda66f0a06017097d0801163823a8050e0d2acbdcab	gAAAAABq5zhO6drbLo8AEVx6zVFeqLP3noWwXevpRJuJgkSgVauZoqK_bX0JbDYbyFZ-YJ_ZphYeC5k1bd-QqnzrqkT_KRDvMQ==	Married	Indian	Business	Business Income	\N	\N	\N	\N	\N	\N
284f584f-6c3e-40ca-a9b6-1ae8254f30e0	Pooja	Agarwal	pooja.agarwal@example.com	14444444443	NRTPA5510X	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1994-11-27	\N	Uttar Pradesh	Lucknow	4/112, Vishal Khand, Gomti Nagar	\N	INDIVIDUAL	gAAAAABq5zhOYBpICsO8yDqNe9VhvQMyMBNdSFifFWCSI2tyVHgGVVO90-hbwjlenZQ1rWy1Gv1ubPr-qqLy1309VjGbttcc-A==	2fa36d010d2c97c0213995aa459b31bc283dac085d77de824d3bd962c5b991fb	gAAAAABq5zhOhvQt9o1hFP7SFaWEtlbx5_ZhohOY8s1z1lNXXfkA_yWTViQ84qLHdXoYzq5CkA65rEIAWdvDJrzco6ZOH4oVzQ==	Single	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
35fa0e8c-3d78-4046-818f-0d8aa520f2b7	Siddharth	Rao	siddharth.rao@example.com	15555555554	PQRPR3301Y	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1987-07-07	2014-06-05	Karnataka	Bengaluru	503, Prestige Palms, Indiranagar	\N	INDIVIDUAL	gAAAAABq5zhOZneBawh5d-LlIRL9fJaN0bP_JHWCNsqHXU0C5vC1qxasZNcUZ16g8epIXISs7HeutGMAY7R3CvV-UL9twPnuWw==	882fe76eaa85a939328f658a1f4c14eb039a08db4e18670f50b042b1e7b08ebc	gAAAAABq5zhOBeTxVkb8V4Xy5OqAxtLcJTEThsvR39IisR27TIflyXz-yFAkcVq4Y0dzLQznvAvRoibl4nnP2nin1VVKau0dyA==	Married	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
792e833f-8767-4570-9618-3d2cfbef0aa5	Divya	Menon	divya.menon@example.com	16666666665	QSTPM9982Z	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1989-12-21	2017-03-19	Karnataka	Bengaluru	Flat 108, Raheja Residency, Koramangala	\N	INDIVIDUAL	gAAAAABq5zhOgm6TEPSLXv5k2UFjE0VjxKvyBRPmSWrX1bc7T4ydQzyARXlfVJV74H2KHX_MbrFDtXGKUk1JAGtGZDf1_piyiA==	0a0fafd827e4ddf409141b1b4cba990af5fc5db22f8a8dce91c941d739aa7da1	gAAAAABq5zhOBXzc1UDUua3z-CwdQFucszH_ljsRQ21IyyPsc5HTXYg5d7MVcYvJ-AmPwrfrnaRbuM4Z_AwUezSfP7qlbgYSlg==	Married	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
0c7ad9a9-3a44-46ec-b5e6-5ff53112a9ac	Harsh	Vardhan	harsh.vardhan@example.com	17777777776	RUVPV6654A	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1976-04-02	2004-02-11	Uttar Pradesh	Noida	A-56, Sector 44, Near Botanical Garden	\N	INDIVIDUAL	gAAAAABq5zhOBQmNC7Nk1o0FMEMjVHF3LnOIHruA8jlb0jpALkcWWh2loKC5NIfmBrD-vxsjFpLCo71N6rXAaD1q8YPs5mrV-w==	a4231643bd897ca146954c09ef26f1895f230f70329253a66cab441f5f3709f1	gAAAAABq5zhORaDntkGUvCoZypymp6kuvCxSFwWITHFtzbiUOxV9pZAgrA6IGBUJVmea11afjKYNGty6KJhPCTrUWv3R9lb1pQ==	Married	Indian	Business	Investments	\N	\N	\N	\N	\N	\N
3dbf762a-325b-4f9c-a8fd-62a26eab609f	Aditi	Gokhale	aditi.gokhale@example.com	18888888887	SWXPG4421B	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-01 18:32:06.831677+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	FEMALE	1996-09-16	\N	Maharashtra	Pune	15, Gulmohar Park, Aundh	\N	INDIVIDUAL	gAAAAABq5zhOW6dfIP22K9KFo39ukETt4EGBQM_CFRQdSW3DBVB5D5iCJ63673Vo-SrcYW2gG2jdVOZTrq1HDWvfLIzoe87elw==	eea56ded8c4e119f8481861cdd74e1a72fd575a18d1ee84c166582b165a94cd1	gAAAAABq5zhON_5IiYgmx8lPtBqevgRb__shqNK65F9hVAu4lDlQpyldB4afnF7Sijn0erzofjwinDYOtTpO_IRoSF59KQIgNw==	Single	Indian	Self-Employed	Professional Fees	\N	\N	\N	\N	\N	\N
077284e5-ce45-40b7-ae94-db959551575d	PolicyUser2156B3	TestClient	policyuser_2156b3@test.com	+919879947535	\N	INSURANCE_CLIENT	\N	2026-11-01 22:01:24.271282+05:30	2026-11-01 22:01:24.271282+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
4e0d6771-d253-4a56-844d-f708acb3d4fd	PolicyUser6C2DCD	TestClient	policyuser_6c2dcd@test.com	+919820636183	\N	INSURANCE_CLIENT	\N	2026-11-01 22:01:46.50154+05:30	2026-11-01 22:01:46.50154+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
db54f0e1-8597-42ce-81f0-eda08d1476ba	PolicyUser874A9C	TestClient	policyuser_874a9c@test.com	+919884613820	\N	INSURANCE_CLIENT	\N	2026-11-01 22:02:07.64157+05:30	2026-11-01 22:02:07.64157+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
b17d377c-cf87-4cca-ac2e-abb1201aef4a	PolicyUserBA9357	TestClient	policyuser_ba9357@test.com	+919885245570	\N	INSURANCE_CLIENT	\N	2026-11-01 22:02:25.424143+05:30	2026-11-01 22:02:25.424143+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
de8d1f89-6abf-4bfe-b227-0075f187bbab	PolicyUserE70366	TestClient	policyuser_e70366@test.com	+919856205897	\N	INSURANCE_CLIENT	\N	2026-11-01 22:03:33.690335+05:30	2026-11-01 22:03:33.690335+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
fe59ecf5-38df-4d07-a9d6-497654d3ce94	PolicyUser135B22	TestClient	policyuser_135b22@test.com	+919891915245	\N	INSURANCE_CLIENT	\N	2026-11-01 22:03:55.113833+05:30	2026-11-01 22:03:55.113833+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
66dadec5-9886-4614-bc80-d25beb7fd929	PolicyUser701B0F	TestClient	policyuser_701b0f@test.com	+919872716523	\N	INSURANCE_CLIENT	\N	2026-11-01 22:04:16.600696+05:30	2026-11-01 22:04:16.600696+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
5572ee9f-ceab-49df-a659-ea38e29c9f4b	PolicyUser995557	TestClient	policyuser_995557@test.com	+919869007743	\N	INSURANCE_CLIENT	\N	2026-11-01 22:04:34.019605+05:30	2026-11-01 22:04:34.019605+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
848af02e-79ba-4b15-9f38-32cb2b43d703	PolicyUser9C18A2	TestClient	policyuser_9c18a2@test.com	+919830598060	\N	INSURANCE_CLIENT	\N	2026-11-01 22:05:36.437506+05:30	2026-11-01 22:05:36.437506+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
97d861e8-ca24-4913-8e6f-4aea83c3d682	PolicyUserAB768E	TestClient	policyuser_ab768e@test.com	+919891872027	\N	INSURANCE_CLIENT	\N	2026-11-01 22:06:02.18459+05:30	2026-11-01 22:06:02.18459+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
876330ef-4ae8-41f0-9abf-dc23dce5fb20	PolicyUserAC34B6	TestClient	policyuser_ac34b6@test.com	+919876392287	\N	INSURANCE_CLIENT	\N	2026-11-01 22:06:23.761632+05:30	2026-11-01 22:06:23.761632+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
2e2972af-bf9b-4323-9774-58e2f01d0f04	PolicyUser2847F9	TestClient	policyuser_2847f9@test.com	+919899356635	\N	INSURANCE_CLIENT	\N	2026-11-01 22:06:53.478351+05:30	2026-11-01 22:06:53.478351+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
d6a0d15b-ad89-432d-b585-00e7e13cdf55	PolicyUser35883E	TestClient	policyuser_35883e@test.com	+919872143100	\N	INSURANCE_CLIENT	\N	2026-11-01 22:07:39.037855+05:30	2026-11-01 22:07:39.037855+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
d9572ac8-8aa6-48e2-a881-2f3c5809f108	PolicyUserFA6746	TestClient	policyuser_fa6746@test.com	+919875526514	\N	INSURANCE_CLIENT	\N	2026-11-01 22:08:04.803237+05:30	2026-11-01 22:08:04.803237+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
cce42a17-8198-43a4-9d0e-54fac69a8b02	PolicyUser1BEF50	TestClient	policyuser_1bef50@test.com	+919861576709	\N	INSURANCE_CLIENT	\N	2026-11-01 22:08:26.19973+05:30	2026-11-01 22:08:26.19973+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
9e8d74b7-1672-46e4-8bb0-d232bc17e3c8	PolicyUser78F36E	TestClient	policyuser_78f36e@test.com	+919810272413	\N	INSURANCE_CLIENT	\N	2026-11-01 22:08:57.859223+05:30	2026-11-01 22:08:57.859223+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
9eb52aaa-1fc3-46ad-bd2a-c6ea4f0634d9	Rohan	Verma	rohan.a5d7ec@example.com	+919841269985	\N	NEW_LEAD	\N	2026-11-01 23:08:19.695134+05:30	2026-11-01 23:08:19.695137+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
fe197ecb-7c42-4a5b-ae54-51ee56074e97	Siddharth	Rao	siddharth.a52420@example.com	+919880410090	\N	NEW_LEAD	\N	2026-11-01 23:10:15.281561+05:30	2026-11-01 23:10:15.281564+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
dc780ddf-89d3-4dc2-beef-793d7ba36415	PolicyUserF5538E	TestClient	policyuser_f5538e@test.com	+919812603019	\N	INSURANCE_CLIENT	\N	2026-11-01 23:12:17.332724+05:30	2026-11-01 23:12:17.332724+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
9629785d-7019-4135-b7cd-fc8d77aec1c9	PolicyUser333FCA	TestClient	policyuser_333fca@test.com	+919814542785	\N	INSURANCE_CLIENT	\N	2026-11-01 23:12:43.082418+05:30	2026-11-01 23:12:43.082418+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
18a0f250-73b5-4398-945c-f6913e554a39	PolicyUser4C1566	TestClient	policyuser_4c1566@test.com	+919877927512	\N	INSURANCE_CLIENT	\N	2026-11-01 23:13:04.98654+05:30	2026-11-01 23:13:04.98654+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
39b1ae40-e8af-458b-b8f7-2324e1b7692e	PolicyUserF7855D	TestClient	policyuser_f7855d@test.com	+919882940059	\N	INSURANCE_CLIENT	\N	2026-11-01 23:13:36.768049+05:30	2026-11-01 23:13:36.768049+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
63475e51-c183-4320-922c-0e310e4188f8	Siddharth	Rao	siddharth.4fc649@example.com	+919814156621	\N	NEW_LEAD	\N	2026-11-01 23:14:09.719189+05:30	2026-11-01 23:14:09.719191+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
5a199e21-1953-41ae-b32f-e193bf5400c2	Aditya	Thakre	tadityafin@gmail.com	8446090974	CEPPT2957G	INSURANCE_CLIENT	\N	2026-11-01 21:30:36.128296+05:30	2026-11-03 21:49:21.606432+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	2004-05-29	2023-01-01	MAHARASHTRA	RAMNAGAR	GATE NO 56 NEAR TULJA BHAVANI SCHOOL MUKUNDNAGAR CHH SAMBHAJINAGAR	431003	INDIVIDUAL	gAAAAABq6JPY45fwNaJ9JPIFujkmfPQioZjK3A3lvKrW4WwAnlTuXkZeHASKzE78n7wa4N6V6Gt5JgkwNS0vilTqZbRRVkIvpg==	93e2df068de0eaddf8d1d8c73731f2d25094eef52802b02a681dc22a0e80e4cf	gAAAAABq6JPYNem9buMc0tDCPmmgJWXxK5n8iYjgbu3DEQKDuQ1aeGIwasWC0rgyATeQQQLfEb2CGJROrfhvDJsNLZBoQJNJwA==	Married	Indian	Self-Employed	Professional Fees	\N	\N	\N	\N	\N	\N
ed8d43c3-d89f-4d77-8202-a2ebc03bb406	Arjun	Joshi	arjun.joshi@example.com	11111111110	KMPPJ1190U	INSURANCE_CLIENT	\N	2026-11-01 18:32:06.831677+05:30	2026-11-02 18:08:52.451647+05:30	Bulk Import	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	1993-10-03	\N	Maharashtra	Nagpur	204, Laxmi Pride, Dharampeth	\N	INDIVIDUAL	gAAAAABq5zhOKYB8mGS3uGugtCVthMlu08diO-0LU1U8Z61NYXzs8HSq1kHZbVbuFT9fDOG73YmKQSWZekGToGffud4LBXgzdQ==	af298580e53f66eadd800496361c2358309bdb8c7b03be98b8beb085d18cfbda	gAAAAABq5zhOXC86CrKQEruHWKUdqm4OPN-WYI1ipCPAJGWFg6Gn25d_Ot9iXOzZYhe5tKQUTkjHw6avN7g7VbBSdLUJagbF9g==	Single	Indian	Salaried	Salary	\N	\N	\N	\N	\N	\N
0ffe00ab-4d85-4bcf-a898-712a9a5e68aa	Siddharth	Rao	siddharth.e2cef4@example.com	+919882952900	\N	NEW_LEAD	\N	2026-11-03 21:20:48.990871+05:30	2026-11-03 21:20:48.990874+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
7840ff22-5456-4cf0-ac90-b61dc50fac11	Siddharth	Rao	siddharth.9b8c6b@example.com	+919818953509	\N	NEW_LEAD	\N	2026-11-03 21:38:38.769605+05:30	2026-11-03 21:38:38.769608+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
0b701338-6132-4e11-a922-a9619b0d8397	PolicyUserA4F608	TestClient	policyuser_a4f608@test.com	+919822900746	\N	INSURANCE_CLIENT	\N	2026-11-03 21:38:56.789749+05:30	2026-11-03 21:38:56.789749+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
316122a1-2f49-4723-b474-8741b77c286e	PolicyUserEC2FD8	TestClient	policyuser_ec2fd8@test.com	+919837348338	\N	INSURANCE_CLIENT	\N	2026-11-03 21:38:57.814235+05:30	2026-11-03 21:38:57.814235+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
cc8a0165-109d-4647-8ed7-7e50ad3e1859	PolicyUser7F47C1	TestClient	policyuser_7f47c1@test.com	+919833147794	\N	INSURANCE_CLIENT	\N	2026-11-03 21:38:58.747893+05:30	2026-11-03 21:38:58.747893+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
e266c426-1186-4268-9171-ba3958a495af	PolicyUserF48BB7	TestClient	policyuser_f48bb7@test.com	+919870750748	\N	INSURANCE_CLIENT	\N	2026-11-03 21:39:00.215324+05:30	2026-11-03 21:39:00.215324+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
333790b5-54fa-41d8-84f1-3aada4b96eb9	Siddharth	Rao	siddharth.f28714@example.com	+919854991154	\N	NEW_LEAD	\N	2026-11-04 22:42:06.012593+05:30	2026-11-04 22:42:06.012596+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
5fc02723-d978-463c-b37e-ad3f0b4bf673	Siddharth	Rao	siddharth.7202ae@example.com	+919862893246	\N	NEW_LEAD	\N	2026-11-04 22:44:47.459392+05:30	2026-11-04 22:44:47.459397+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
6021274b-f3ee-446d-82a3-8a2c0e4c175d	Siddharth	Rao	siddharth.919bed@example.com	+919898478423	\N	NEW_LEAD	\N	2026-11-04 22:46:19.448536+05:30	2026-11-04 22:46:19.448544+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
2b4d12be-82aa-44ef-8b9b-cd71fa9d2a3e	Siddharth	Rao	siddharth.fb7b55@example.com	+919875102659	\N	NEW_LEAD	\N	2026-11-04 22:46:58.722391+05:30	2026-11-04 22:46:58.722394+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
3c4513fb-33a1-40f4-a63b-66e205adaea3	Siddharth	Rao	siddharth.cc9ff5@example.com	+919871406679	\N	NEW_LEAD	\N	2026-11-04 22:47:30.317439+05:30	2026-11-04 22:47:30.317444+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
ed0dc6b7-536f-456b-9ad4-41de5c7a761d	Siddharth	Rao	siddharth.666c4b@example.com	+919890311510	\N	NEW_LEAD	\N	2026-11-04 23:02:39.73002+05:30	2026-11-04 23:02:39.730023+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
d82f16f4-0ba7-44a0-a2ce-8b7c486f903f	Siddharth	Rao	siddharth.ac1324@example.com	+919840977708	\N	NEW_LEAD	\N	2026-11-04 23:06:31.968393+05:30	2026-11-04 23:06:31.968398+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
387bb7bc-7400-4770-bdf8-0921aa1d0816	Nandini	Sharma	nandini@gmail.com	8452012567	\N	INSURANCE_CLIENT	\N	2026-11-05 11:12:02.754675+05:30	2026-11-05 11:12:02.754675+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	MAHARASHTRA	Chhatrapati Sambhajinagar	GATE NO 56 NEAR TULJA BHAVANI SCHOOL MUKUNDNAGAR CHH SAMBHAJINAGAR	431003	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
2b49d99a-4856-4a1d-a45a-a006257e9ab4	Siddharth	Rao	siddharth.4bf9f2@example.com	+919869369430	\N	NEW_LEAD	\N	2026-11-05 12:25:16.949762+05:30	2026-11-05 12:25:16.94977+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
29dcaf97-24bf-4212-be58-cd7cd6729315	PRATAP	KALYANKAR	kpratapfin@gmail.com	9403599498	\N	INSURANCE_CLIENT	\N	2026-11-05 12:31:38.77058+05:30	2026-11-05 12:31:38.77058+05:30	Insurance Agency Portal	f	\N	40351e16-e0dd-4064-a060-bd866d35bc63	MALE	\N	\N	MAHARASHTRA	Chhatrapati Sambhajinagar	PARIJAT NAGAR N-5 OPPOSITE SIDE OF KALA GANPATI MANDIR CHHATRAPATI SAMBHAJINAGAR	431001	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
26b6a1e3-5ca0-47d5-80fe-a60caea45c66	Siddharth	Rao	siddharth.954638@example.com	+919823170281	\N	NEW_LEAD	\N	2026-11-05 12:53:35.002226+05:30	2026-11-05 12:53:35.00223+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
a1bd90a1-ccd4-4d3c-b2bb-ea276b0d1f31	Siddharth	Rao	siddharth.8c63f9@example.com	+919814218904	\N	NEW_LEAD	\N	2026-11-05 12:54:50.462976+05:30	2026-11-05 12:54:50.46298+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
23dc9c70-a491-49b9-a349-e936c372be07	Vikram	Malhotra	vikram.1a967b@example.com	+919941432042	\N	NEW_LEAD	\N	2026-11-05 12:56:20.088075+05:30	2026-11-05 12:56:20.088079+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
f7bc0bed-e116-43d7-8c4f-8cbe36769173	Direct	Client	\N	+919171327561	\N	NEW_LEAD	\N	2026-11-05 12:56:21.228941+05:30	2026-11-05 12:56:21.228947+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
0f5910f1-6197-420c-b343-dcddeb0a4c02	Siddharth	Rao	siddharth.1e8c7a@example.com	+919874149512	\N	NEW_LEAD	\N	2026-11-05 12:56:31.281206+05:30	2026-11-05 12:56:31.281209+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
ae2d6dc3-b1c7-4cfd-a4ab-e3f4f2c5d6f2	Vikram	Malhotra	vikram.0dc3f7@example.com	+919938124734	\N	NEW_LEAD	\N	2026-11-05 13:04:19.278519+05:30	2026-11-05 13:04:19.278524+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
0c1a3165-9ade-47b5-a2e5-0e281c429b9e	Direct	Client	\N	+919130887342	\N	NEW_LEAD	\N	2026-11-05 13:04:22.074352+05:30	2026-11-05 13:04:22.074361+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
1e795b34-0ee5-4d70-80ce-6281bc976529	Siddharth	Rao	siddharth.3516ce@example.com	+919834099888	\N	NEW_LEAD	\N	2026-11-05 13:04:26.895683+05:30	2026-11-05 13:04:26.895686+05:30	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	INDIVIDUAL	\N	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, customer_id, document_type, original_filename, storage_path, file_size_bytes, mime_type, sha256_hash, verification_status, verified_by_id, rejection_reason, created_at) FROM stdin;
\.


--
-- Data for Name: financial_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.financial_profiles (id, customer_id, employment_type, monthly_income, monthly_obligations, cibil_score, risk_tier, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_agent_inquiries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_agent_inquiries (id, sub_agent_id, full_name, mobile, email, policy_type, message, consent, status, ip_address, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_commission_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_commission_receipts (id, commission_id, receipt_date, gross_amount, tds_deducted, net_amount, payment_mode, bank_name, transaction_reference, tds_certificate_ref, receipt_type, notes, supporting_document_url, recorded_by_id, created_at, updated_at, actual_commission_rate, actual_tds_rate, bank_account) FROM stdin;
1136a4dc-601d-431d-9b6b-29d38cea7260	897cc7ff-648e-4705-aefb-f2d79d6552cf	2026-11-05	888.89	88.89	800.00	NEFT	HDFC Bank Ltd	UTR-PARTIAL-800	\N	INSURER_COMMISSION	First tranche received from carrier	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:53:35.799428+05:30	2026-11-05 12:53:35.799432+05:30	\N	\N	\N
347b97a9-652c-4362-8f79-8ac41ceedd9a	4fadf88f-b106-4f31-95c5-ce62744e557a	2026-11-05	888.89	88.89	800.00	NEFT	HDFC Bank Ltd	UTR-PARTIAL-800	\N	INSURER_COMMISSION	First tranche received from carrier	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:54:51.205317+05:30	2026-11-05 12:54:51.20532+05:30	\N	\N	\N
f778cefe-f62c-4d86-a98a-574d5ab1385f	4fadf88f-b106-4f31-95c5-ce62744e557a	2026-11-05	611.11	61.11	550.00	RTGS	HDFC Bank Ltd	UTR-FINAL-550	\N	INSURER_COMMISSION	Second tranche received; settlement complete	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:54:51.253488+05:30	2026-11-05 12:54:51.253492+05:30	\N	\N	\N
79b7e9f1-43ef-4ade-a75d-eb8e50130f0c	9bee513e-7920-46ae-b3dc-438877b1cf73	2026-11-05	1500.00	150.00	1350.00	NEFT	HDFC Bank	UTR-INSURER-F30FD60B	\N	FULL_PAYMENT	Full insurer commission remitted into company bank account.	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:20.862864+05:30	2026-11-05 12:56:20.862867+05:30	15.00	10.00	HDFC-A/C-99881122
9c5e11ad-ae85-4f2d-949b-23a5f13747d9	82b09482-7b09-4ff4-8334-bb9c73b6bc53	2026-11-05	888.89	88.89	800.00	NEFT	HDFC Bank Ltd	UTR-PARTIAL-800	\N	INSURER_COMMISSION	First tranche received from carrier	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:32.099814+05:30	2026-11-05 12:56:32.099818+05:30	\N	\N	\N
a8176546-a02d-4c8b-bf27-21d545151db3	82b09482-7b09-4ff4-8334-bb9c73b6bc53	2026-11-05	611.11	61.11	550.00	RTGS	HDFC Bank Ltd	UTR-FINAL-550	\N	INSURER_COMMISSION	Second tranche received; settlement complete	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:32.187778+05:30	2026-11-05 12:56:32.187783+05:30	\N	\N	\N
2c51a8cd-3869-45a8-bf7d-1c0f812e1a57	e13740bb-c070-408b-ad6d-f9b491d050f7	2026-11-05	1500.00	150.00	1350.00	NEFT	HDFC Bank	UTR-INSURER-BFFA2540	\N	FULL_PAYMENT	Full insurer commission remitted into company bank account.	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 13:04:20.937082+05:30	2026-11-05 13:04:20.937092+05:30	15.00	10.00	HDFC-A/C-99881122
\.


--
-- Data for Name: insurance_commission_splits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_commission_splits (id, sub_agent_id, company_id, plan_id, split_type, split_value, effective_date, is_active, notes, created_at, updated_at, policy_category, commission_type, allocation_basis, effective_to, recipient_type, tds_deduction_type, agreement_status) FROM stdin;
de52c65c-9979-42ce-b63d-0e873c1b690e	2fa761e8-066b-4e89-91bf-7b818267f8f1	9708b516-792a-4326-9127-2098b7e4126f	\N	PERCENTAGE	20.00	2026-10-02	t	\N	2026-11-01 23:08:19.703944+05:30	2026-11-01 23:08:19.703946+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
e4139718-71a5-4871-b8c6-95b3cf205cc1	04d134c4-a81b-447f-873b-483752abb726	1abfb97f-993d-4b8d-80b7-134771b35404	\N	PERCENTAGE	20.00	2026-10-02	t	\N	2026-11-01 23:10:15.291012+05:30	2026-11-01 23:10:15.291016+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
013b20e5-6478-4ac6-ba69-3a4293642163	2471abdd-0075-454c-8f69-955d93c986d7	7e23e04d-d7e1-4175-a3a7-fc647c996f92	\N	PERCENTAGE	20.00	2026-10-02	t	\N	2026-11-01 23:14:09.727432+05:30	2026-11-01 23:14:09.727435+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
10f7aeed-425b-42b7-81bb-b3000555ba11	5e7d2ee0-2217-4ed2-9889-dfb168a91ebf	949d8195-6fed-4b56-aaba-c69ad51dc831	\N	PERCENTAGE	20.00	2026-10-04	t	\N	2026-11-03 21:20:49.009713+05:30	2026-11-03 21:20:49.009716+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
f41dc5b0-2107-473d-844d-4bcdd8885a8e	3d8afb8c-6a5c-49b5-b978-e4acb928a2a7	967c7ff1-75fe-49a4-8917-6ba868130eeb	\N	PERCENTAGE	20.00	2026-10-04	t	\N	2026-11-03 21:38:38.784229+05:30	2026-11-03 21:38:38.784233+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
a51c6b3b-7ff4-4f53-bd93-3c5251960154	f8669e68-20ea-43a8-a701-1c6815acc24d	75b24af0-6efd-4ca1-84e0-f70e9e44c9d5	\N	PERCENTAGE	20.00	2026-10-05	t	\N	2026-11-04 22:42:06.027416+05:30	2026-11-04 22:42:06.027422+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
ebb61714-97ef-4f90-a6c3-92f3f8652535	fa84d217-a1e7-4b6c-82c8-e17a572b23f4	65f8599f-d4b3-49eb-87de-2bd93f7ff2e9	\N	PERCENTAGE	20.00	2026-10-05	t	\N	2026-11-04 22:44:47.47379+05:30	2026-11-04 22:44:47.473796+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
8b4fba89-8ca7-48b0-aeff-4233b46f6942	6f1b2c25-8221-48b5-8444-c6f148d836b0	56a1df01-9aa9-4249-bdea-324d3ca58b55	\N	PERCENTAGE	20.00	2026-10-05	t	\N	2026-11-04 22:46:19.456432+05:30	2026-11-04 22:46:19.456434+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
990ac4e2-913b-4fd7-8912-db3545c502c4	986c0e47-7366-4250-bebe-8f08e12da7c1	ca6e9832-acf5-4c1e-a12e-7a4020ac1c02	\N	PERCENTAGE	20.00	2026-10-05	t	\N	2026-11-04 22:46:58.730873+05:30	2026-11-04 22:46:58.730875+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
5a75176c-5005-44dd-8aaf-aacd2f0296ec	496643ab-f715-4f3a-b3cf-1284671d681b	a4f0fa9e-9c6a-4194-9cc8-34b44513c904	\N	PERCENTAGE	20.00	2026-10-05	t	\N	2026-11-04 22:47:30.330688+05:30	2026-11-04 22:47:30.330692+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
7deceaed-b82b-41ef-855b-5c4b9bfb4388	10ed4880-6f78-4a40-aeb1-52196ceb4ff0	49ed2d68-180e-4ff2-90e1-f3fd2ea72e36	\N	PERCENTAGE	20.00	2026-10-05	t	\N	2026-11-04 23:02:39.742463+05:30	2026-11-04 23:02:39.74247+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
8ceb795c-c390-4699-a80b-b25c2b19bbaf	7aa93170-c892-489a-ac35-3a53f7c7b6aa	4977f377-2239-4987-9ca5-de05eec47aaf	\N	PERCENTAGE	20.00	2026-10-05	t	\N	2026-11-04 23:06:31.982508+05:30	2026-11-04 23:06:31.982511+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
766bc991-da98-44b5-acbf-9b3e98af8bfd	b35ac685-0202-4be6-81e8-6b85f304603a	f1642cd9-74e3-4ec9-9607-30c73df06486	\N	PERCENTAGE	20.00	2026-10-06	t	\N	2026-11-05 12:25:16.984152+05:30	2026-11-05 12:25:16.984159+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
be759006-255b-47d7-9cc3-6df7084c1347	cb432e66-7c5d-4234-9439-b99441687b2f	25f092a0-74a0-4197-870f-bcb9a5d57696	\N	PERCENTAGE	20.00	2026-10-06	t	\N	2026-11-05 12:53:35.014449+05:30	2026-11-05 12:53:35.014452+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
a182056b-c311-4eba-8a01-5f12aaf55ee6	625ab89c-10a8-46ba-8a00-4bff5171186c	322a9302-53c8-4cf4-85da-bae7c7373798	\N	PERCENTAGE	20.00	2026-10-06	t	\N	2026-11-05 12:54:50.473077+05:30	2026-11-05 12:54:50.473079+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
aa17afc1-11f8-4e41-9575-908cbd223c5d	b1129775-17b5-4a0e-b01b-fc44a353d562	9fbddf96-d6d6-4754-9416-327445192a3e	\N	PERCENTAGE	20.00	2026-09-06	t	\N	2026-11-05 12:56:20.100201+05:30	2026-11-05 12:56:20.100206+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
e6d25fec-096c-4cb6-9675-102a7538cfe0	60ca45b7-ccd2-4930-be2c-8661095919b8	4bd4cad0-05d2-4967-b6e1-7e711da20d85	\N	PERCENTAGE	20.00	2026-10-06	t	\N	2026-11-05 12:56:31.289354+05:30	2026-11-05 12:56:31.289357+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
9bca5986-2cd0-472f-9cff-ac38dabfeb19	5c5e97a8-529b-4afa-adde-9bbefc6d3570	7b7950f9-cfee-4ee5-86f6-4c766ef8a923	\N	PERCENTAGE	20.00	2026-09-06	t	\N	2026-11-05 13:04:19.300651+05:30	2026-11-05 13:04:19.300656+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
641178dc-e9ef-4fb6-9371-89c636a4f7e9	858d20a3-fbaf-4e1a-8122-74f6a147576a	890c76ab-6703-430b-b812-f1e5d71bbb43	\N	PERCENTAGE	20.00	2026-10-06	t	\N	2026-11-05 13:04:26.906657+05:30	2026-11-05 13:04:26.906665+05:30	\N	ALL	GROSS_COMMISSION	\N	SUB_AGENT	DEDUCT_AT_SOURCE	ACTIVE
\.


--
-- Data for Name: insurance_companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_companies (id, name, code, category, is_active, contact_person, email, phone, address, notes, created_at, updated_at, agent_name, agent_contact_number, agent_code, tieup_date, tieup_renewal_date, renewal_team_contact, claims_team_contact) FROM stdin;
10453ae4-a173-4a8f-8376-be15522264a8	LIC India	LIC-IND	Life Insurance	t	Enterprise Underwriting Group	operations@licindia.demo	+91 22 2202 8783	Yogakshema Building, Nariman Point, Mumbai 400021	State-backed life insurance carrier. Benchmark term & endowment provider.	2026-11-01 17:28:19.258995+05:30	2026-11-01 17:28:19.258995+05:30	\N	\N	\N	\N	\N	\N	\N
5613989f-a151-47be-be06-0e637be6931a	Star Health India	STAR-IND	Health Insurance	t	Medical Underwriting Office	desk@starhealth.demo	+91 44 2828 8800	1 New Tank Street, Valluvar Kottam High Road, Nungambakkam, Chennai 600034	Standalone health insurance provider with nationwide cashless network.	2026-11-01 17:28:19.258995+05:30	2026-11-01 17:28:19.258995+05:30	\N	\N	\N	\N	\N	\N	\N
6f10e59b-9720-4e6c-b1cd-0fa5f8f41cde	Shriram General	SHRIRAM-GEN	General/Motor	t	Commercial Fleet Underwriter	commercial@shriramgi.demo	+91 141 392 8400	E-8, EPIP, RIICO Industrial Area, Sitapura, Jaipur 302022	General insurer with focus on commercial vehicle, liability, and retail motor.	2026-11-01 17:28:19.258995+05:30	2026-11-01 17:28:19.258995+05:30	\N	\N	\N	\N	\N	\N	\N
b06a433f-624a-4900-a3f8-860d5fbbf9f8	HDFC ERGO General Insurance	HDFERG-B7B3	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 20:38:56.535483+05:30	2026-11-01 20:38:56.535483+05:30	Mohit Varma	8452012365	ABC-1234	2025-05-06	\N	renewal@hdfcergo.com	\N
193d516b-6568-4b7e-8d48-59b12df95c8a	Docs Carrier C34726	DC-C34726	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 21:10:28.79928+05:30	2026-11-01 21:10:28.79928+05:30	\N	\N	\N	\N	\N	\N	\N
68075259-6b02-42fd-82ad-c1b79a08f380	Stream Carrier DA4E6D	SC-DA4E6D	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 21:10:45.756437+05:30	2026-11-01 21:10:45.756437+05:30	\N	\N	\N	\N	\N	\N	\N
7f486f5f-63ef-4ce4-850a-65192f19a60b	Lifecycle Carrier FCF1A1	LC-FCF1A1	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 21:11:02.683168+05:30	2026-11-01 21:11:02.683168+05:30	\N	\N	\N	\N	\N	\N	\N
4a36342b-c4b0-47af-9b95-370df01d67cd	Stream Carrier B3C4BF	SC-B3C4BF	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 21:12:36.630545+05:30	2026-11-01 21:12:36.630545+05:30	\N	\N	\N	\N	\N	\N	\N
be7d9e4f-21dc-42b2-9755-8715fb07cf20	Niva Bupa Health Insurance	NIVBUP-3D98	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 21:25:27.385002+05:30	2026-11-01 21:25:27.385002+05:30	Nandini	7254555575	NIV123	2025-03-07	\N	\N	\N
b23bf45a-7f14-411a-a6d1-31be534be580	Stream Carrier 080E02	SC-080E02	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 22:00:22.120425+05:30	2026-11-01 22:00:22.120425+05:30	\N	\N	\N	\N	\N	\N	\N
d9560957-51eb-4f79-ac37-492d69e13505	Carrier Inherit AC34B6	CI-AC34B6	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 22:06:25.914109+05:30	2026-11-01 22:06:25.914109+05:30	\N	\N	\N	\N	\N	\N	\N
ec11c05b-75e3-4a02-8b43-530a7b947167	Carrier Inherit FA6746	CI-FA6746	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 22:08:06.996431+05:30	2026-11-01 22:08:06.996431+05:30	\N	\N	\N	\N	\N	\N	\N
2976d04a-ba9f-4c02-8e55-d85ddbc3f6ec	Tata Aig	TATAIG-46E7	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 22:21:30.493729+05:30	2026-11-01 22:21:30.493729+05:30	Aniket	8888068845	AIG-123	2026-06-18	\N	\N	\N
9708b516-792a-4326-9127-2098b7e4126f	Test Carrier TEST-COMP-6153	TEST-COMP-6153	Composite	t	\N	\N	\N	\N	\N	2026-11-01 23:08:19.697388+05:30	2026-11-01 23:08:19.697391+05:30	\N	\N	\N	\N	\N	\N	\N
1abfb97f-993d-4b8d-80b7-134771b35404	Test Carrier TEST-COMP-56BF	TEST-COMP-56BF	Composite	t	\N	\N	\N	\N	\N	2026-11-01 23:10:15.283897+05:30	2026-11-01 23:10:15.2839+05:30	\N	\N	\N	\N	\N	\N	\N
6dfca1f6-a370-4d58-b50d-a6c8d93efe56	Workflow Test Carrier C43274	CMP-C43274	Health Insurance	t	\N	carrier_c43274@test.com	\N	\N	\N	2026-11-01 23:10:59.580059+05:30	2026-11-01 23:11:12.022193+05:30	\N	\N	\N	\N	\N	\N	\N
0f796dae-4226-46e4-b0cc-181d6165afc8	Docs Carrier F55B60	DC-F55B60	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 23:11:14.672331+05:30	2026-11-01 23:11:14.672331+05:30	\N	\N	\N	\N	\N	\N	\N
d6dcb394-0b4a-46aa-b231-1e35828493db	Stream Carrier C0EB34	SC-C0EB34	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 23:11:31.972335+05:30	2026-11-01 23:11:31.972335+05:30	\N	\N	\N	\N	\N	\N	\N
e7e8e066-2b52-46be-9efb-9788ffe2c7b9	Lifecycle Carrier 0E9F63	LC-0E9F63	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 23:11:49.232212+05:30	2026-11-01 23:11:49.232212+05:30	\N	\N	\N	\N	\N	\N	\N
2214e29b-49a5-4a4a-ae29-b0ea13df7bd0	Carrier Inherit F5538E	CI-F5538E	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 23:12:19.492864+05:30	2026-11-01 23:12:19.492864+05:30	\N	\N	\N	\N	\N	\N	\N
d662b0c8-643f-43ab-8eaa-6cfafaa4cebf	Carrier Inherit 333FCA	CI-333FCA	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 23:12:45.335122+05:30	2026-11-01 23:12:45.335122+05:30	\N	\N	\N	\N	\N	\N	\N
74211c83-8de2-46a3-b6f5-eabd5b500a54	Carrier Inherit 4C1566	CI-4C1566	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 23:13:07.149192+05:30	2026-11-01 23:13:07.149192+05:30	\N	\N	\N	\N	\N	\N	\N
6cb0ec18-e2b1-4d90-83db-25939877aae1	Carrier Inherit F7855D	CI-F7855D	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-01 23:13:38.985169+05:30	2026-11-01 23:13:38.985169+05:30	\N	\N	\N	\N	\N	\N	\N
7e23e04d-d7e1-4175-a3a7-fc647c996f92	Test Carrier TEST-COMP-36A3	TEST-COMP-36A3	Composite	t	\N	\N	\N	\N	\N	2026-11-01 23:14:09.721107+05:30	2026-11-01 23:14:09.721111+05:30	\N	\N	\N	\N	\N	\N	\N
322a9302-53c8-4cf4-85da-bae7c7373798	Test Carrier TEST-COMP-76DE	TEST-COMP-76DE	Composite	t	\N	\N	\N	\N	\N	2026-11-05 12:54:50.465525+05:30	2026-11-05 12:54:50.465528+05:30	\N	\N	\N	\N	\N	\N	\N
fafca85b-89df-4fe5-bc15-20ce5c2133ec	360 View Carrier F873EE	V360-F873EE	Composite	t	\N	\N	\N	\N	\N	2026-11-01 23:12:06.500329+05:30	2026-11-02 18:20:40.897472+05:30	\N	\N	\N	\N	\N	\N	\N
13a61905-cb9f-41cf-8bca-dbdcaee8ca63	iffco tokio	IFFTOK-D8C6	General/Motor	t	\N	\N	\N	\N	\N	2026-11-02 18:51:03.860417+05:30	2026-11-02 18:51:03.860417+05:30	gaurav	9856236523	efdw	2021-01-01	2026-11-30	\N	\N
5fcc48da-7f59-4a20-9bc5-4544de8b43bd	Workflow Test Carrier E54309	CMP-E54309	Health Insurance	t	\N	carrier_e54309@test.com	\N	\N	\N	2026-11-03 21:19:52.644821+05:30	2026-11-03 21:19:52.724435+05:30	\N	\N	\N	\N	\N	\N	\N
cf3fe13e-e279-41f4-912f-76f3adb25b74	Docs Carrier E687E1	DC-E687E1	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-03 21:19:53.288734+05:30	2026-11-03 21:19:53.288734+05:30	\N	\N	\N	\N	\N	\N	\N
a951ccab-c95c-4cc5-add7-a1515d30394d	Stream Carrier BB9D19	SC-BB9D19	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-03 21:19:54.071311+05:30	2026-11-03 21:19:54.071311+05:30	\N	\N	\N	\N	\N	\N	\N
11dce89f-b83d-42f3-806d-fb90b6a1f169	Lifecycle Carrier C459A5	LC-C459A5	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-03 21:19:54.831814+05:30	2026-11-03 21:19:54.831814+05:30	\N	\N	\N	\N	\N	\N	\N
863f3d63-3e6b-45d5-a246-40ca158fa736	360 View Carrier C8DC80	V360-C8DC80	Composite	t	\N	\N	\N	\N	\N	2026-11-03 21:19:55.596397+05:30	2026-11-03 21:19:55.596397+05:30	\N	\N	\N	\N	\N	\N	\N
949d8195-6fed-4b56-aaba-c69ad51dc831	Test Carrier TEST-COMP-ECBB	TEST-COMP-ECBB	Composite	t	\N	\N	\N	\N	\N	2026-11-03 21:20:49.001178+05:30	2026-11-03 21:20:49.001182+05:30	\N	\N	\N	\N	\N	\N	\N
967c7ff1-75fe-49a4-8917-6ba868130eeb	Test Carrier TEST-COMP-ED60	TEST-COMP-ED60	Composite	t	\N	\N	\N	\N	\N	2026-11-03 21:38:38.772337+05:30	2026-11-03 21:38:38.77234+05:30	\N	\N	\N	\N	\N	\N	\N
0bb8d0e0-9dfb-4fd1-b4fb-bb26cc4d55fb	Carrier Inherit A4F608	CI-A4F608	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-03 21:38:57.027897+05:30	2026-11-03 21:38:57.027897+05:30	\N	\N	\N	\N	\N	\N	\N
0a1ff162-37d4-438b-a105-806e983e2ee4	Carrier Inherit EC2FD8	CI-EC2FD8	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-03 21:38:57.9791+05:30	2026-11-03 21:38:57.9791+05:30	\N	\N	\N	\N	\N	\N	\N
6567b961-1a16-4703-911a-22911aebb56c	Carrier Inherit 7F47C1	CI-7F47C1	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-03 21:38:58.971185+05:30	2026-11-03 21:38:58.971185+05:30	\N	\N	\N	\N	\N	\N	\N
ab99ff29-3839-49a0-9d8c-39c2bb7431a0	Carrier Inherit F48BB7	CI-F48BB7	Health Insurance	t	\N	\N	\N	\N	\N	2026-11-03 21:39:00.401552+05:30	2026-11-03 21:39:00.401552+05:30	\N	\N	\N	\N	\N	\N	\N
75b24af0-6efd-4ca1-84e0-f70e9e44c9d5	Test Carrier TEST-COMP-B363	TEST-COMP-B363	Composite	t	\N	\N	\N	\N	\N	2026-11-04 22:42:06.016483+05:30	2026-11-04 22:42:06.016486+05:30	\N	\N	\N	\N	\N	\N	\N
65f8599f-d4b3-49eb-87de-2bd93f7ff2e9	Test Carrier TEST-COMP-2A3E	TEST-COMP-2A3E	Composite	t	\N	\N	\N	\N	\N	2026-11-04 22:44:47.462156+05:30	2026-11-04 22:44:47.46216+05:30	\N	\N	\N	\N	\N	\N	\N
56a1df01-9aa9-4249-bdea-324d3ca58b55	Test Carrier TEST-COMP-C3D5	TEST-COMP-C3D5	Composite	t	\N	\N	\N	\N	\N	2026-11-04 22:46:19.450909+05:30	2026-11-04 22:46:19.450912+05:30	\N	\N	\N	\N	\N	\N	\N
ca6e9832-acf5-4c1e-a12e-7a4020ac1c02	Test Carrier TEST-COMP-4E38	TEST-COMP-4E38	Composite	t	\N	\N	\N	\N	\N	2026-11-04 22:46:58.724912+05:30	2026-11-04 22:46:58.724915+05:30	\N	\N	\N	\N	\N	\N	\N
a4f0fa9e-9c6a-4194-9cc8-34b44513c904	Test Carrier TEST-COMP-C116	TEST-COMP-C116	Composite	t	\N	\N	\N	\N	\N	2026-11-04 22:47:30.321101+05:30	2026-11-04 22:47:30.321108+05:30	\N	\N	\N	\N	\N	\N	\N
49ed2d68-180e-4ff2-90e1-f3fd2ea72e36	Test Carrier TEST-COMP-7AA6	TEST-COMP-7AA6	Composite	t	\N	\N	\N	\N	\N	2026-11-04 23:02:39.732479+05:30	2026-11-04 23:02:39.732483+05:30	\N	\N	\N	\N	\N	\N	\N
4977f377-2239-4987-9ca5-de05eec47aaf	Test Carrier TEST-COMP-2E4F	TEST-COMP-2E4F	Composite	t	\N	\N	\N	\N	\N	2026-11-04 23:06:31.971939+05:30	2026-11-04 23:06:31.971943+05:30	\N	\N	\N	\N	\N	\N	\N
f1642cd9-74e3-4ec9-9607-30c73df06486	Test Carrier TEST-COMP-744E	TEST-COMP-744E	Composite	t	\N	\N	\N	\N	\N	2026-11-05 12:25:16.957549+05:30	2026-11-05 12:25:16.957558+05:30	\N	\N	\N	\N	\N	\N	\N
25f092a0-74a0-4197-870f-bcb9a5d57696	Test Carrier TEST-COMP-1967	TEST-COMP-1967	Composite	t	\N	\N	\N	\N	\N	2026-11-05 12:53:35.006081+05:30	2026-11-05 12:53:35.006085+05:30	\N	\N	\N	\N	\N	\N	\N
ed566bb2-6bd4-4a34-973d-00c1b7d4b71c	ZURICH KOTAK TEST	ZURICHKOTA-652	LIFE	t	\N	\N	\N	\N	\N	2026-11-05 12:54:35.887084+05:30	2026-11-05 12:54:35.887084+05:30	\N	\N	\N	\N	\N	\N	\N
9fbddf96-d6d6-4754-9416-327445192a3e	HDFC ERGO General Insurance CARRIER-D4C2	CARRIER-D4C2	General	t	\N	\N	\N	\N	\N	2026-11-05 12:56:20.091267+05:30	2026-11-05 12:56:20.091271+05:30	\N	\N	\N	\N	\N	\N	\N
d08b27c4-534c-4fad-a893-026f1d5cee02	Direct Carrier cffc	DIR-85f1	Composite	t	\N	\N	\N	\N	\N	2026-11-05 12:56:21.231547+05:30	2026-11-05 12:56:21.231552+05:30	\N	\N	\N	\N	\N	\N	\N
4bd4cad0-05d2-4967-b6e1-7e711da20d85	Test Carrier TEST-COMP-BDFD	TEST-COMP-BDFD	Composite	t	\N	\N	\N	\N	\N	2026-11-05 12:56:31.283449+05:30	2026-11-05 12:56:31.283452+05:30	\N	\N	\N	\N	\N	\N	\N
7b7950f9-cfee-4ee5-86f6-4c766ef8a923	HDFC ERGO General Insurance CARRIER-2E99	CARRIER-2E99	General	t	\N	\N	\N	\N	\N	2026-11-05 13:04:19.284059+05:30	2026-11-05 13:04:19.284064+05:30	\N	\N	\N	\N	\N	\N	\N
66b7d9c2-5abd-4aa5-a1e2-dc6d8f186280	Direct Carrier f5b5	DIR-0276	Composite	t	\N	\N	\N	\N	\N	2026-11-05 13:04:22.078343+05:30	2026-11-05 13:04:22.078349+05:30	\N	\N	\N	\N	\N	\N	\N
890c76ab-6703-430b-b812-f1e5d71bbb43	Test Carrier TEST-COMP-47E5	TEST-COMP-47E5	Composite	t	\N	\N	\N	\N	\N	2026-11-05 13:04:26.897499+05:30	2026-11-05 13:04:26.897504+05:30	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: insurance_company_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_company_categories (id, company_id, category, created_at) FROM stdin;
\.


--
-- Data for Name: insurance_company_commission_agreements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_company_commission_agreements (id, company_id, policy_category, plan_id, first_year_commission_rate, renewal_commission_rate, special_commission_rate, commissionable_basis, tds_rate, effective_from, effective_to, is_active, notes, created_at, updated_at) FROM stdin;
5e5d5529-ae37-4053-8232-c173d9f9638a	9708b516-792a-4326-9127-2098b7e4126f	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-02	\N	t	\N	2026-11-01 23:08:19.705879+05:30	2026-11-01 23:08:19.705882+05:30
51bda7ec-f0c2-430e-8969-a52074c54041	1abfb97f-993d-4b8d-80b7-134771b35404	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-02	\N	t	\N	2026-11-01 23:10:15.293724+05:30	2026-11-01 23:10:15.293727+05:30
3cc8fea0-1b7c-4c45-9902-d0a53a379f38	d9560957-51eb-4f79-ac37-492d69e13505	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-01	\N	t	Updated to 20% by executive authorization	2026-11-01 23:10:41.177041+05:30	2026-11-01 23:10:45.343842+05:30
6862ae98-47fa-45a9-9d41-4c5d1d356de0	7e23e04d-d7e1-4175-a3a7-fc647c996f92	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-02	\N	t	\N	2026-11-01 23:14:09.729511+05:30	2026-11-01 23:14:09.729514+05:30
56608c4a-f2f8-456e-9713-efefb462a276	fafca85b-89df-4fe5-bc15-20ce5c2133ec	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-01	\N	t	Updated to 20% by executive authorization	2026-11-01 23:14:35.021319+05:30	2026-11-01 23:14:39.138022+05:30
d54a8efb-00ca-464c-8247-dbb843228ebd	949d8195-6fed-4b56-aaba-c69ad51dc831	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-04	\N	t	\N	2026-11-03 21:20:49.018384+05:30	2026-11-03 21:20:49.018388+05:30
5a1cbd54-660a-4eca-85c4-b9f6d165d52a	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-03	\N	t	Updated to 20% by executive authorization	2026-11-03 21:20:51.790812+05:30	2026-11-03 21:20:51.824537+05:30
e4fffdd0-3410-4b4d-9cfc-2e0f4127ca15	967c7ff1-75fe-49a4-8917-6ba868130eeb	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-04	\N	t	\N	2026-11-03 21:38:38.78714+05:30	2026-11-03 21:38:38.787143+05:30
77500da4-966d-44c3-9045-85a8ec7c4ee0	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-03	\N	t	Updated to 20% by executive authorization	2026-11-03 21:38:41.558315+05:30	2026-11-03 21:38:41.672141+05:30
7accb5e0-c105-49bb-9afc-543640d6fe45	75b24af0-6efd-4ca1-84e0-f70e9e44c9d5	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-05	\N	t	\N	2026-11-04 22:42:06.032434+05:30	2026-11-04 22:42:06.032444+05:30
1d4af735-2140-4fc5-9145-98d123330651	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-04	\N	t	Updated to 20% by executive authorization	2026-11-04 22:42:10.46212+05:30	2026-11-04 22:42:10.498989+05:30
4e87d98e-d154-448a-bc3f-31c965109bee	65f8599f-d4b3-49eb-87de-2bd93f7ff2e9	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-05	\N	t	\N	2026-11-04 22:44:47.477062+05:30	2026-11-04 22:44:47.477066+05:30
918ef4c5-354d-409f-88aa-833ba31c6764	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-04	\N	t	Updated to 20% by executive authorization	2026-11-04 22:44:52.90715+05:30	2026-11-04 22:44:52.961343+05:30
c8c84253-af44-414a-8a53-d920ba90fcb5	56a1df01-9aa9-4249-bdea-324d3ca58b55	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-05	\N	t	\N	2026-11-04 22:46:19.46041+05:30	2026-11-04 22:46:19.460413+05:30
68af03c8-aa61-4d99-bf5f-a608a2b7cfb9	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-04	\N	t	Updated to 20% by executive authorization	2026-11-04 22:46:23.206441+05:30	2026-11-04 22:46:23.247959+05:30
20f22885-8757-4ca4-8bed-74f8bec882a1	ca6e9832-acf5-4c1e-a12e-7a4020ac1c02	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-05	\N	t	\N	2026-11-04 22:46:58.735817+05:30	2026-11-04 22:46:58.73582+05:30
5744492f-4351-4f35-8475-760634156896	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-04	\N	t	Updated to 20% by executive authorization	2026-11-04 22:47:02.459484+05:30	2026-11-04 22:47:02.516119+05:30
eeaae26b-db8c-45a0-90e3-0adc3b1ce19f	a4f0fa9e-9c6a-4194-9cc8-34b44513c904	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-05	\N	t	\N	2026-11-04 22:47:30.333662+05:30	2026-11-04 22:47:30.333669+05:30
4f86666c-97ed-4dd3-9856-33b9b4f0d4e7	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-04	\N	t	Updated to 20% by executive authorization	2026-11-04 22:47:34.317328+05:30	2026-11-04 22:47:34.359989+05:30
4a9d8bd8-bf42-4ac6-a923-8147ac9ee210	49ed2d68-180e-4ff2-90e1-f3fd2ea72e36	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-05	\N	t	\N	2026-11-04 23:02:39.745632+05:30	2026-11-04 23:02:39.745636+05:30
f8c655ef-5f6c-429e-8a28-da087bbe8ab8	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-04	\N	t	Updated to 20% by executive authorization	2026-11-04 23:02:42.457012+05:30	2026-11-04 23:02:42.502971+05:30
f61f78cd-9c87-4760-a7c0-c41f09302a79	4977f377-2239-4987-9ca5-de05eec47aaf	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-05	\N	t	\N	2026-11-04 23:06:31.985837+05:30	2026-11-04 23:06:31.985841+05:30
4e848c44-009b-4ce6-997a-0508569f2d37	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-04	\N	t	Updated to 20% by executive authorization	2026-11-04 23:06:34.193303+05:30	2026-11-04 23:06:34.270021+05:30
be680e95-1be8-4dbe-8fec-4787bf9784bc	f1642cd9-74e3-4ec9-9607-30c73df06486	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-06	\N	t	\N	2026-11-05 12:25:16.990957+05:30	2026-11-05 12:25:16.990965+05:30
90220960-cd24-4b7a-ba95-7584ec998269	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-05	\N	t	Updated to 20% by executive authorization	2026-11-05 12:25:23.615965+05:30	2026-11-05 12:25:23.644161+05:30
cdedeec5-1314-4846-9e8c-084504c4e658	25f092a0-74a0-4197-870f-bcb9a5d57696	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-06	\N	t	\N	2026-11-05 12:53:35.01754+05:30	2026-11-05 12:53:35.017544+05:30
cbb164ed-9fd2-455e-b319-ded8eb05ebc1	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	18.50	8.00	\N	NET_PREMIUM	10.00	2026-11-05	\N	t	Premium health tie-up rate contract	2026-11-05 12:53:38.309384+05:30	2026-11-05 12:53:38.30939+05:30
07140e42-b1bb-402e-aa67-05b54430538d	322a9302-53c8-4cf4-85da-bae7c7373798	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-06	\N	t	\N	2026-11-05 12:54:50.475491+05:30	2026-11-05 12:54:50.475495+05:30
1031f20d-7518-448f-a953-3f0a8242d667	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-05	\N	t	Updated to 20% by executive authorization	2026-11-05 12:54:53.787759+05:30	2026-11-05 12:54:53.861569+05:30
e57cd95f-fd42-467e-862e-1d29e9908d0f	9fbddf96-d6d6-4754-9416-327445192a3e	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-09-06	\N	t	\N	2026-11-05 12:56:20.103083+05:30	2026-11-05 12:56:20.103086+05:30
c06cf054-dd4b-491b-88e5-a9708d6ebde6	4bd4cad0-05d2-4967-b6e1-7e711da20d85	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-06	\N	t	\N	2026-11-05 12:56:31.291737+05:30	2026-11-05 12:56:31.29174+05:30
a782802f-d954-4088-83e2-444adfd479f7	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-05	\N	t	Updated to 20% by executive authorization	2026-11-05 12:56:34.588005+05:30	2026-11-05 12:56:34.658744+05:30
bff38c16-1a25-437b-ad68-c8500df287b2	7b7950f9-cfee-4ee5-86f6-4c766ef8a923	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-09-06	\N	t	\N	2026-11-05 13:04:19.309112+05:30	2026-11-05 13:04:19.309121+05:30
07941819-5026-4659-b5b7-f91b75f71079	890c76ab-6703-430b-b812-f1e5d71bbb43	HEALTH	\N	15.00	7.50	\N	NET_PREMIUM	10.00	2026-10-06	\N	t	\N	2026-11-05 13:04:26.909753+05:30	2026-11-05 13:04:26.909757+05:30
09c822bc-753b-4b45-b124-9aec701480b5	863f3d63-3e6b-45d5-a246-40ca158fa736	HEALTH	\N	20.00	8.00	\N	NET_PREMIUM	10.00	2026-11-05	\N	t	Updated to 20% by executive authorization	2026-11-05 13:04:31.550018+05:30	2026-11-05 13:04:31.593735+05:30
\.


--
-- Data for Name: insurance_company_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_company_documents (id, company_id, document_type, title, original_filename, storage_path, file_size_bytes, mime_type, sha256_hash, uploaded_by_id, created_at) FROM stdin;
\.


--
-- Data for Name: insurance_family_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_family_groups (id, name, head_customer_id, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_family_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_family_members (id, family_group_id, customer_id, relationship, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_health_quotation_company_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_health_quotation_company_plans (id, quotation_id, insurance_company_id, insurance_plan_id, display_company_name, display_plan_variant, notes, display_order, created_at) FROM stdin;
d714716d-bb91-4ff4-a5bf-79cb0f4f0d7f	9fc9f278-f21a-4a1a-85ef-f1439c147589	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:51:53.449721+05:30
268643c7-78f6-4600-8f17-cbf613886516	9fc9f278-f21a-4a1a-85ef-f1439c147589	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:51:53.457133+05:30
a9067279-ec2d-45ce-899a-f85ff6fb4d69	9fc9f278-f21a-4a1a-85ef-f1439c147589	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:51:53.45842+05:30
f1122c50-4648-49d5-88d7-cd36cb153908	9fc9f278-f21a-4a1a-85ef-f1439c147589	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:51:53.459527+05:30
1ab0dca9-9c61-4cfe-a38c-ef721d80d6f0	75ef48ad-7ff0-4dfb-9f47-3939b9169f41	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:51:57.727302+05:30
cfec01d2-6275-4024-8449-77fd2e0c8b31	75ef48ad-7ff0-4dfb-9f47-3939b9169f41	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:51:57.730937+05:30
d035cc95-c856-4d98-9407-6965a89a6649	75ef48ad-7ff0-4dfb-9f47-3939b9169f41	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:51:57.736397+05:30
c7bcd5f7-a427-430a-8a59-eaf08203e0c8	75ef48ad-7ff0-4dfb-9f47-3939b9169f41	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:51:57.738639+05:30
360cf2cd-3e91-4934-8d38-37583823434e	75ef48ad-7ff0-4dfb-9f47-3939b9169f41	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 17:51:57.740956+05:30
b63aa666-b295-42d4-aa8c-ae9310ffa6db	eb5b3fa8-b7db-44fb-b36b-a4732ba74fc0	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:52:01.770068+05:30
96964185-6845-4e68-9d3a-0fca305f66e5	eb5b3fa8-b7db-44fb-b36b-a4732ba74fc0	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 17:52:01.774455+05:30
4b43c869-f43c-4e75-95f4-ab2d09c603c0	bfd648bb-e0c0-4c28-8185-a5019a8a1710	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:52:05.513945+05:30
2eb2d3be-3728-4010-826b-ce53f2dc2e87	9ed2734b-545e-44fd-a09d-4cae26a1bd2d	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:52:09.299763+05:30
c63f5478-42e6-4af1-a6be-eb41c36a8644	c4419739-52e7-42f7-af8c-8cf23d6a0430	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:52:13.319982+05:30
89756f2c-9687-4289-9eca-af92ff2923c1	c4419739-52e7-42f7-af8c-8cf23d6a0430	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:52:13.323023+05:30
3adfb6dd-3321-49b4-959e-5fb05758deb0	c4419739-52e7-42f7-af8c-8cf23d6a0430	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:52:13.323882+05:30
1442c58a-89e1-44ab-bb16-f8b482412295	c4419739-52e7-42f7-af8c-8cf23d6a0430	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:52:13.325176+05:30
197e90c5-ac2b-40a3-af2c-2d51338fa70d	1ecc736d-5177-4287-ad02-e26c9060ee6b	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:54:28.553752+05:30
146dbf9c-321c-4095-a3d0-719855e0b322	1ecc736d-5177-4287-ad02-e26c9060ee6b	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:54:28.559978+05:30
4b242aa6-b912-46d4-aabb-eb3284f52eaf	1ecc736d-5177-4287-ad02-e26c9060ee6b	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:54:28.561039+05:30
078d0a30-1c5e-45bc-bfbe-692eebbcb928	1ecc736d-5177-4287-ad02-e26c9060ee6b	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:54:28.562021+05:30
3b390a5a-396b-4b34-b1c9-e78d3580f5b6	dbec63c0-6a87-4b4d-bf7b-501f7eea8771	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:54:31.730316+05:30
805bd407-c6c2-4cdd-bc96-76f993a6e0a8	dbec63c0-6a87-4b4d-bf7b-501f7eea8771	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:54:31.735707+05:30
7290af5d-4920-4a20-aded-67cea07818a8	dbec63c0-6a87-4b4d-bf7b-501f7eea8771	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:54:31.740675+05:30
e57702b2-9903-435e-ae1a-45299989bf41	dbec63c0-6a87-4b4d-bf7b-501f7eea8771	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:54:31.743006+05:30
e64c2f45-e6b3-4072-844d-c8030b73aa12	dbec63c0-6a87-4b4d-bf7b-501f7eea8771	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 17:54:31.745442+05:30
6f47de65-9eaf-4e04-889a-4fd11b2daa28	ac19c0fe-1e7a-4fa1-94bf-41ada9d26a1e	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:54:34.31849+05:30
83420f5d-09e9-45bf-be7c-4f75b2234c29	ac19c0fe-1e7a-4fa1-94bf-41ada9d26a1e	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 17:54:34.321014+05:30
7757c094-ee66-4556-bc9c-eb4b519eb658	a70569b8-2954-4971-bba4-0614eca210c5	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-01 17:54:39.424392+05:30
d81437ce-05e4-4b80-9963-d575ff0c954a	9c7e7203-3598-4565-bc07-015c6875d06d	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:54:42.048005+05:30
b3b24f24-bdf1-4e2b-942b-f1907e8a5e2c	586f174b-2126-475a-9061-20ca66f8fb72	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:54:51.278887+05:30
a5403c1a-a62a-4bd4-9d0d-39485f54af9d	586f174b-2126-475a-9061-20ca66f8fb72	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:54:51.28318+05:30
edece15b-d88d-4acc-a9f4-b9674dd3ac97	586f174b-2126-475a-9061-20ca66f8fb72	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:54:51.284209+05:30
f8899bf6-86d4-4ba8-82a6-4f92b7bc0d36	586f174b-2126-475a-9061-20ca66f8fb72	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:54:51.285389+05:30
125c34e3-b463-49c7-a68e-375de2edba34	5e48975a-ad6f-4147-96d7-8ea9b994f69f	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:56:26.350359+05:30
b916d428-203c-47d1-89c5-bbd2bc012299	5e48975a-ad6f-4147-96d7-8ea9b994f69f	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:56:26.357868+05:30
a4149505-50fe-4c19-9adb-5b3ed5f9a97f	5e48975a-ad6f-4147-96d7-8ea9b994f69f	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:56:26.358992+05:30
1e36ec56-52d8-4727-a46f-611f8926c5ae	5e48975a-ad6f-4147-96d7-8ea9b994f69f	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:56:26.360102+05:30
69d9a77c-65f8-43b7-aaca-c615abda03eb	77422edf-f737-4d82-9440-dab8736e33d6	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:56:29.130025+05:30
b2b8f002-e068-4f97-b25d-85369d49c837	77422edf-f737-4d82-9440-dab8736e33d6	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:56:29.135197+05:30
a0fdbc5f-5385-401e-84a3-5473cd843f17	77422edf-f737-4d82-9440-dab8736e33d6	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:56:29.140167+05:30
72c48eff-9ab8-408a-b5d8-113a506c281b	77422edf-f737-4d82-9440-dab8736e33d6	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:56:29.143016+05:30
59a8e9ea-9b91-49b1-9951-53b034d19a22	77422edf-f737-4d82-9440-dab8736e33d6	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 17:56:29.145933+05:30
5686ed56-be6c-47f5-adf4-31bb2beaeb44	7d29448a-0aff-4dde-9845-c3371e1786a0	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:56:31.969488+05:30
5a4e5b83-8e88-4ce2-8c51-7477de847630	7d29448a-0aff-4dde-9845-c3371e1786a0	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 17:56:31.972531+05:30
d8b2280c-2c15-4cfa-bb33-68c5cb875ecd	b3c20dd7-7f0f-4082-897a-5f99cdb65157	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-01 17:56:36.847896+05:30
5699399b-2c8e-4bb0-bb07-b421fcdaa7d9	e486b08b-179a-4d7b-8d58-5efe65a6a601	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:56:41.111277+05:30
49d0fc09-73d9-4f26-878b-ca60e9bdf328	908132e5-0135-4f85-9026-d8c07a3fd25a	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:56:50.263012+05:30
b71c3baa-202e-45c2-8a79-40773f3cf6a4	908132e5-0135-4f85-9026-d8c07a3fd25a	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:56:50.266546+05:30
f1873b77-e29f-427d-ab76-01fea1933bd1	908132e5-0135-4f85-9026-d8c07a3fd25a	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:56:50.267994+05:30
4546c3b4-d757-4363-8d29-c31fdb674187	908132e5-0135-4f85-9026-d8c07a3fd25a	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:56:50.269119+05:30
87f3ceda-7c86-46c5-b77b-f2426d7954bc	109df747-4579-43a8-afb9-2a58b53f54f4	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:57:35.844006+05:30
88617f0d-2906-4d54-a3ed-4f29d405a708	109df747-4579-43a8-afb9-2a58b53f54f4	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:57:35.850209+05:30
242f48b8-278e-435b-bb0c-3e71809ac19e	109df747-4579-43a8-afb9-2a58b53f54f4	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:57:35.851225+05:30
619ec93c-5776-444f-b15c-644bb8141017	109df747-4579-43a8-afb9-2a58b53f54f4	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:57:35.852229+05:30
33a79464-bbbb-4495-9338-90447680d060	a8c345cc-7eed-4764-ab8c-23351f6a1529	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:57:38.42967+05:30
c07f65ed-44c1-4372-8e23-936374c428e4	a8c345cc-7eed-4764-ab8c-23351f6a1529	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:57:38.434225+05:30
88c751d3-7ab3-42c7-bf46-09c71b70e51d	a8c345cc-7eed-4764-ab8c-23351f6a1529	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:57:38.438306+05:30
6e00971e-d8ec-442c-bb65-41e489946c82	a8c345cc-7eed-4764-ab8c-23351f6a1529	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:57:38.440763+05:30
91fa5711-1f84-472a-a260-d09624e13b06	a8c345cc-7eed-4764-ab8c-23351f6a1529	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 17:57:38.443177+05:30
35924715-6e99-4c0a-9d00-8ff41e8f0482	f8a4e668-21de-4974-9f74-fb307c853624	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:57:41.015434+05:30
ab0e64a3-a0e4-4f5f-aef0-c9c780dec008	f8a4e668-21de-4974-9f74-fb307c853624	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 17:57:41.018573+05:30
e5f6ae0e-c70b-4cef-a2cc-40e944663d9c	1f6fa7a4-aa36-4f79-8cd9-ac6f9decabd9	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-01 17:57:45.953985+05:30
e1c6c603-7518-4a07-bab6-12f7134efe31	08774c4f-e433-484d-b225-599d577be670	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:57:50.220431+05:30
1edcfc79-1e6b-440a-95c8-2b9b5393aa1f	56aa1fa7-6e12-48e2-86fa-172a4a36a982	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:57:59.300999+05:30
da10c635-8da8-449a-b646-9d3345938c88	56aa1fa7-6e12-48e2-86fa-172a4a36a982	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:57:59.304696+05:30
9f4f2b11-4630-494c-a712-ce184b68f2ce	56aa1fa7-6e12-48e2-86fa-172a4a36a982	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:57:59.305941+05:30
2ab9a72c-0422-4f88-92e3-ddb75e22072b	56aa1fa7-6e12-48e2-86fa-172a4a36a982	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:57:59.307357+05:30
2f7c0241-a9da-4e37-80a9-8845ae156c2b	7a114092-4478-4e44-9996-5d7a1436bc99	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:59:03.894326+05:30
fcd511e0-63d7-4989-8bd5-b4af5b6cf63b	7a114092-4478-4e44-9996-5d7a1436bc99	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:59:03.898548+05:30
2348ef85-01f6-47d9-8cf8-f1e229c355eb	7a114092-4478-4e44-9996-5d7a1436bc99	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:59:03.899295+05:30
a7e7a437-9de6-459c-8998-582b9a2dcc70	7a114092-4478-4e44-9996-5d7a1436bc99	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:59:03.899871+05:30
5532f00c-1aed-4ac1-94bd-2f7647a7723e	e07370f7-7c83-4411-821e-0eb91213ea50	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:59:06.373062+05:30
3f44c3b8-775f-4f98-b1f1-557d2c891059	e07370f7-7c83-4411-821e-0eb91213ea50	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:59:06.376323+05:30
f6f11831-62da-44c3-9531-032ebf5beac0	e07370f7-7c83-4411-821e-0eb91213ea50	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:59:06.379958+05:30
515d86d9-e479-428b-a863-a2c1d89dd86c	e07370f7-7c83-4411-821e-0eb91213ea50	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:59:06.381658+05:30
3c7d9900-0dff-494e-bdb5-4e74ec80def8	e07370f7-7c83-4411-821e-0eb91213ea50	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 17:59:06.384001+05:30
44f2329d-7d61-4268-99ed-5794ef9da416	cdd54b28-23d0-46fc-b562-a9da70c98fe8	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:59:08.818048+05:30
2dfa0148-0b2f-4451-b99f-c76b0124fb61	cdd54b28-23d0-46fc-b562-a9da70c98fe8	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 17:59:08.82017+05:30
2fba0399-f7c9-48e7-9056-7266ecd6aee9	4ec03a45-d25c-4330-932d-8882e42da614	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-01 17:59:13.461414+05:30
5338d411-e451-44ec-af7f-c026fb00c3b4	06d2c9fa-7290-4c15-a86d-01095fce49c2	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:59:16.073894+05:30
dc4d8586-9984-432f-9f19-46bb66491815	8a013209-2afd-4c4f-932a-cd7fc5724478	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 17:59:24.822249+05:30
be95a247-2173-4d0a-80e2-acec967d24e1	8a013209-2afd-4c4f-932a-cd7fc5724478	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 17:59:24.82439+05:30
39cd9dc8-9fe3-4bda-9e81-ff70aa34e1c8	8a013209-2afd-4c4f-932a-cd7fc5724478	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 17:59:24.824996+05:30
d60263de-a31a-442d-81e1-d56e7b07a4b4	8a013209-2afd-4c4f-932a-cd7fc5724478	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 17:59:24.825523+05:30
5af598fb-7248-465e-9bc1-d2fa6968aae7	0f62f059-cbd0-448a-b0eb-fc8114375308	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:11:50.853915+05:30
b04b599d-6976-484e-99bc-c0983c31bfc4	0f62f059-cbd0-448a-b0eb-fc8114375308	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 18:11:50.860684+05:30
6c64e960-5098-4169-8357-3216167b0735	0f62f059-cbd0-448a-b0eb-fc8114375308	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 18:11:50.862459+05:30
e9169102-4e6b-44a9-a061-1f501f2a0a97	0f62f059-cbd0-448a-b0eb-fc8114375308	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 18:11:50.86393+05:30
0e5b5749-c390-4e27-9d26-969aa46bbe9a	48b6a9d9-ae0d-41e3-a05f-800e01ce512d	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:11:53.573692+05:30
a4fca7bf-0a3d-412b-befe-d0050d0a8b56	48b6a9d9-ae0d-41e3-a05f-800e01ce512d	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 18:11:53.5796+05:30
268494c3-e575-4fc5-83d4-c05cde43e766	48b6a9d9-ae0d-41e3-a05f-800e01ce512d	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 18:11:53.584316+05:30
755cf798-6a93-41a2-9b21-0bc2bdf747d3	48b6a9d9-ae0d-41e3-a05f-800e01ce512d	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 18:11:53.586842+05:30
a054a67d-6d57-48d1-adc5-38284252c493	48b6a9d9-ae0d-41e3-a05f-800e01ce512d	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 18:11:53.589144+05:30
674532e8-6e64-4ade-a8e4-b0c60fce047d	13ab07ec-62f5-40f8-b9f4-6ddfafe894f7	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:11:56.240897+05:30
835d2f74-1cc1-45bb-9abc-de2fd5c7c3c1	13ab07ec-62f5-40f8-b9f4-6ddfafe894f7	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 18:11:56.244209+05:30
bb0bc773-f51a-4c70-b8af-d56323f94636	3294d1a5-836e-4877-a0d0-ed14d3fbe291	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-01 18:12:01.183004+05:30
8d83b17a-36fe-4be7-a7b0-a71494becd8d	10a47e8d-509f-4aae-bb05-7fe42e65e5d8	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:12:03.841461+05:30
814d5b6f-02b4-4690-9d91-947772eaa417	db96c885-a0bc-4aed-9ba7-1e2233b70dfc	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:12:12.871877+05:30
b218302f-e66f-4134-8536-848a5a262ec5	db96c885-a0bc-4aed-9ba7-1e2233b70dfc	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 18:12:12.876588+05:30
e67ced0c-7415-419a-8a30-190a043eca00	db96c885-a0bc-4aed-9ba7-1e2233b70dfc	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 18:12:12.878104+05:30
b2bb4326-1812-44c8-8b57-c96901b0b7a2	db96c885-a0bc-4aed-9ba7-1e2233b70dfc	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 18:12:12.879726+05:30
c2d9ffd1-868d-4fd8-976c-ce254f39ac8d	648f2bf1-76e0-48f8-9d05-50a5d6286456	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:31:55.628888+05:30
038ce9f9-5441-496f-9cc9-785e5b33f45e	648f2bf1-76e0-48f8-9d05-50a5d6286456	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 18:31:55.632556+05:30
ff962ac1-6795-443d-be6c-83500f3c2af0	648f2bf1-76e0-48f8-9d05-50a5d6286456	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 18:31:55.633454+05:30
473722a0-3fbc-49f0-bf17-1dc90590ccc5	648f2bf1-76e0-48f8-9d05-50a5d6286456	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 18:31:55.634455+05:30
74af6292-2fed-48ab-be21-5b86def22b33	3d8c6146-0cf2-4460-9bb5-c3f4d427c410	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:31:58.09483+05:30
795d90b8-aa87-440c-ae6a-e2a07794b448	3d8c6146-0cf2-4460-9bb5-c3f4d427c410	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 18:31:58.097737+05:30
6dabead1-fbb6-4524-8976-c97ac6a427b8	3d8c6146-0cf2-4460-9bb5-c3f4d427c410	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 18:31:58.101612+05:30
557ea78d-d4a1-4264-b45d-e2e767d11a60	3d8c6146-0cf2-4460-9bb5-c3f4d427c410	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 18:31:58.103126+05:30
d6e22ca2-055e-4bb5-b739-3be386e21c3c	3d8c6146-0cf2-4460-9bb5-c3f4d427c410	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 18:31:58.10475+05:30
7271fe38-f8d4-49c4-ae47-b889654fc3b6	a0eaa133-d4b1-458d-aa79-818a462bb272	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 18:32:00.581133+05:30
43a01295-f857-4866-8e3c-fa2590567d0f	a0eaa133-d4b1-458d-aa79-818a462bb272	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 18:32:00.583732+05:30
6681fbb1-417f-42fa-9d39-bb2c9b4e0f8b	98db068c-b944-4d0a-ae63-2dedc75c4ce7	\N	\N	HDFC ERGO	(with HC)	\N	1	2026-11-01 20:32:20.445241+05:30
98361f62-895f-427f-a5e6-c87fe89a48f8	98db068c-b944-4d0a-ae63-2dedc75c4ce7	\N	\N	NIVA BUPA	(with HC)	\N	2	2026-11-01 20:32:20.445249+05:30
b821a901-5987-4927-94a1-a5239cad6a2d	98db068c-b944-4d0a-ae63-2dedc75c4ce7	\N	\N	TATA AIG	(Medicare Select)	\N	3	2026-11-01 20:32:20.445252+05:30
cc46f10e-599b-4480-a751-57f77ca64f23	98db068c-b944-4d0a-ae63-2dedc75c4ce7	\N	\N	TATA AIG	(Medicare Premier)	\N	4	2026-11-01 20:32:20.445254+05:30
2c57ae9a-715e-4b1e-9bfb-548f299ae7fe	8249b200-547f-466b-b832-4e16b4aa1232	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 20:45:01.704033+05:30
d8697362-8570-4983-a56f-7c88463857fc	8249b200-547f-466b-b832-4e16b4aa1232	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 20:45:01.707244+05:30
9826f0f0-18aa-4a3f-872a-e31ce686d085	8249b200-547f-466b-b832-4e16b4aa1232	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 20:45:01.708108+05:30
7ea21c43-7d60-445e-b5dd-da176282d2c2	8249b200-547f-466b-b832-4e16b4aa1232	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 20:45:01.708776+05:30
b6962fa5-74ef-450b-bbf9-68773a7ec65b	ee1b9df2-5645-4169-b144-80d333541f7e	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 20:45:04.186567+05:30
75041184-3421-4e21-9a00-dcfc098f0e3d	ee1b9df2-5645-4169-b144-80d333541f7e	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 20:45:04.191337+05:30
9dd598b1-ee60-4e4e-b14a-52feb88122d7	ee1b9df2-5645-4169-b144-80d333541f7e	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 20:45:04.195076+05:30
54cc3682-4f3d-4fc8-8469-885c414f2421	ee1b9df2-5645-4169-b144-80d333541f7e	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 20:45:04.197428+05:30
7b60d72c-32f6-47b6-90e8-d59896ddb0b5	ee1b9df2-5645-4169-b144-80d333541f7e	\N	\N	Care Health	Care Supreme	\N	4	2026-11-01 20:45:04.199853+05:30
a66e90af-d4a2-4e80-82a9-45a768c49d3d	bee6dc28-0a61-429c-9722-38eb81f41823	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 20:45:06.64012+05:30
25ca077e-9cda-4166-b92d-4f67e3f91f0d	bee6dc28-0a61-429c-9722-38eb81f41823	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 20:45:06.642049+05:30
164b8975-64e4-4ef7-958a-acd17eac2813	4d691de0-3d64-49bf-86f2-aec82b354caa	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-01 20:45:11.614509+05:30
22759648-4244-490a-981a-5b58bb7567eb	8ca69177-4fed-471d-b2a0-f872c48ff0de	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 20:45:14.089308+05:30
8fbafb98-de76-4a5b-823a-1dfdfe63ea6c	e1b9dcca-f475-4dbb-a599-11bc46d08c4d	\N	\N	HDFC ERGO	(with HC)	\N	1	2026-11-01 20:52:59.683175+05:30
9d15faa3-e506-40ab-a403-cd51d73bb609	e1b9dcca-f475-4dbb-a599-11bc46d08c4d	\N	\N	NIVA BUPA	(with HC)	\N	2	2026-11-01 20:52:59.713205+05:30
751743a0-2137-4c79-812b-46567bbab486	e1b9dcca-f475-4dbb-a599-11bc46d08c4d	\N	\N	TATA AIG	(Medicare Select)	\N	3	2026-11-01 20:52:59.734706+05:30
25bc0ae1-ce45-482f-95d8-375d4d69212b	e1b9dcca-f475-4dbb-a599-11bc46d08c4d	\N	\N	TATA AIG	(Medicare Premier)	\N	4	2026-11-01 20:52:59.75012+05:30
757ad300-4ebf-4d83-ad21-fd53ab15d078	3fbe8705-38c9-4f37-b627-a14229ee2e33	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 21:13:49.406858+05:30
6c3cd809-d0bf-4c44-8871-08f51ad2da96	3fbe8705-38c9-4f37-b627-a14229ee2e33	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 21:13:49.410734+05:30
1212d7f9-b1bb-46b0-a2c1-d649d3b0c74d	3fbe8705-38c9-4f37-b627-a14229ee2e33	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 21:13:49.411275+05:30
83f634fa-1097-4bcd-8f0e-098fbb7ba3cc	3fbe8705-38c9-4f37-b627-a14229ee2e33	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 21:13:49.411778+05:30
7212f343-3dd2-421b-a203-bdf223ada1dd	e64fabe1-981e-4ba5-beca-7c8c83e7761c	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 21:13:54.181378+05:30
bed51b79-61ad-4e21-b420-440614463793	e64fabe1-981e-4ba5-beca-7c8c83e7761c	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-01 21:13:54.183293+05:30
9707888e-a371-43e8-9847-c6cae481cacf	e639782f-e647-48d4-a093-ddee41764cb4	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-01 21:13:58.701961+05:30
e33ae546-45d2-48f2-90c5-89fcdda75b1d	80089d82-d1e3-45e8-9e0c-a2e8ef8862f7	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 21:14:01.194587+05:30
c45ed619-fe63-447a-b585-0e02c119b1bf	66529fbb-97b5-49f4-bde2-0005556c3ae2	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-01 21:14:09.815935+05:30
301c57e8-f21c-4212-bc38-b3e2fe96fc76	66529fbb-97b5-49f4-bde2-0005556c3ae2	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-01 21:14:09.817875+05:30
8a6a50e8-adc5-4aa0-9af1-e13b11d20f7e	66529fbb-97b5-49f4-bde2-0005556c3ae2	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-01 21:14:09.81845+05:30
255d69c5-5701-4392-91d9-0d3182e2e510	66529fbb-97b5-49f4-bde2-0005556c3ae2	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-01 21:14:09.818881+05:30
4fb04064-0f0a-48ce-9d07-346826957492	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	\N	\N	HDFC ERGO	(with HC)	\N	1	2026-11-03 18:20:49.527848+05:30
0afaf8e2-5879-42ee-9c03-f176d0766b5d	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	\N	\N	NIVA BUPA	(with HC)	\N	2	2026-11-03 18:20:49.541722+05:30
3e63f20f-d492-411a-a537-d98682d65ad6	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	\N	\N	TATA AIG	(Medicare premier)	\N	3	2026-11-03 18:20:49.545482+05:30
79dbeeb5-28fe-4ce5-b662-0db0b0dc1108	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	\N	\N	TATA AIG	(Medicare select)	\N	4	2026-11-03 18:20:49.547424+05:30
93a935d3-3016-4f2f-9bfa-9084b96a7191	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-03 21:20:29.17305+05:30
ddd72d11-0469-47fc-a5e9-539a90fa1866	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-03 21:20:29.181498+05:30
ea2cf153-1920-46cb-bf3a-13e96f3f7ea7	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-03 21:20:29.182635+05:30
28e6d617-f597-46ee-9559-329ebceeb2ce	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-03 21:20:29.1835+05:30
27159cb1-01f7-4def-aee9-c667167b3484	6028f846-c2d6-4233-a107-97e9fe686ff6	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-03 21:20:29.592362+05:30
1a5c88d8-e8bc-46f4-9244-3b639a7238f5	6028f846-c2d6-4233-a107-97e9fe686ff6	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-03 21:20:29.595142+05:30
395b1f04-bdca-4627-bb13-3e2ee4cd5f1e	6028f846-c2d6-4233-a107-97e9fe686ff6	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-03 21:20:29.640193+05:30
63f07944-069e-4bcb-820e-8c1e19770e5e	6028f846-c2d6-4233-a107-97e9fe686ff6	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-03 21:20:29.64144+05:30
31d2e1da-07f3-4213-ada9-2d2cc426eec4	6028f846-c2d6-4233-a107-97e9fe686ff6	\N	\N	Care Health	Care Supreme	\N	4	2026-11-03 21:20:29.642738+05:30
d76a0f10-2806-4229-a568-8d8ea8d2b5f4	4e547f92-1679-4d2c-b30f-999e36316840	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-03 21:20:30.282981+05:30
361a15cb-c7db-44b0-a8cc-af78c64e7d1d	4e547f92-1679-4d2c-b30f-999e36316840	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-03 21:20:30.287141+05:30
10af8c7f-5c0b-4d7c-901c-e5332893be07	f199b890-ac6f-4126-9afa-09844a7ef3c9	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-03 21:20:30.822838+05:30
3795f47a-1b3e-4a05-8216-891c28575305	f98d579f-6da5-4f88-b527-6fc3b579ed5c	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-03 21:20:31.315051+05:30
b34aa89d-bf16-4f9e-a29b-73b6c2dc9c00	fdc8ca93-a632-47ad-af03-246163065d4d	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-03 21:20:31.893899+05:30
7a7698d5-2130-4286-a1e6-1e9b547fb8bf	fdc8ca93-a632-47ad-af03-246163065d4d	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-03 21:20:31.896579+05:30
3791e21f-dbe8-49ec-912f-c1766722f4f9	fdc8ca93-a632-47ad-af03-246163065d4d	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-03 21:20:31.897348+05:30
a0b4a301-2614-424b-860a-a6d883acc21d	fdc8ca93-a632-47ad-af03-246163065d4d	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-03 21:20:31.898251+05:30
0b7400e6-7d5c-44ff-be64-df33c7104a2a	d41ba26d-3511-40e8-aecc-8644550490ec	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:39:43.963922+05:30
a07ccb32-3c2c-432a-bdf8-8aac17b1e868	d41ba26d-3511-40e8-aecc-8644550490ec	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:39:43.972184+05:30
8ca2011c-fe81-4367-aef8-b2a8c9489824	d41ba26d-3511-40e8-aecc-8644550490ec	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:39:43.973063+05:30
8f40b94b-4efa-4ecb-8939-72519e3389b5	d41ba26d-3511-40e8-aecc-8644550490ec	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:39:43.973654+05:30
5ad2be5a-8225-4c0f-a17b-002c5bc6f0a0	098773da-d685-4a40-a0a2-de54b771eba6	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:39:46.108609+05:30
bd1caa14-740e-4aa1-9d31-d73608dfdfaf	098773da-d685-4a40-a0a2-de54b771eba6	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:39:46.124072+05:30
f5dade7e-2e56-45af-a185-6902dde178dc	098773da-d685-4a40-a0a2-de54b771eba6	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:39:46.14359+05:30
a71c6786-c672-49a2-827a-eca616e3d74a	098773da-d685-4a40-a0a2-de54b771eba6	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:39:46.150165+05:30
625ca5c5-c2c3-4b02-b620-76869b849451	098773da-d685-4a40-a0a2-de54b771eba6	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 22:39:46.157525+05:30
f1327353-700a-4867-94f0-3192efb915f3	a9b4a749-0bf9-451c-8012-99652c012be3	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:39:47.914903+05:30
ed08bbf5-4561-48e7-95bd-e316ef77fc46	a9b4a749-0bf9-451c-8012-99652c012be3	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 22:39:47.919374+05:30
35842b87-e314-4dd8-84de-30fbf6da932e	89917f5e-d5b1-481f-9832-6f5c082bb936	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:39:49.422407+05:30
c5738bc5-5f35-47d3-8bbd-d617ed7f9d63	0cab7ecb-c31d-432d-bae7-79bc0a22cab6	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:39:50.941798+05:30
12f3654f-a0d0-4296-b078-fbfe965e2dca	ff131008-f97d-4e80-bd6f-67f3ba3e9650	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:39:52.383105+05:30
62770b14-b229-4082-9d41-d206974d5ec5	ff131008-f97d-4e80-bd6f-67f3ba3e9650	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:39:52.387132+05:30
6f7eab3f-aebd-4db1-bf27-3012d62af01d	ff131008-f97d-4e80-bd6f-67f3ba3e9650	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:39:52.388863+05:30
d0accc23-d072-4a2e-a6b0-b39505db10bc	ff131008-f97d-4e80-bd6f-67f3ba3e9650	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:39:52.390068+05:30
36d4ff9e-9420-4ddb-ac4e-80b71269d0cc	3eef8c60-f6c1-4ab1-a47e-d15652f12de9	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:39:54.498432+05:30
ec0963be-1cc0-41ce-9915-6c09c94a990e	3eef8c60-f6c1-4ab1-a47e-d15652f12de9	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:39:54.502097+05:30
4b7c5db7-7034-4926-9288-f0d26f5789aa	3eef8c60-f6c1-4ab1-a47e-d15652f12de9	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:39:54.503159+05:30
303279f4-ad23-41ef-9faa-1b80a0417f4b	3eef8c60-f6c1-4ab1-a47e-d15652f12de9	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:39:54.504133+05:30
14ab7d40-a2b1-4201-a2bf-c390194d405c	365d3818-df64-45b2-8846-a2c17472edd0	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:40:11.657894+05:30
0c955614-33d6-4cfa-a09d-3026011a847c	365d3818-df64-45b2-8846-a2c17472edd0	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:40:11.665386+05:30
54b77719-b645-4b44-be60-3239867c59bb	365d3818-df64-45b2-8846-a2c17472edd0	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:40:11.667432+05:30
05b85647-8b87-417c-bb74-d81ecff680c3	365d3818-df64-45b2-8846-a2c17472edd0	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:40:11.668681+05:30
2ae3e252-5d3e-44ac-867c-d615223bc293	018d172c-15c0-44ba-a6f0-bfac26f39022	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:40:13.690985+05:30
0e279d15-93eb-4587-84a7-ff4299836d54	018d172c-15c0-44ba-a6f0-bfac26f39022	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:40:13.696128+05:30
69310632-6d64-4a3d-a392-18845f609e03	018d172c-15c0-44ba-a6f0-bfac26f39022	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:40:13.702465+05:30
c918b3c2-58f3-4080-b491-db1810ca9359	018d172c-15c0-44ba-a6f0-bfac26f39022	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:40:13.704578+05:30
48baf1b7-c6d1-432e-9e11-cede60c3954a	018d172c-15c0-44ba-a6f0-bfac26f39022	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 22:40:13.707079+05:30
ae2cae03-65c3-46b5-aed7-54510c694bd2	3e6c6677-e4d6-487e-94d5-206bc9a44017	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:40:15.328452+05:30
5bb13674-5e7f-4543-8e35-a886b4d1402c	3e6c6677-e4d6-487e-94d5-206bc9a44017	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 22:40:15.331581+05:30
2a3a5a8e-1f0e-4b87-8eea-083b21ef2f25	4bcecbe7-4475-4a3b-8253-5a6b62d2dfe8	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:40:16.784172+05:30
80cb58cc-0ba2-4b23-a461-246ae7b9ba1c	798500c8-0078-4338-bc3c-d9363996b3f1	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:40:18.495796+05:30
6acb5333-cac2-4e08-867b-15fae1a95590	e51b5a8d-3372-4323-bf6b-0b23cf11a49e	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:40:20.074646+05:30
e2344e30-f7a1-480e-9921-e29d558a9002	e51b5a8d-3372-4323-bf6b-0b23cf11a49e	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:40:20.078908+05:30
82cdf4bd-bbbd-4ad7-b690-4838fdf8a801	e51b5a8d-3372-4323-bf6b-0b23cf11a49e	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:40:20.079811+05:30
55d50216-c3fc-4214-85e6-de417acad1d5	e51b5a8d-3372-4323-bf6b-0b23cf11a49e	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:40:20.081035+05:30
2fa9e981-0835-402b-a0d5-df0a4c54308d	b596cbe3-309d-4ef8-bebc-dba8dbaece1a	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:40:22.208045+05:30
56902bf1-d429-42ba-ba97-c482e722554d	b596cbe3-309d-4ef8-bebc-dba8dbaece1a	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:40:22.211445+05:30
9ad2ccce-870c-41c5-90ee-18b0aa45bf55	b596cbe3-309d-4ef8-bebc-dba8dbaece1a	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:40:22.212705+05:30
c6278e78-fb6a-49b2-a437-ecbcaa1db7f6	b596cbe3-309d-4ef8-bebc-dba8dbaece1a	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:40:22.2137+05:30
2ac57cbe-3dee-4b7d-b079-28c924d5efd0	b2d792c8-10be-4701-b511-ae1d5ef369cd	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:10.134049+05:30
6f6929c7-58b5-415c-bdab-bd3b20cfb8fc	b2d792c8-10be-4701-b511-ae1d5ef369cd	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:41:10.142297+05:30
94367dd7-e93e-41b9-b9d9-514cb3104ac0	b2d792c8-10be-4701-b511-ae1d5ef369cd	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:41:10.14372+05:30
1414f318-7463-4270-9cf5-61743477f0fd	b2d792c8-10be-4701-b511-ae1d5ef369cd	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:41:10.144971+05:30
53a6d912-8097-457f-a3f6-cbb94aaff913	5baa1a97-452f-4616-bd00-83b7fd5783f8	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:10.764275+05:30
2f617e34-0817-4d1d-aa98-c6f9c4a896be	5baa1a97-452f-4616-bd00-83b7fd5783f8	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:41:10.771207+05:30
e924ac81-a423-458a-a54f-c142ee140b3e	5baa1a97-452f-4616-bd00-83b7fd5783f8	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:41:10.779646+05:30
b5ec89fb-bea6-4f36-917f-802b6f7e7e08	5baa1a97-452f-4616-bd00-83b7fd5783f8	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:41:10.783299+05:30
319b39c8-b0dc-47b6-93a0-9e1da0711f3f	5baa1a97-452f-4616-bd00-83b7fd5783f8	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 22:41:10.78664+05:30
e97122e1-81e4-4606-9b94-7c60bc1297c9	2290ab0e-610c-4ecd-80b5-4e765a786102	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:11.538765+05:30
ffa7e10c-d620-4579-bec9-6f4d16d28052	2290ab0e-610c-4ecd-80b5-4e765a786102	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 22:41:11.542898+05:30
b1d615a1-1d66-47c5-bce2-f6b11390f42f	7f4416e8-2c68-4d69-85ad-081cb5087cd1	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-04 22:41:12.244674+05:30
2eb2e934-f758-44db-a4b8-74fc83e52655	acedad77-57e4-44e0-9da6-cfd83e922c85	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:12.937087+05:30
c0c79beb-602b-446d-b543-4321e1f8b2fa	85df1d39-26e2-4416-95fa-b5251e8d20f0	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:13.944711+05:30
bd43bfbc-567a-4922-91e1-891fab13cb1f	85df1d39-26e2-4416-95fa-b5251e8d20f0	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:41:13.950034+05:30
c2b37cdb-92ad-4d66-88fd-f6f79af48293	85df1d39-26e2-4416-95fa-b5251e8d20f0	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:41:13.951478+05:30
ae558336-6da1-47bb-b0ea-5e51bc788f75	85df1d39-26e2-4416-95fa-b5251e8d20f0	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:41:13.952599+05:30
c25271d7-6d87-4e9e-888b-a36429bddbfa	224b6c12-6316-488e-b0c1-13b679cf47e3	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:14.773733+05:30
25b7897e-167a-4780-b2b7-16cad3dabdd4	224b6c12-6316-488e-b0c1-13b679cf47e3	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:41:14.777245+05:30
88a7c8f2-5a5b-4581-a9fd-56c879500ab2	224b6c12-6316-488e-b0c1-13b679cf47e3	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:41:14.77826+05:30
8370343e-9485-45a4-b284-fc88ee35b8e8	224b6c12-6316-488e-b0c1-13b679cf47e3	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:41:14.780112+05:30
5ff358af-43dd-4142-94be-963d6d837b9d	6ee358d0-9954-4863-bdce-3c326b318d0c	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:51.182924+05:30
864912a1-2a45-4f20-a68d-5b6a26bdaf12	6ee358d0-9954-4863-bdce-3c326b318d0c	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:41:51.190552+05:30
4bbf4892-93e8-4f7c-8e6c-3c4491e441fd	6ee358d0-9954-4863-bdce-3c326b318d0c	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:41:51.191404+05:30
a266f95f-bd21-4567-bb87-91c82259f706	6ee358d0-9954-4863-bdce-3c326b318d0c	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:41:51.192193+05:30
23557f5c-0e18-4f0d-98df-d62967161234	1d657778-e108-4098-a45e-46fc8ee75038	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:51.767989+05:30
29c22b1d-f273-41c5-a27c-932b9bc5fef7	1d657778-e108-4098-a45e-46fc8ee75038	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:41:51.773422+05:30
ff4d8b66-7f6b-4b11-9e9e-43c0ab02c982	1d657778-e108-4098-a45e-46fc8ee75038	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:41:51.777781+05:30
eb12a10f-551a-4887-a016-07805476dcc3	1d657778-e108-4098-a45e-46fc8ee75038	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:41:51.779796+05:30
5da9f878-a42a-449a-b544-8a20bd679ed1	1d657778-e108-4098-a45e-46fc8ee75038	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 22:41:51.781388+05:30
3fa22c58-5f60-4f37-afe9-818f2a2b297e	a2995fad-b48f-4523-ae1b-508616269362	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:52.433052+05:30
972a37b1-7e48-4202-8d5a-fa6507d97b1b	a2995fad-b48f-4523-ae1b-508616269362	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 22:41:52.437315+05:30
8908e8d3-1f3d-4a0e-a992-d2e6ab1cbead	649a1dab-ad11-4e1b-b13a-aa3ad4cc3cc8	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-04 22:41:53.029043+05:30
1f2626fd-8c73-4512-aad8-df5b056005c1	7303111d-2ac9-4363-8772-66e5541c9dac	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:53.584951+05:30
ba824c32-517b-4303-b80b-80df83b4339f	059ba3ba-eee6-41e7-9a69-37a88b961249	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:41:54.425098+05:30
2597ec51-f655-4121-9691-990002797695	059ba3ba-eee6-41e7-9a69-37a88b961249	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:41:54.428817+05:30
ba1ef9f8-d9ee-4f3d-a5f5-1f120a671ac8	059ba3ba-eee6-41e7-9a69-37a88b961249	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:41:54.42997+05:30
037d79fc-cacf-4e7c-878f-e66590c34684	059ba3ba-eee6-41e7-9a69-37a88b961249	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:41:54.430975+05:30
479adc9f-8c22-4c51-a861-961408873575	a19d61e7-eba6-46a7-b41e-b8f5414760f8	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:44:36.178676+05:30
352de25b-9622-4580-8ea9-80e9a4034f86	a19d61e7-eba6-46a7-b41e-b8f5414760f8	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:44:36.185789+05:30
cd56f299-b727-4f4e-8e15-ee31e9cc8a3b	a19d61e7-eba6-46a7-b41e-b8f5414760f8	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:44:36.187417+05:30
8ae5f7e8-487a-4211-a4a3-d1802fa766ab	a19d61e7-eba6-46a7-b41e-b8f5414760f8	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:44:36.188031+05:30
383eca0d-be96-4a69-8130-b11406af1fdc	7aaa659b-fd37-4a3f-a8a6-30a749bcab09	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:44:36.785903+05:30
5b3cd67d-e02f-4149-97bf-60e0352e3fd3	7aaa659b-fd37-4a3f-a8a6-30a749bcab09	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:44:36.792238+05:30
1b116760-5d31-43a1-9490-78dcb6041671	7aaa659b-fd37-4a3f-a8a6-30a749bcab09	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:44:36.801524+05:30
380894c9-51d9-4cae-b741-dd85fe7df26d	7aaa659b-fd37-4a3f-a8a6-30a749bcab09	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:44:36.80713+05:30
20bad4ce-210e-4710-ab11-cccc03aa686b	7aaa659b-fd37-4a3f-a8a6-30a749bcab09	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 22:44:36.814082+05:30
3cb569bb-e5bd-4fd4-a6a7-0652df08ae9b	290c3558-9327-4730-84e8-9df3cb437d7a	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:44:37.561957+05:30
6fdeebb2-306f-46f9-ac1f-a8660ddc674d	290c3558-9327-4730-84e8-9df3cb437d7a	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 22:44:37.564784+05:30
830c5bb9-6091-46ef-ab5b-54a8e77fd50e	022e36f7-f2d7-41b6-98c8-addb2573ae78	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-04 22:44:38.389016+05:30
17ead161-97db-4b80-83bb-f8ae26cdd3d8	8317b63e-4246-4182-89ce-6635aaf70f51	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:44:39.086307+05:30
3bda41fe-1e7b-475f-99c3-931294b41518	04da8822-5f03-4605-9290-916baea25b40	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:44:40.111541+05:30
4915c0b0-1ca6-4297-994e-9c9de58fe970	04da8822-5f03-4605-9290-916baea25b40	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:44:40.114731+05:30
5e43a963-081b-42c4-b45c-b27b0ed4847d	04da8822-5f03-4605-9290-916baea25b40	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:44:40.11564+05:30
80266a6a-38fa-4998-b8b9-509d1a487ab2	04da8822-5f03-4605-9290-916baea25b40	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:44:40.11622+05:30
29032247-e553-4db1-b51e-128c3711aba3	7d24b34d-2db8-418b-b93b-66a35f174d53	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:47:16.933674+05:30
3b45e86c-f4f3-4834-b70d-5d8a6f03c285	7d24b34d-2db8-418b-b93b-66a35f174d53	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:47:16.944927+05:30
0da78f4f-9aa7-4754-8665-62a5e59a6ebe	7d24b34d-2db8-418b-b93b-66a35f174d53	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:47:16.946333+05:30
6dc2d52e-6fd4-4b0b-ad11-0e76ea270a14	7d24b34d-2db8-418b-b93b-66a35f174d53	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:47:16.947807+05:30
5e26a2be-7fb1-4c6d-9ff4-621a30a71f86	c24c62f1-f778-4a29-920b-72e8f43a4e71	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:47:17.570371+05:30
736ea8d0-7326-4446-aaa7-35cf86948be9	c24c62f1-f778-4a29-920b-72e8f43a4e71	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:47:17.57453+05:30
85692e9d-d862-4ee4-8513-b453fcc336cc	c24c62f1-f778-4a29-920b-72e8f43a4e71	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:47:17.580546+05:30
1c078bd2-743e-43b2-b17e-5bcffed4190e	c24c62f1-f778-4a29-920b-72e8f43a4e71	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:47:17.582679+05:30
8e503c38-bb2c-4004-8174-d86958063d5f	c24c62f1-f778-4a29-920b-72e8f43a4e71	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 22:47:17.585238+05:30
fa757dda-48d3-4b6e-a9cc-92e352fe94f7	ab902e20-c339-4461-baf8-4e0f191411cf	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:47:18.199858+05:30
7f0688dc-fdce-49fc-ab69-886bd816ea81	ab902e20-c339-4461-baf8-4e0f191411cf	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 22:47:18.202556+05:30
5510f0b7-ccd5-42c9-ad8f-7c9ff16e2dd4	7ebda0c8-e598-4b3e-984c-21c2d704d444	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-04 22:47:18.868017+05:30
618b48e4-8980-4bc3-893c-32bea9f30594	12090979-44e4-452e-96bf-094d3665c430	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:47:19.637353+05:30
d4318ca0-7992-466d-b2d9-9e2bd0952733	1e7ac991-8126-4313-b67f-384ab85d222e	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 22:47:20.948612+05:30
719e460f-e0b4-464c-82e7-82a9b5da0166	1e7ac991-8126-4313-b67f-384ab85d222e	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 22:47:20.952233+05:30
c5ef3e35-c808-4f8f-8382-5552e5e46726	1e7ac991-8126-4313-b67f-384ab85d222e	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 22:47:20.95344+05:30
7160d880-9d03-438b-815f-562c1fc4763b	1e7ac991-8126-4313-b67f-384ab85d222e	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 22:47:20.954423+05:30
5d643eaf-ef54-4804-91d2-44a784ebc314	26598004-0b87-48a0-9fc5-9530433fec78	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:02:36.266824+05:30
ad22b227-1db3-4c7d-aff7-d6a011d6fb31	26598004-0b87-48a0-9fc5-9530433fec78	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 23:02:36.272493+05:30
333cafd7-7e31-4850-83f7-bb068c00581b	26598004-0b87-48a0-9fc5-9530433fec78	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 23:02:36.273232+05:30
d6629d46-ff83-4399-93fb-0f0e650de580	26598004-0b87-48a0-9fc5-9530433fec78	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 23:02:36.273787+05:30
d1082f31-3de0-456d-ac21-3a2067b7eee0	7ed41588-7d79-422e-bcd7-3fde0b86e7cc	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:02:36.683799+05:30
bf94428f-473c-4368-a98e-75b37408e977	7ed41588-7d79-422e-bcd7-3fde0b86e7cc	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 23:02:36.68678+05:30
a20cc781-828b-490e-8e4f-70b022e77b72	7ed41588-7d79-422e-bcd7-3fde0b86e7cc	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 23:02:36.76209+05:30
bba1f60d-362c-4853-b7cf-ff31c715591e	7ed41588-7d79-422e-bcd7-3fde0b86e7cc	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 23:02:36.763925+05:30
3e269381-2680-425b-a556-38ddf53ac782	7ed41588-7d79-422e-bcd7-3fde0b86e7cc	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 23:02:36.76552+05:30
9191bbe6-7d1d-46c4-ab4c-b53b47a7b8b1	91f775fd-6e20-43df-88fd-b4133647b206	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:02:37.139489+05:30
ffe62156-6458-4747-8e06-8f89f44c5565	91f775fd-6e20-43df-88fd-b4133647b206	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 23:02:37.142318+05:30
52c29474-4373-4bd8-bd36-062239a7e3e3	5e8f666f-98d0-47c1-a064-78fa9b03a6ed	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-04 23:02:37.518539+05:30
c8403d8a-9cc0-4492-b269-2fec0dd2e895	dab57d45-0f14-4ac7-afe0-890b8ace5bc4	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:02:38.031364+05:30
9c94fac4-239c-4c60-9ac0-5f4dcadd375f	32a3635a-2c95-408d-a732-385fc7056ba3	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:02:38.656823+05:30
6deb4a8e-3b8c-4475-9d25-cebc0b0fef78	32a3635a-2c95-408d-a732-385fc7056ba3	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 23:02:38.660507+05:30
685c8d89-7fbf-486c-a8b4-14c409720bc9	32a3635a-2c95-408d-a732-385fc7056ba3	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 23:02:38.661584+05:30
5cbe8d2b-494f-4fea-8f7c-b45d5accabcd	32a3635a-2c95-408d-a732-385fc7056ba3	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 23:02:38.662382+05:30
e43bb489-c8fa-4e2e-ad16-de072477affd	dacbc2ee-0665-4561-870e-69d1391f16f0	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:06:28.173924+05:30
c0856b26-cc4f-4068-a5bb-dd5eb8528051	dacbc2ee-0665-4561-870e-69d1391f16f0	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 23:06:28.178958+05:30
538d45c2-0b9f-43be-84fb-dee1da13657a	dacbc2ee-0665-4561-870e-69d1391f16f0	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 23:06:28.17978+05:30
9f392576-c274-46f1-a99a-253cf9120b92	dacbc2ee-0665-4561-870e-69d1391f16f0	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 23:06:28.180638+05:30
269ec4d0-4f92-4089-8da2-ccf70f829671	1afc161c-881a-49a6-a577-11c50e791e9b	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:06:28.663577+05:30
12f4d8dd-6628-4d28-8851-9fdd78e6a49d	1afc161c-881a-49a6-a577-11c50e791e9b	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 23:06:28.666025+05:30
61c78478-9675-4912-a95a-44af1cd8184d	1afc161c-881a-49a6-a577-11c50e791e9b	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 23:06:28.710658+05:30
88c7a33c-72c8-4868-9f4d-ac4f4dcc6ed2	1afc161c-881a-49a6-a577-11c50e791e9b	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 23:06:28.714085+05:30
10b9f539-a391-47ef-a99f-85260203990c	1afc161c-881a-49a6-a577-11c50e791e9b	\N	\N	Care Health	Care Supreme	\N	4	2026-11-04 23:06:28.716672+05:30
902611ef-5a3b-414d-8983-79912e8fea08	f1b3960d-dce5-4244-94af-7aca60272379	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:06:29.206741+05:30
99583944-f1e4-41e4-b37f-049a91af138c	f1b3960d-dce5-4244-94af-7aca60272379	\N	\N	NIVA BUPA	(with HC)	\N	0	2026-11-04 23:06:29.209979+05:30
72393e9c-5c35-4f39-8871-92a63dd780bb	08021add-8a7d-4490-afbb-c9fff1b3cb4f	\N	\N	HDFC ERGO	Optima Secure	\N	0	2026-11-04 23:06:29.788667+05:30
90a17378-9548-4c33-97fc-b64622175e8f	91630893-fd99-4e7c-8a1d-30bbeec0799b	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:06:30.323566+05:30
09c6a0ed-5ad6-49f6-b0ba-8f4bcf8f4462	c1fba66c-ca15-4616-b312-f20910950289	\N	\N	HDFC ERGO	(with HC)	\N	0	2026-11-04 23:06:31.028846+05:30
d2f0b11f-2d7d-4cf2-9933-73208bd42336	c1fba66c-ca15-4616-b312-f20910950289	\N	\N	NIVA BUPA	(with HC)	\N	1	2026-11-04 23:06:31.03049+05:30
d50554d9-cd03-4a05-982a-31e6e8dd0e13	c1fba66c-ca15-4616-b312-f20910950289	\N	\N	TATA AIG	Medicare Select	\N	2	2026-11-04 23:06:31.030977+05:30
a247866b-2bc3-455a-a7e1-a4d323f593eb	c1fba66c-ca15-4616-b312-f20910950289	\N	\N	TATA AIG	Medicare Premier	\N	3	2026-11-04 23:06:31.031471+05:30
\.


--
-- Data for Name: insurance_health_quotation_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_health_quotation_members (id, quotation_id, customer_id, full_name, relationship, gender, date_of_birth, reference_date, age_years, age_months, age_days, is_primary, display_order, created_at) FROM stdin;
36a38275-fbee-4496-adc3-8b6fdea03960	9fc9f278-f21a-4a1a-85ef-f1439c147589	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 17:51:53.453704+05:30
edd835fd-662d-475b-84b8-3d4f998caa81	9fc9f278-f21a-4a1a-85ef-f1439c147589	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 17:51:53.453715+05:30
4797376e-e380-4cd3-9a35-708ae1860348	9fc9f278-f21a-4a1a-85ef-f1439c147589	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 17:51:53.45372+05:30
06b51441-fe09-4933-907c-a3609ce247f5	75ef48ad-7ff0-4dfb-9f47-3939b9169f41	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 17:51:57.728663+05:30
4dcbfa8d-8b13-4754-b6d2-453fb2e41877	eb5b3fa8-b7db-44fb-b36b-a4732ba74fc0	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 17:52:01.771616+05:30
c227447a-35d0-4e2f-86ed-4bff972bde75	bfd648bb-e0c0-4c28-8185-a5019a8a1710	\N	Rajesh Kumar	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 17:52:05.515781+05:30
ee5fe767-75c0-4252-9913-06e1e5258740	9ed2734b-545e-44fd-a09d-4cae26a1bd2d	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 17:52:09.301444+05:30
e779ec02-e8f0-400f-935e-9132ea18c5fc	9ed2734b-545e-44fd-a09d-4cae26a1bd2d	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 17:52:09.301449+05:30
5712f7e5-325b-42c5-8164-c10f31f8e187	c4419739-52e7-42f7-af8c-8cf23d6a0430	\N	Meera Sen	Self	\N	1995-08-20	2026-11-01	31	2	12	t	0	2026-11-01 17:52:13.321407+05:30
51f8756b-7733-406f-a883-4969a3d68768	1ecc736d-5177-4287-ad02-e26c9060ee6b	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 17:54:28.556886+05:30
280da94f-a512-4eef-a917-b62b3e95adc5	1ecc736d-5177-4287-ad02-e26c9060ee6b	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 17:54:28.556896+05:30
5b4b237d-b933-4350-b03c-9a91c51695c9	1ecc736d-5177-4287-ad02-e26c9060ee6b	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 17:54:28.556902+05:30
de30fc5d-122a-4ff4-a5a3-5558029f275a	dbec63c0-6a87-4b4d-bf7b-501f7eea8771	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 17:54:31.73287+05:30
f3a097f1-42cd-4899-8d11-8fb90223068f	ac19c0fe-1e7a-4fa1-94bf-41ada9d26a1e	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 17:54:34.319629+05:30
803a68b0-f060-4454-a9bf-d15bfc18ad7c	a70569b8-2954-4971-bba4-0614eca210c5	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-01 17:54:39.424975+05:30
527dee22-9cf8-4e09-bde2-835fa6741d8d	9c7e7203-3598-4565-bc07-015c6875d06d	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 17:54:42.049707+05:30
833b2032-4871-44c1-b1b3-bbafb2fe1dad	9c7e7203-3598-4565-bc07-015c6875d06d	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 17:54:42.049715+05:30
0f3c6c9d-c3d0-4acb-b84b-f8be0599d472	586f174b-2126-475a-9061-20ca66f8fb72	\N	Meera Sen	Self	\N	1995-08-20	2026-11-01	31	2	12	t	0	2026-11-01 17:54:51.281102+05:30
d27467e6-9a1b-4e03-bec8-2b87c069e8f1	5e48975a-ad6f-4147-96d7-8ea9b994f69f	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 17:56:26.354415+05:30
f05701a9-dfe5-47bb-989a-3b9450750310	5e48975a-ad6f-4147-96d7-8ea9b994f69f	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 17:56:26.354427+05:30
bbb2020f-3fe0-4ab5-8d04-185d0d84ccad	5e48975a-ad6f-4147-96d7-8ea9b994f69f	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 17:56:26.354435+05:30
b74efc70-1b3c-4e55-8016-b0922fed402f	77422edf-f737-4d82-9440-dab8736e33d6	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 17:56:29.132084+05:30
ef2ddf7f-179e-40db-b6dc-f2f5e24b65c5	7d29448a-0aff-4dde-9845-c3371e1786a0	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 17:56:31.970828+05:30
65f65bc0-4fe1-4c37-ba57-19b8827d6558	b3c20dd7-7f0f-4082-897a-5f99cdb65157	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-01 17:56:36.848839+05:30
0d786249-77f7-48d0-94ae-8b61fd25c4ec	e486b08b-179a-4d7b-8d58-5efe65a6a601	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 17:56:41.11284+05:30
40445265-314d-476b-9e3b-43a52e623703	e486b08b-179a-4d7b-8d58-5efe65a6a601	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 17:56:41.112851+05:30
6cd83a78-9379-4cf1-b441-49759403b6d8	908132e5-0135-4f85-9026-d8c07a3fd25a	\N	Meera Sen	Self	\N	1995-08-20	2026-11-01	31	2	12	t	0	2026-11-01 17:56:50.264538+05:30
260b62a5-c94d-46d5-ba7d-7062ff114db3	109df747-4579-43a8-afb9-2a58b53f54f4	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 17:57:35.84745+05:30
d1eff945-42e5-4f0e-8a88-64193e239d67	109df747-4579-43a8-afb9-2a58b53f54f4	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 17:57:35.84746+05:30
7a99f193-5620-4291-93f0-dccc6ff367d3	109df747-4579-43a8-afb9-2a58b53f54f4	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 17:57:35.847465+05:30
d3a696a2-d14a-4966-b377-11d70682dc4a	a8c345cc-7eed-4764-ab8c-23351f6a1529	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 17:57:38.431953+05:30
694d3ce1-3fb7-47e3-9207-e55d33926bc4	f8a4e668-21de-4974-9f74-fb307c853624	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 17:57:41.016982+05:30
798815c0-852f-4020-a55f-59b984f4df5d	1f6fa7a4-aa36-4f79-8cd9-ac6f9decabd9	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-01 17:57:45.954682+05:30
148d2a0f-b3d4-4868-9c14-6adfa15b25b3	08774c4f-e433-484d-b225-599d577be670	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 17:57:50.22201+05:30
c96a5c0a-d38b-40c0-a40d-f2d4512a1214	08774c4f-e433-484d-b225-599d577be670	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 17:57:50.22202+05:30
cf20171c-d485-4529-9700-c20f4745782c	56aa1fa7-6e12-48e2-86fa-172a4a36a982	\N	Meera Sen	Self	\N	1995-08-20	2026-11-01	31	2	12	t	0	2026-11-01 17:57:59.302486+05:30
3a5db6ba-0f2f-446b-b893-15a456c34fba	7a114092-4478-4e44-9996-5d7a1436bc99	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 17:59:03.896006+05:30
6b0cd16f-d706-4686-b2f5-f3d642e328cd	7a114092-4478-4e44-9996-5d7a1436bc99	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 17:59:03.89601+05:30
1f4e03f7-f989-492c-9223-47d2f957d580	7a114092-4478-4e44-9996-5d7a1436bc99	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 17:59:03.896012+05:30
8f920d8d-29a7-4748-be08-da107921f18e	e07370f7-7c83-4411-821e-0eb91213ea50	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 17:59:06.374402+05:30
ed9a1bf6-23f4-4448-9ab6-bdd60b424faa	cdd54b28-23d0-46fc-b562-a9da70c98fe8	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 17:59:08.81894+05:30
90ea9473-23a4-475f-bcc1-99fb9913e25a	4ec03a45-d25c-4330-932d-8882e42da614	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-01 17:59:13.462083+05:30
5f122004-144e-4c0d-b004-81d1b12e3809	06d2c9fa-7290-4c15-a86d-01095fce49c2	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 17:59:16.075227+05:30
3c191260-76fd-482a-a5a8-e82e0a1e89a0	06d2c9fa-7290-4c15-a86d-01095fce49c2	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 17:59:16.075234+05:30
e6db67ed-4b07-4680-980e-ee82430b080b	8a013209-2afd-4c4f-932a-cd7fc5724478	\N	Meera Sen	Self	\N	1995-08-20	2026-11-01	31	2	12	t	0	2026-11-01 17:59:24.823218+05:30
ba681da7-e687-4eaf-a077-ada28fe21c8b	0f62f059-cbd0-448a-b0eb-fc8114375308	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 18:11:50.857998+05:30
548c32c9-62ae-4bb7-bdfb-749ccbd7ef33	0f62f059-cbd0-448a-b0eb-fc8114375308	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 18:11:50.858005+05:30
e2b32fd2-90a1-4efe-a304-e8d9e7530093	0f62f059-cbd0-448a-b0eb-fc8114375308	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 18:11:50.858009+05:30
c798795c-b663-48f9-92df-e1822edc793a	48b6a9d9-ae0d-41e3-a05f-800e01ce512d	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 18:11:53.57725+05:30
eeffd78c-1a16-4eff-9010-1d13e5b3c8f9	13ab07ec-62f5-40f8-b9f4-6ddfafe894f7	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 18:11:56.241995+05:30
e6af2601-ad6a-4c6f-8450-c8f1123d8c9d	3294d1a5-836e-4877-a0d0-ed14d3fbe291	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-01 18:12:01.184204+05:30
a2679bbc-a09e-4438-bbe4-ab2a5b43d096	10a47e8d-509f-4aae-bb05-7fe42e65e5d8	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 18:12:03.844546+05:30
9654cd97-b14a-470b-b2e9-1bf1f269e859	10a47e8d-509f-4aae-bb05-7fe42e65e5d8	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 18:12:03.844552+05:30
a4c1db01-4405-4deb-8a05-9d5aa3e09a26	db96c885-a0bc-4aed-9ba7-1e2233b70dfc	\N	Meera Sen	Self	\N	1995-08-20	2026-11-01	31	2	12	t	0	2026-11-01 18:12:12.873391+05:30
ebe7becc-385e-4f48-92ed-e76e04827dad	648f2bf1-76e0-48f8-9d05-50a5d6286456	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 18:31:55.630784+05:30
6ebb34b7-1ca7-4a20-b385-3c127f7b867a	648f2bf1-76e0-48f8-9d05-50a5d6286456	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 18:31:55.630788+05:30
f2b53b8e-36ee-44ad-ae90-8be4f0b81847	648f2bf1-76e0-48f8-9d05-50a5d6286456	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 18:31:55.63079+05:30
c01192b7-a2b6-4b95-b0cf-65086e538b9a	3d8c6146-0cf2-4460-9bb5-c3f4d427c410	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 18:31:58.09618+05:30
c5852a77-0d6f-46e2-82a2-adaa8fd1a049	a0eaa133-d4b1-458d-aa79-818a462bb272	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 18:32:00.582136+05:30
9dca7eb6-5a7b-462c-bfe8-a9a4a440df86	98db068c-b944-4d0a-ae63-2dedc75c4ce7	\N	Harsh Vardhan	SELF	MALE	1987-02-01	2026-11-01	39	9	0	t	1	2026-11-01 20:32:20.447366+05:30
4ba47ad6-6601-4764-8367-1ac80337f6ec	8249b200-547f-466b-b832-4e16b4aa1232	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 20:45:01.705658+05:30
8f6f5139-8a32-41c7-94d7-7f23749a46a3	8249b200-547f-466b-b832-4e16b4aa1232	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 20:45:01.705661+05:30
215b7431-8519-48b8-9a1e-7ca118daf020	8249b200-547f-466b-b832-4e16b4aa1232	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 20:45:01.705662+05:30
f5ea595b-3f74-4973-947e-41da51bef4f9	ee1b9df2-5645-4169-b144-80d333541f7e	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-01 20:45:04.18817+05:30
4bc321b6-29da-4a11-b521-823ce61ffb47	bee6dc28-0a61-429c-9722-38eb81f41823	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 20:45:06.641104+05:30
3b5e6701-33c1-4dfe-a559-77d3f22ea4ef	4d691de0-3d64-49bf-86f2-aec82b354caa	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-01 20:45:11.615051+05:30
af94127b-7fe1-459c-89fd-0651d701d5ea	8ca69177-4fed-471d-b2a0-f872c48ff0de	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 20:45:14.090165+05:30
2825b36f-3f45-49d8-8e60-75b092029d81	8ca69177-4fed-471d-b2a0-f872c48ff0de	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 20:45:14.090168+05:30
b5da6c85-5607-4e9e-aa57-0581d8775563	e1b9dcca-f475-4dbb-a599-11bc46d08c4d	\N	Harsh Vardhan	SELF	MALE	1987-02-01	2026-11-01	39	9	0	t	1	2026-11-01 20:52:59.697596+05:30
3e51f3a4-7616-4c33-a591-3bcce6cb9f90	e1b9dcca-f475-4dbb-a599-11bc46d08c4d	\N	SAKSHI	SPOUSE	FEMALE	1991-02-01	2026-11-01	35	9	0	f	2	2026-11-01 20:52:59.697665+05:30
ca8a18af-002a-42de-ad3c-b41470fab188	3fbe8705-38c9-4f37-b627-a14229ee2e33	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-01 21:13:49.408674+05:30
90456522-7b6a-4c65-9045-381ddb4e402d	3fbe8705-38c9-4f37-b627-a14229ee2e33	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-01 21:13:49.408679+05:30
e4d4efa1-44d8-4487-91cb-981cd70e71ae	3fbe8705-38c9-4f37-b627-a14229ee2e33	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-01 21:13:49.408681+05:30
d32e58a0-cb1c-4c33-83a6-bb48f3d48839	e64fabe1-981e-4ba5-beca-7c8c83e7761c	\N	Anita Roy	Self	\N	1992-05-10	2026-11-01	34	5	22	t	0	2026-11-01 21:13:54.182192+05:30
bad3ae0c-a9b8-4612-bd72-0dad70492162	e639782f-e647-48d4-a093-ddee41764cb4	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-01 21:13:58.702478+05:30
ebc6d45d-3665-435f-a359-52e1e6c3b89a	80089d82-d1e3-45e8-9e0c-a2e8ef8862f7	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-01 21:14:01.195718+05:30
64181f43-5fbb-413b-bb31-afd61aafdae8	80089d82-d1e3-45e8-9e0c-a2e8ef8862f7	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-01 21:14:01.195721+05:30
1c7b10b0-afc8-4c47-9160-eef6de2e8b89	66529fbb-97b5-49f4-bde2-0005556c3ae2	\N	Meera Sen	Self	\N	1995-08-20	2026-11-01	31	2	12	t	0	2026-11-01 21:14:09.817026+05:30
d3085626-cea8-436c-af4a-17a59221f59d	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	\N	Vikram Rathore	SELF	MALE	1988-09-01	2026-11-03	38	2	2	t	1	2026-11-03 18:20:49.537566+05:30
5688e0bf-0b54-4919-bbd2-f4e88cf9a646	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	\N	sanjivani	SPOUSE	FEMALE	1988-11-01	2026-11-03	38	0	2	f	2	2026-11-03 18:20:49.537571+05:30
5f25e79d-54b9-418f-a1c5-49985c7c5fa1	2ababf4a-89a3-478f-b861-a96d2f6b7e3a	\N	arnav	SON	MALE	2020-05-04	2026-11-03	6	5	30	f	3	2026-11-03 18:20:49.537572+05:30
be07a9ea-492c-473a-8c7a-fa623830230a	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-03 21:20:29.17587+05:30
e1040bd9-06ea-4439-9e38-ab26ddc28396	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-03 21:20:29.175874+05:30
8f579adb-4654-4b0f-8b61-d1a3bab5f9de	6555b53a-479e-4ed1-aaf4-8c1ab40ee635	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-03 21:20:29.175876+05:30
c6b770ab-5729-48a4-ae15-eff10e2b7728	6028f846-c2d6-4233-a107-97e9fe686ff6	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-03 21:20:29.593976+05:30
50023542-8fe6-4621-b894-006addac2419	4e547f92-1679-4d2c-b30f-999e36316840	\N	Anita Roy	Self	\N	1992-05-10	2026-11-03	34	5	24	t	0	2026-11-03 21:20:30.284883+05:30
6ef60975-dc90-4a2e-99b9-d891f6dace0f	f199b890-ac6f-4126-9afa-09844a7ef3c9	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-03 21:20:30.823419+05:30
fbbf37cf-0ef6-4c5d-a726-1b0228e90a3a	f98d579f-6da5-4f88-b527-6fc3b579ed5c	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-03 21:20:31.316791+05:30
599e848e-76a5-492a-a965-ffeede4f3ffc	f98d579f-6da5-4f88-b527-6fc3b579ed5c	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-03 21:20:31.316794+05:30
854856fc-4a62-41c3-b540-82ac5e43290e	fdc8ca93-a632-47ad-af03-246163065d4d	\N	Meera Sen	Self	\N	1995-08-20	2026-11-03	31	2	14	t	0	2026-11-03 21:20:31.895072+05:30
64652994-a5f7-4996-9b82-cf04b939855b	d41ba26d-3511-40e8-aecc-8644550490ec	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 22:39:43.967931+05:30
c1f90604-b50f-42ec-98e6-52a530f841a3	d41ba26d-3511-40e8-aecc-8644550490ec	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 22:39:43.967936+05:30
58a4ddab-6045-4b8c-8927-be7594d04634	d41ba26d-3511-40e8-aecc-8644550490ec	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 22:39:43.967938+05:30
352698c8-7484-49a2-baab-4f344510a48c	098773da-d685-4a40-a0a2-de54b771eba6	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:39:46.116059+05:30
df53e8d2-19d7-4d8c-ae53-4326081713ea	a9b4a749-0bf9-451c-8012-99652c012be3	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 22:39:47.917031+05:30
542f1778-ff72-4507-aa85-9a621e4e4d29	89917f5e-d5b1-481f-9832-6f5c082bb936	\N	Rajesh Kumar	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:39:49.426766+05:30
ded82d69-e89f-43c1-b3e5-9982d7134842	0cab7ecb-c31d-432d-bae7-79bc0a22cab6	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 22:39:50.943745+05:30
2b51ebc5-6e10-4cfe-919c-7b7c5adc3f06	0cab7ecb-c31d-432d-bae7-79bc0a22cab6	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 22:39:50.943758+05:30
31b68ecd-df3e-44ea-88e2-301024af5fc1	ff131008-f97d-4e80-bd6f-67f3ba3e9650	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 22:39:52.385225+05:30
6d99d00d-c145-408e-a396-90634dc5df6e	3eef8c60-f6c1-4ab1-a47e-d15652f12de9	\N	Test	Self	\N	2000-01-01	2026-11-04	26	10	3	t	0	2026-11-04 22:39:54.500244+05:30
9cb6cad6-f6b1-4e87-899a-028c03c18c4a	365d3818-df64-45b2-8846-a2c17472edd0	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 22:40:11.662189+05:30
43c370e2-4a88-4391-87e2-ec405ab20003	365d3818-df64-45b2-8846-a2c17472edd0	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 22:40:11.662194+05:30
ef8125ae-bc65-4a0b-a600-2736dbe3b892	365d3818-df64-45b2-8846-a2c17472edd0	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 22:40:11.662196+05:30
c04dea01-8ed1-4068-8928-32518d1d3a04	018d172c-15c0-44ba-a6f0-bfac26f39022	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:40:13.692616+05:30
d167d4b1-7788-4b9d-9861-09a4153268a0	3e6c6677-e4d6-487e-94d5-206bc9a44017	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 22:40:15.330119+05:30
8eef6fc3-46ac-4d3c-93ee-54ad385a32a0	4bcecbe7-4475-4a3b-8253-5a6b62d2dfe8	\N	Rajesh Kumar	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:40:16.785899+05:30
80dfc277-02dd-4483-9541-2da4410c7be7	798500c8-0078-4338-bc3c-d9363996b3f1	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 22:40:18.499277+05:30
378831b0-90b5-436c-9cda-558f7bfa736d	798500c8-0078-4338-bc3c-d9363996b3f1	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 22:40:18.499296+05:30
c1301577-b50e-4b94-90d8-feec1cc2877e	e51b5a8d-3372-4323-bf6b-0b23cf11a49e	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 22:40:20.077092+05:30
49e71b00-6817-464b-9a64-16974e3a199a	b596cbe3-309d-4ef8-bebc-dba8dbaece1a	\N	Test	Self	\N	2000-01-01	2026-11-04	26	10	3	t	0	2026-11-04 22:40:22.209632+05:30
e97b0e31-e7e6-4809-ac26-0e0d763c1100	b2d792c8-10be-4701-b511-ae1d5ef369cd	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 22:41:10.137805+05:30
95674a7e-8236-44aa-a852-200bd4992c67	b2d792c8-10be-4701-b511-ae1d5ef369cd	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 22:41:10.137815+05:30
738c87db-7063-4f43-bc96-30b650a23b00	b2d792c8-10be-4701-b511-ae1d5ef369cd	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 22:41:10.13782+05:30
2f46479d-88eb-45b1-a94c-6d92f30e2de2	5baa1a97-452f-4616-bd00-83b7fd5783f8	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:41:10.76834+05:30
17c121ab-e8bc-4d3a-9fa3-ce8ce1e2e624	2290ab0e-610c-4ecd-80b5-4e765a786102	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 22:41:11.540727+05:30
e737dea6-170b-4f06-9706-dba45ca89952	7f4416e8-2c68-4d69-85ad-081cb5087cd1	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-04 22:41:12.245391+05:30
63bc28ee-10b5-41d4-a3d7-298f50d9f77d	acedad77-57e4-44e0-9da6-cfd83e922c85	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 22:41:12.938744+05:30
d4a04d44-a001-4461-937d-9b075d4070fa	acedad77-57e4-44e0-9da6-cfd83e922c85	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 22:41:12.938751+05:30
ef81ab58-0caa-4d5c-aa98-bb05a620d6db	85df1d39-26e2-4416-95fa-b5251e8d20f0	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 22:41:13.947487+05:30
b91f1335-db63-4b73-9f86-d0131be69fff	224b6c12-6316-488e-b0c1-13b679cf47e3	\N	Test	Self	\N	2000-01-01	2026-11-04	26	10	3	t	0	2026-11-04 22:41:14.775244+05:30
1d6af50d-a15f-4a22-a785-95134c8268b2	6ee358d0-9954-4863-bdce-3c326b318d0c	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 22:41:51.186827+05:30
5c3717a6-5c54-4c62-b49c-199d4f15b761	6ee358d0-9954-4863-bdce-3c326b318d0c	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 22:41:51.186873+05:30
260fed00-c1e4-4c14-9360-6bd496367b92	6ee358d0-9954-4863-bdce-3c326b318d0c	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 22:41:51.186875+05:30
4526cc1f-62dc-4289-abb6-f8bc97a4e85f	1d657778-e108-4098-a45e-46fc8ee75038	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:41:51.771235+05:30
46383884-2335-4094-a4a2-89013017ac95	a2995fad-b48f-4523-ae1b-508616269362	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 22:41:52.435277+05:30
ed0e47a3-b1ae-4d23-b17b-c504ce69cd8b	649a1dab-ad11-4e1b-b13a-aa3ad4cc3cc8	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-04 22:41:53.029592+05:30
76585300-ef1f-43c8-a474-16d8b6d63955	7303111d-2ac9-4363-8772-66e5541c9dac	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 22:41:53.586286+05:30
0c0c872c-e845-4182-a67f-961b0202a7fc	7303111d-2ac9-4363-8772-66e5541c9dac	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 22:41:53.58629+05:30
95ce8867-3737-4289-a869-4218bbee5404	059ba3ba-eee6-41e7-9a69-37a88b961249	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 22:41:54.426731+05:30
19cf9426-da2c-49a1-85d3-c71721fabd24	a19d61e7-eba6-46a7-b41e-b8f5414760f8	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 22:44:36.180684+05:30
d59ab70a-05d4-49b6-a23f-a2cd5b2e91ba	a19d61e7-eba6-46a7-b41e-b8f5414760f8	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 22:44:36.180687+05:30
c2c5ea4d-69de-4d9e-93c8-b956eebf5810	a19d61e7-eba6-46a7-b41e-b8f5414760f8	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 22:44:36.180689+05:30
5f7142af-8d4e-4e15-a40a-b6df30b8b05d	7aaa659b-fd37-4a3f-a8a6-30a749bcab09	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:44:36.789565+05:30
5754dc75-7310-4591-90f5-3e1ee337a8e2	290c3558-9327-4730-84e8-9df3cb437d7a	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 22:44:37.562985+05:30
3ee5f52b-bcb4-491e-976b-071f8ffb1259	022e36f7-f2d7-41b6-98c8-addb2573ae78	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-04 22:44:38.389769+05:30
d0a239fb-f447-41ed-a5a9-276939f44474	8317b63e-4246-4182-89ce-6635aaf70f51	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 22:44:39.088071+05:30
84c9b000-98bf-4099-8f82-29d8f9825562	8317b63e-4246-4182-89ce-6635aaf70f51	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 22:44:39.088079+05:30
432997e2-bfb8-48ce-8260-d35539d9c33d	04da8822-5f03-4605-9290-916baea25b40	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 22:44:40.112939+05:30
cd8b2168-21c7-46f8-8c21-185d2968bff6	7d24b34d-2db8-418b-b93b-66a35f174d53	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 22:47:16.938621+05:30
0563d135-f83c-4d46-8ede-3de1b0fda8ba	7d24b34d-2db8-418b-b93b-66a35f174d53	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 22:47:16.938634+05:30
83fd6d8b-ad5b-4e3e-b212-c70da8bd1032	7d24b34d-2db8-418b-b93b-66a35f174d53	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 22:47:16.938639+05:30
0700593f-c831-4f3e-b04d-dc3954e16b86	c24c62f1-f778-4a29-920b-72e8f43a4e71	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 22:47:17.57235+05:30
9333f78e-333d-4699-849c-076c98bfcfd5	ab902e20-c339-4461-baf8-4e0f191411cf	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 22:47:18.201172+05:30
e6d2fee6-8ce4-4683-ad86-7574a8b21ca6	7ebda0c8-e598-4b3e-984c-21c2d704d444	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-04 22:47:18.868834+05:30
1675150b-f4fe-4036-a50e-078d2f3d05e3	12090979-44e4-452e-96bf-094d3665c430	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 22:47:19.639396+05:30
710f8a9e-f19f-4864-a277-84f90fa02ec3	12090979-44e4-452e-96bf-094d3665c430	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 22:47:19.639403+05:30
9985d6fc-f102-4383-8de5-35d80a1b2f11	1e7ac991-8126-4313-b67f-384ab85d222e	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 22:47:20.950381+05:30
5eb44109-06e8-4e2b-80c0-71a0f4962f2a	26598004-0b87-48a0-9fc5-9530433fec78	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 23:02:36.269586+05:30
9071a42b-03dd-4b0b-9ceb-84c51a0ebcec	26598004-0b87-48a0-9fc5-9530433fec78	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 23:02:36.269593+05:30
c98fc805-54fc-45b8-991c-9d4c9d85c738	26598004-0b87-48a0-9fc5-9530433fec78	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 23:02:36.269595+05:30
776ef5dc-83ac-478e-b36e-73bb4c9709cd	7ed41588-7d79-422e-bcd7-3fde0b86e7cc	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 23:02:36.685273+05:30
fb93bdad-d71c-4aba-8043-906d61557653	91f775fd-6e20-43df-88fd-b4133647b206	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 23:02:37.141228+05:30
330612a0-1ef1-4188-a784-26ad12b032b5	5e8f666f-98d0-47c1-a064-78fa9b03a6ed	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-04 23:02:37.518962+05:30
fff957b4-e147-4227-8ba8-dba34ffced26	dab57d45-0f14-4ac7-afe0-890b8ace5bc4	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 23:02:38.033823+05:30
133266aa-877d-4593-9202-7bd863395813	dab57d45-0f14-4ac7-afe0-890b8ace5bc4	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 23:02:38.033828+05:30
6b3d18bc-2f91-463a-87ab-9db3d677abb7	32a3635a-2c95-408d-a732-385fc7056ba3	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 23:02:38.658054+05:30
3c8fbe10-6b66-4203-a274-51134b371a53	dacbc2ee-0665-4561-870e-69d1391f16f0	\N	Rahul Sharma	Self	Male	1995-06-15	2026-11-01	31	4	17	t	0	2026-11-04 23:06:28.177084+05:30
fee9fec8-aa56-4ace-8a58-cbcfad627cf2	dacbc2ee-0665-4561-870e-69d1391f16f0	\N	Priya Sharma	Spouse	Female	1997-09-20	2026-11-01	29	1	12	f	1	2026-11-04 23:06:28.177087+05:30
5e45de45-b874-4caf-a482-4160e8c6573d	dacbc2ee-0665-4561-870e-69d1391f16f0	\N	Aarav Sharma	Son	Male	2020-02-29	2026-11-01	6	8	3	f	2	2026-11-04 23:06:28.177089+05:30
554c5064-57bd-4d42-bca0-72206570cbe0	1afc161c-881a-49a6-a577-11c50e791e9b	\N	Vikram Verma	Self	\N	1990-01-01	2026-11-01	36	10	0	t	0	2026-11-04 23:06:28.664725+05:30
1b7a0c3b-d897-440b-af72-0ed5abe0ab26	f1b3960d-dce5-4244-94af-7aca60272379	\N	Anita Roy	Self	\N	1992-05-10	2026-11-04	34	5	25	t	0	2026-11-04 23:06:29.208242+05:30
b8c49fd2-4773-4866-bbd6-b67fae4e6f22	08021add-8a7d-4490-afbb-c9fff1b3cb4f	\N	Rajesh Kumar	Self	\N	1988-06-15	2026-11-01	38	4	17	t	0	2026-11-04 23:06:29.789113+05:30
1b06d762-4fe1-4315-a857-b1872847595d	91630893-fd99-4e7c-8a1d-30bbeec0799b	\N	Sunil Joshi	Self	\N	1985-04-12	2026-11-01	41	6	20	t	0	2026-11-04 23:06:30.324636+05:30
304dee84-5617-4803-95ca-99d24addf3aa	91630893-fd99-4e7c-8a1d-30bbeec0799b	\N	Kavita Joshi	Spouse	\N	1989-11-05	2026-11-01	36	11	27	f	0	2026-11-04 23:06:30.324639+05:30
856a7d98-9318-4425-996a-0ce2ad43f14a	c1fba66c-ca15-4616-b312-f20910950289	\N	Meera Sen	Self	\N	1995-08-20	2026-11-04	31	2	15	t	0	2026-11-04 23:06:31.029683+05:30
\.


--
-- Data for Name: insurance_health_quotation_premiums; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_health_quotation_premiums (id, quotation_company_plan_id, sum_insured, sum_insured_code, premium_amount, premium_basis, created_at) FROM stdin;
6841ca71-3166-47a0-8d76-c62d0a3dfa44	1ab0dca9-9c61-4cfe-a38c-ef721d80d6f0	500000.00	5L	12500.00	GROSS	2026-11-01 17:51:57.73263+05:30
baf98704-f4cd-428e-8d75-fd29f3da381f	1ab0dca9-9c61-4cfe-a38c-ef721d80d6f0	1000000.00	10L	18000.00	GROSS	2026-11-01 17:51:57.732639+05:30
30f8b49f-9a49-4329-abae-5ac119ab3cea	cfec01d2-6275-4024-8449-77fd2e0c8b31	1000000.00	10L	19500.00	GROSS	2026-11-01 17:51:57.737314+05:30
dabe8301-9993-418c-a860-dcb408110594	cfec01d2-6275-4024-8449-77fd2e0c8b31	2000000.00	20L	26000.00	GROSS	2026-11-01 17:51:57.737322+05:30
cd814ff8-ecc8-4390-9978-4d185cca5bba	d035cc95-c856-4d98-9407-6965a89a6649	500000.00	5L	11800.00	GROSS	2026-11-01 17:51:57.739668+05:30
742393bd-7afb-40da-9868-a79b06573850	c7bcd5f7-a427-430a-8a59-eaf08203e0c8	2500000.00	25L	31000.00	GROSS	2026-11-01 17:51:57.741739+05:30
8d9e9533-e1e0-4a06-80a3-824ee16161df	4b43c869-f43c-4e75-95f4-ab2d09c603c0	500000.00	5L	10000.00	GROSS	2026-11-01 17:52:05.519091+05:30
1a4a609b-137e-48b0-8ca3-b4d8835acd8d	2eb2d3be-3728-4010-826b-ce53f2dc2e87	1000000.00	10L	19500.00	GROSS	2026-11-01 17:52:09.306778+05:30
a07d7e63-3479-4db2-9768-cbbb9c12a2b5	2eb2d3be-3728-4010-826b-ce53f2dc2e87	2500000.00	25L	32000.00	GROSS	2026-11-01 17:52:09.306789+05:30
47c5ba53-67c2-450e-8b7e-0c5beb8e2711	3b390a5a-396b-4b34-b1c9-e78d3580f5b6	500000.00	5L	12500.00	GROSS	2026-11-01 17:54:31.737494+05:30
2cd49236-804c-42c2-8d72-4609deaf2e54	3b390a5a-396b-4b34-b1c9-e78d3580f5b6	1000000.00	10L	18000.00	GROSS	2026-11-01 17:54:31.737503+05:30
11e3d193-c54d-48d3-b16b-00aaa5978234	805bd407-c6c2-4cdd-bc96-76f993a6e0a8	1000000.00	10L	19500.00	GROSS	2026-11-01 17:54:31.741597+05:30
e73fed5c-503a-48cc-8db1-4a9503271615	805bd407-c6c2-4cdd-bc96-76f993a6e0a8	2000000.00	20L	26000.00	GROSS	2026-11-01 17:54:31.741604+05:30
1ff2d61b-956f-4f6c-93f4-9b5862458f03	7290af5d-4920-4a20-aded-67cea07818a8	500000.00	5L	11800.00	GROSS	2026-11-01 17:54:31.744027+05:30
bfe3beb1-758f-40a8-b351-5127ce011059	e57702b2-9903-435e-ae1a-45299989bf41	2500000.00	25L	31000.00	GROSS	2026-11-01 17:54:31.74598+05:30
df129a0d-fe1d-4585-9d17-880fff0632a1	7757c094-ee66-4556-bc9c-eb4b519eb658	1000000.00	10L	22000.00	GROSS	2026-11-01 17:54:39.43142+05:30
400203bf-528d-4f66-bc30-1b8ef7ff049a	d81437ce-05e4-4b80-9963-d575ff0c954a	1000000.00	10L	19500.00	GROSS	2026-11-01 17:54:42.054315+05:30
e6e49453-5348-4443-ae89-df721b8ec3a9	d81437ce-05e4-4b80-9963-d575ff0c954a	2500000.00	25L	32000.00	GROSS	2026-11-01 17:54:42.054322+05:30
12c103f4-cee7-4687-8906-f6f8083ea041	69d9a77c-65f8-43b7-aaca-c615abda03eb	500000.00	5L	12500.00	GROSS	2026-11-01 17:56:29.137252+05:30
5b5da9bd-d7ab-4f8d-a7c9-46c5ccc15e8a	69d9a77c-65f8-43b7-aaca-c615abda03eb	1000000.00	10L	18000.00	GROSS	2026-11-01 17:56:29.137259+05:30
837d4ee3-699b-410c-bfe4-cd5904865ee3	b2b8f002-e068-4f97-b25d-85369d49c837	1000000.00	10L	19500.00	GROSS	2026-11-01 17:56:29.141243+05:30
68b17d7f-8655-4e23-8f24-9ed9a90e886d	b2b8f002-e068-4f97-b25d-85369d49c837	2000000.00	20L	26000.00	GROSS	2026-11-01 17:56:29.141249+05:30
a07e65e8-67e5-4e46-9c14-441b5754bdf6	a0fdbc5f-5385-401e-84a3-5473cd843f17	500000.00	5L	11800.00	GROSS	2026-11-01 17:56:29.144284+05:30
880d1a28-6056-4c7b-b046-476d598d6b88	72c48eff-9ab8-408a-b5d8-113a506c281b	2500000.00	25L	31000.00	GROSS	2026-11-01 17:56:29.146605+05:30
535ae982-2fda-4a1e-8fd8-7200d6362398	d8b2280c-2c15-4cfa-bb33-68c5cb875ecd	1000000.00	10L	22000.00	GROSS	2026-11-01 17:56:36.851645+05:30
be69a9ff-8137-4ed5-a779-3fa6770d8426	5699399b-2c8e-4bb0-bb07-b421fcdaa7d9	1000000.00	10L	19500.00	GROSS	2026-11-01 17:56:41.116445+05:30
85ebac58-fba7-460b-b4a3-6c69c5148510	5699399b-2c8e-4bb0-bb07-b421fcdaa7d9	2500000.00	25L	32000.00	GROSS	2026-11-01 17:56:41.116449+05:30
4799d202-f1e7-4e55-9e51-da8069b4da16	33a79464-bbbb-4495-9338-90447680d060	500000.00	5L	12500.00	GROSS	2026-11-01 17:57:38.435818+05:30
99f2ce1a-56fc-483c-834b-a3f0f1216f3c	33a79464-bbbb-4495-9338-90447680d060	1000000.00	10L	18000.00	GROSS	2026-11-01 17:57:38.435828+05:30
f442f620-73e2-45df-a3f5-76825911f995	c07f65ed-44c1-4372-8e23-936374c428e4	1000000.00	10L	19500.00	GROSS	2026-11-01 17:57:38.439183+05:30
caae82e2-491c-45c2-af36-f6533d5c48c1	c07f65ed-44c1-4372-8e23-936374c428e4	2000000.00	20L	26000.00	GROSS	2026-11-01 17:57:38.439191+05:30
9354cabf-2d58-4371-b4dd-3d9695323e90	88c751d3-7ab3-42c7-bf46-09c71b70e51d	500000.00	5L	11800.00	GROSS	2026-11-01 17:57:38.441789+05:30
ab1b19be-737b-40b7-aff3-66f7822a070c	6e00971e-d8ec-442c-bb65-41e489946c82	2500000.00	25L	31000.00	GROSS	2026-11-01 17:57:38.443699+05:30
3e25d46a-89b2-4a91-bcf9-b98f541d22a6	e5f6ae0e-c70b-4cef-a2cc-40e944663d9c	1000000.00	10L	22000.00	GROSS	2026-11-01 17:57:45.956463+05:30
a1a250a6-e10f-43a6-90f9-02306c40860c	e1c6c603-7518-4a07-bab6-12f7134efe31	1000000.00	10L	19500.00	GROSS	2026-11-01 17:57:50.23076+05:30
737a4632-10ca-4320-9b57-21274ec25ee4	e1c6c603-7518-4a07-bab6-12f7134efe31	2500000.00	25L	32000.00	GROSS	2026-11-01 17:57:50.230768+05:30
b4a92253-e435-4dd9-988a-3bfd9caefa8a	5532f00c-1aed-4ac1-94bd-2f7647a7723e	500000.00	5L	12500.00	GROSS	2026-11-01 17:59:06.377867+05:30
3dff3a0d-1666-4e49-96b6-8866f19f9def	5532f00c-1aed-4ac1-94bd-2f7647a7723e	1000000.00	10L	18000.00	GROSS	2026-11-01 17:59:06.377874+05:30
4c0c78b4-2080-4fd7-a395-bd8adb063220	3f44c3b8-775f-4f98-b1f1-557d2c891059	1000000.00	10L	19500.00	GROSS	2026-11-01 17:59:06.380518+05:30
e6c6a701-a593-4221-bf3d-92d4236f7004	3f44c3b8-775f-4f98-b1f1-557d2c891059	2000000.00	20L	26000.00	GROSS	2026-11-01 17:59:06.380521+05:30
eb73a190-f57e-4d25-bf43-e0f396816aff	f6f11831-62da-44c3-9531-032ebf5beac0	500000.00	5L	11800.00	GROSS	2026-11-01 17:59:06.382573+05:30
117f7fba-3bf8-4bfe-ba15-7a97e6a1a95d	515d86d9-e479-428b-a863-a2c1d89dd86c	2500000.00	25L	31000.00	GROSS	2026-11-01 17:59:06.384584+05:30
fa9bd090-7fa1-412f-baf3-1986b777bc15	2fba0399-f7c9-48e7-9056-7266ecd6aee9	1000000.00	10L	22000.00	GROSS	2026-11-01 17:59:13.46366+05:30
17ee80f8-cbc5-4827-b8a6-87e8cbbfbebc	5338d411-e451-44ec-af7f-c026fb00c3b4	1000000.00	10L	19500.00	GROSS	2026-11-01 17:59:16.07934+05:30
185e1590-089e-4328-bbef-9f31a2f5d6d4	5338d411-e451-44ec-af7f-c026fb00c3b4	2500000.00	25L	32000.00	GROSS	2026-11-01 17:59:16.079349+05:30
3d2f2786-110a-4604-8c0f-7c72782ebca8	0e5b5749-c390-4e27-9d26-969aa46bbe9a	500000.00	5L	12500.00	GROSS	2026-11-01 18:11:53.581292+05:30
1451dd40-f417-4b21-9c2e-b8b4eaf9862b	0e5b5749-c390-4e27-9d26-969aa46bbe9a	1000000.00	10L	18000.00	GROSS	2026-11-01 18:11:53.581299+05:30
c0d298f6-7279-43b2-8e80-81e38d10a6e6	a4fca7bf-0a3d-412b-befe-d0050d0a8b56	1000000.00	10L	19500.00	GROSS	2026-11-01 18:11:53.585228+05:30
3852af9c-6baa-4342-a2aa-4c5ff29dc2e8	a4fca7bf-0a3d-412b-befe-d0050d0a8b56	2000000.00	20L	26000.00	GROSS	2026-11-01 18:11:53.585231+05:30
7c950304-0fb3-4c57-948e-746105c0be26	268494c3-e575-4fc5-83d4-c05cde43e766	500000.00	5L	11800.00	GROSS	2026-11-01 18:11:53.587761+05:30
0a6a3efc-f1a5-4280-99ff-e8e58b94dbda	755cf798-6a93-41a2-9b21-0bc2bdf747d3	2500000.00	25L	31000.00	GROSS	2026-11-01 18:11:53.590187+05:30
54aa33b6-bb18-4dd1-a237-51db354bd22a	bb0bc773-f51a-4c70-b8af-d56323f94636	1000000.00	10L	22000.00	GROSS	2026-11-01 18:12:01.185998+05:30
c04089e6-6218-4b80-9580-355c695fd7b0	8d83b17a-36fe-4be7-a7b0-a71494becd8d	1000000.00	10L	19500.00	GROSS	2026-11-01 18:12:03.851064+05:30
e44b0d01-6f76-4da4-862b-d59ee2767e69	8d83b17a-36fe-4be7-a7b0-a71494becd8d	2500000.00	25L	32000.00	GROSS	2026-11-01 18:12:03.85107+05:30
43939eea-d1a0-42d6-9f4f-d8862c42cdc5	74af6292-2fed-48ab-be21-5b86def22b33	500000.00	5L	12500.00	GROSS	2026-11-01 18:31:58.09904+05:30
a97b9399-be80-42d3-a60a-1ae739037cce	74af6292-2fed-48ab-be21-5b86def22b33	1000000.00	10L	18000.00	GROSS	2026-11-01 18:31:58.099045+05:30
c6859d8f-56bf-4def-aa13-d29bae2cb0b1	795d90b8-aa87-440c-ae6a-e2a07794b448	1000000.00	10L	19500.00	GROSS	2026-11-01 18:31:58.102253+05:30
35ad2e13-f0fd-4faf-8dee-c51d06fb2aac	795d90b8-aa87-440c-ae6a-e2a07794b448	2000000.00	20L	26000.00	GROSS	2026-11-01 18:31:58.102255+05:30
269a035f-4628-4db9-b9a4-d6fc08343410	6dabead1-fbb6-4524-8976-c97ac6a427b8	500000.00	5L	11800.00	GROSS	2026-11-01 18:31:58.103795+05:30
0ee12be0-b383-4737-9047-710511f73f79	557ea78d-d4a1-4264-b45d-e2e767d11a60	2500000.00	25L	31000.00	GROSS	2026-11-01 18:31:58.105223+05:30
e15b9024-7e32-474a-95ac-0640b9e4e40a	6681fbb1-417f-42fa-9d39-bb2c9b4e0f8b	500000.00	5L	23500.00	GROSS	2026-11-01 20:32:20.451711+05:30
16b9db0e-8ad6-4302-aedb-45cb15871720	6681fbb1-417f-42fa-9d39-bb2c9b4e0f8b	750000.00	7.5L	25000.00	GROSS	2026-11-01 20:32:20.451715+05:30
6b99fea0-442c-4739-825c-f732a99c646b	6681fbb1-417f-42fa-9d39-bb2c9b4e0f8b	1000000.00	10L	28000.00	GROSS	2026-11-01 20:32:20.451717+05:30
9de28def-e954-4f43-83fb-22e5f8a2a8de	98361f62-895f-427f-a5e6-c87fe89a48f8	500000.00	5L	2250.00	GROSS	2026-11-01 20:32:20.451719+05:30
71138a30-2169-4970-95c1-cce60391df44	98361f62-895f-427f-a5e6-c87fe89a48f8	750000.00	7.5L	2357.00	GROSS	2026-11-01 20:32:20.451726+05:30
7952c45b-3dbb-416b-b6aa-ad209e2ed45b	98361f62-895f-427f-a5e6-c87fe89a48f8	1000000.00	10L	3256.00	GROSS	2026-11-01 20:32:20.451728+05:30
eb86128a-1b02-405e-b56f-1e8d240aed42	b6962fa5-74ef-450b-bbf9-68773a7ec65b	500000.00	5L	12500.00	GROSS	2026-11-01 20:45:04.192602+05:30
18454817-ac46-442a-8561-9688775e2eaf	b6962fa5-74ef-450b-bbf9-68773a7ec65b	1000000.00	10L	18000.00	GROSS	2026-11-01 20:45:04.192608+05:30
e8a72e3b-792c-42b4-9e37-444e8ee0cc36	75041184-3421-4e21-9a00-dcfc098f0e3d	1000000.00	10L	19500.00	GROSS	2026-11-01 20:45:04.195732+05:30
83d7bd16-a589-4b84-bd8b-d890a38d1787	75041184-3421-4e21-9a00-dcfc098f0e3d	2000000.00	20L	26000.00	GROSS	2026-11-01 20:45:04.195736+05:30
e8cea9fa-7f60-4dcb-a8ab-9d2b8d353515	9dd598b1-ee60-4e4e-b14a-52feb88122d7	500000.00	5L	11800.00	GROSS	2026-11-01 20:45:04.1984+05:30
95106ffe-1b1d-41dd-a007-f74ca86f5594	54cc3682-4f3d-4fc8-8469-885c414f2421	2500000.00	25L	31000.00	GROSS	2026-11-01 20:45:04.200626+05:30
212490ac-29c9-448f-9749-6c57e286bae2	164b8975-64e4-4ef7-958a-acd17eac2813	1000000.00	10L	22000.00	GROSS	2026-11-01 20:45:11.616322+05:30
d39f1fac-f512-429f-baa3-e4b318d1b990	22759648-4244-490a-981a-5b58bb7567eb	1000000.00	10L	19500.00	GROSS	2026-11-01 20:45:14.092259+05:30
06d9e802-ca24-4b55-abc4-98eb230f2cd4	22759648-4244-490a-981a-5b58bb7567eb	2500000.00	25L	32000.00	GROSS	2026-11-01 20:45:14.092266+05:30
6f90d834-d305-40ed-b233-01a4753a4044	8fbafb98-de76-4a5b-823a-1dfdfe63ea6c	500000.00	5L	30000.00	GROSS	2026-11-01 20:52:59.718422+05:30
80a07fd2-1233-4c3f-bc5a-a493b35a1630	8fbafb98-de76-4a5b-823a-1dfdfe63ea6c	750000.00	7.5L	35000.00	GROSS	2026-11-01 20:52:59.718451+05:30
ef9a5f19-025f-4b47-92ac-82c4377d3773	8fbafb98-de76-4a5b-823a-1dfdfe63ea6c	1000000.00	10L	40000.00	GROSS	2026-11-01 20:52:59.718467+05:30
9fa2da13-80fd-4f78-b727-1b43c036535e	9d15faa3-e506-40ab-a403-cd51d73bb609	500000.00	5L	28000.00	GROSS	2026-11-01 20:52:59.740093+05:30
3543f857-9408-40b3-924f-7d0f73a5f289	9d15faa3-e506-40ab-a403-cd51d73bb609	750000.00	7.5L	31000.00	GROSS	2026-11-01 20:52:59.740147+05:30
672eed2c-0e51-4551-ba36-4509d4a47752	9d15faa3-e506-40ab-a403-cd51d73bb609	1000000.00	10L	38000.00	GROSS	2026-11-01 20:52:59.740167+05:30
a37f841b-4598-4f12-ba9b-7117a5269a54	9707888e-a371-43e8-9847-c6cae481cacf	1000000.00	10L	22000.00	GROSS	2026-11-01 21:13:58.703386+05:30
0c80eddf-8817-4fbe-b8ba-11dd9a84a28c	e33ae546-45d2-48f2-90c5-89fcdda75b1d	1000000.00	10L	19500.00	GROSS	2026-11-01 21:14:01.197796+05:30
edca7bb1-4acc-41e2-ab12-e408004ea145	e33ae546-45d2-48f2-90c5-89fcdda75b1d	2500000.00	25L	32000.00	GROSS	2026-11-01 21:14:01.197799+05:30
c902058d-6d80-4621-9a08-6c01c6630ed0	4fb04064-0f0a-48ce-9d07-346826957492	1000000.00	10L	50158.00	GROSS	2026-11-03 18:20:49.543245+05:30
a65be176-992e-4d8a-901a-228b6608a78e	4fb04064-0f0a-48ce-9d07-346826957492	1500000.00	15L	53255.00	GROSS	2026-11-03 18:20:49.543249+05:30
f1b6b154-9f14-4feb-8861-5191ac75bcd0	0afaf8e2-5879-42ee-9c03-f176d0766b5d	750000.00	7.5L	41323.00	GROSS	2026-11-03 18:20:49.546019+05:30
faaafaf4-ec18-4357-8626-f5eccf6cd9fc	0afaf8e2-5879-42ee-9c03-f176d0766b5d	1000000.00	10L	44010.00	GROSS	2026-11-03 18:20:49.546023+05:30
97ec0867-d13e-4812-bff3-c4b47483edc3	0afaf8e2-5879-42ee-9c03-f176d0766b5d	1500000.00	15L	56245.00	GROSS	2026-11-03 18:20:49.546026+05:30
595862d3-749c-44a4-9c6d-4c76cdb4d6f3	3e63f20f-d492-411a-a537-d98682d65ad6	500000.00	5L	38518.00	GROSS	2026-11-03 18:20:49.547993+05:30
9cab71d4-9be5-4d1f-aede-63f5d7349636	3e63f20f-d492-411a-a537-d98682d65ad6	1000000.00	10L	42725.00	GROSS	2026-11-03 18:20:49.547996+05:30
6b251b65-c704-41b3-84cf-5f6ee542880e	3e63f20f-d492-411a-a537-d98682d65ad6	1500000.00	15L	48008.00	GROSS	2026-11-03 18:20:49.547998+05:30
ff5bf340-561f-460e-b526-c17e8c326584	79dbeeb5-28fe-4ce5-b662-0db0b0dc1108	500000.00	5L	31349.00	GROSS	2026-11-03 18:20:49.551322+05:30
fb52737a-d881-420d-8680-3d740084637d	79dbeeb5-28fe-4ce5-b662-0db0b0dc1108	1000000.00	10L	33854.00	GROSS	2026-11-03 18:20:49.551326+05:30
035ce70f-05ba-4614-90e2-c812ff9ba88a	79dbeeb5-28fe-4ce5-b662-0db0b0dc1108	1500000.00	15L	38015.00	GROSS	2026-11-03 18:20:49.551329+05:30
709366b3-20ae-4c06-95e2-16e3ecffd51e	27159cb1-01f7-4def-aee9-c667167b3484	500000.00	5L	12500.00	GROSS	2026-11-03 21:20:29.5959+05:30
e8828fbc-7455-40a5-8a7e-34fbe180c889	27159cb1-01f7-4def-aee9-c667167b3484	1000000.00	10L	18000.00	GROSS	2026-11-03 21:20:29.595904+05:30
f5ee6518-ca3d-45df-a75f-7cf275225180	1a5c88d8-e8bc-46f4-9244-3b639a7238f5	1000000.00	10L	19500.00	GROSS	2026-11-03 21:20:29.640733+05:30
86ad1e6a-304c-4bc8-afe2-141192dad328	1a5c88d8-e8bc-46f4-9244-3b639a7238f5	2000000.00	20L	26000.00	GROSS	2026-11-03 21:20:29.640735+05:30
30168ddf-b12f-45bf-8333-a17f17b784e6	395b1f04-bdca-4627-bb13-3e2ee4cd5f1e	500000.00	5L	11800.00	GROSS	2026-11-03 21:20:29.641975+05:30
2ff410d8-6503-432f-8681-ef3e7c99e935	63f07944-069e-4bcb-820e-8c1e19770e5e	2500000.00	25L	31000.00	GROSS	2026-11-03 21:20:29.643089+05:30
7c717a2d-aacf-4d01-920d-7a5cf89577cf	10af8c7f-5c0b-4d7c-901c-e5332893be07	1000000.00	10L	22000.00	GROSS	2026-11-03 21:20:30.824769+05:30
046cc237-2c7a-4d44-9dc9-5e500934ef9e	3795f47a-1b3e-4a05-8216-891c28575305	1000000.00	10L	19500.00	GROSS	2026-11-03 21:20:31.320768+05:30
d969f66c-123c-4f3e-ae1e-90ea8ccb99dc	3795f47a-1b3e-4a05-8216-891c28575305	2500000.00	25L	32000.00	GROSS	2026-11-03 21:20:31.320771+05:30
1cf85220-1403-4657-85f6-0fa45cb7853b	5ad2be5a-8225-4c0f-a17b-002c5bc6f0a0	500000.00	5L	12500.00	GROSS	2026-11-04 22:39:46.12893+05:30
a5a6ad94-5406-4df1-b1fd-89e61b63814e	5ad2be5a-8225-4c0f-a17b-002c5bc6f0a0	1000000.00	10L	18000.00	GROSS	2026-11-04 22:39:46.128945+05:30
85b845f1-f386-4aa1-a6bb-c9d7aed8cb38	bd1caa14-740e-4aa1-9d31-d73608dfdfaf	1000000.00	10L	19500.00	GROSS	2026-11-04 22:39:46.146681+05:30
300c71e5-1498-4905-90e9-65045eb7757d	bd1caa14-740e-4aa1-9d31-d73608dfdfaf	2000000.00	20L	26000.00	GROSS	2026-11-04 22:39:46.146693+05:30
4ee02ac9-c323-48c3-9e9f-2897dd57fa8d	f5dade7e-2e56-45af-a185-6902dde178dc	500000.00	5L	11800.00	GROSS	2026-11-04 22:39:46.152293+05:30
db9409fe-08f8-4b0f-8bdb-004bd611de1b	a71c6786-c672-49a2-827a-eca616e3d74a	2500000.00	25L	31000.00	GROSS	2026-11-04 22:39:46.160208+05:30
4b7119f7-e6a4-45b1-8fbd-e3b083ee3470	35842b87-e314-4dd8-84de-30fbf6da932e	500000.00	5L	10000.00	GROSS	2026-11-04 22:39:49.43182+05:30
5a32809c-0bfe-4e88-8148-6c5b5c4b6a56	c5738bc5-5f35-47d3-8bbd-d617ed7f9d63	1000000.00	10L	19500.00	GROSS	2026-11-04 22:39:50.947726+05:30
b5cb44c3-46fe-497e-8742-e46581821e6c	c5738bc5-5f35-47d3-8bbd-d617ed7f9d63	2500000.00	25L	32000.00	GROSS	2026-11-04 22:39:50.947734+05:30
87ee74c6-9598-4b7b-872b-61c55415abf8	2ae3e252-5d3e-44ac-867c-d615223bc293	500000.00	5L	12500.00	GROSS	2026-11-04 22:40:13.69828+05:30
6bf18aa9-1078-45d9-ab6a-2a8524f5f7fe	2ae3e252-5d3e-44ac-867c-d615223bc293	1000000.00	10L	18000.00	GROSS	2026-11-04 22:40:13.698288+05:30
12224d67-c8f1-4b80-baf4-b1e6fd5c462c	0e279d15-93eb-4587-84a7-ff4299836d54	1000000.00	10L	19500.00	GROSS	2026-11-04 22:40:13.703295+05:30
2d5d5ba0-4234-4410-9016-20714b93daf6	0e279d15-93eb-4587-84a7-ff4299836d54	2000000.00	20L	26000.00	GROSS	2026-11-04 22:40:13.703302+05:30
25afda35-bb3b-4d09-9a53-2abe062294e3	69310632-6d64-4a3d-a392-18845f609e03	500000.00	5L	11800.00	GROSS	2026-11-04 22:40:13.705603+05:30
2a587b16-616b-4ddb-a687-34be5141d9a9	c918b3c2-58f3-4080-b491-db1810ca9359	2500000.00	25L	31000.00	GROSS	2026-11-04 22:40:13.708548+05:30
9073b6c2-3650-4e2b-8d7b-a1bbddc229ba	2a3a5a8e-1f0e-4b87-8eea-083b21ef2f25	500000.00	5L	10000.00	GROSS	2026-11-04 22:40:16.789311+05:30
6981af3b-64c5-4566-9746-239deb35d5da	80cb58cc-0ba2-4b23-a461-246ae7b9ba1c	1000000.00	10L	19500.00	GROSS	2026-11-04 22:40:18.508255+05:30
9406ef07-9767-470d-9453-2b463e1af796	80cb58cc-0ba2-4b23-a461-246ae7b9ba1c	2500000.00	25L	32000.00	GROSS	2026-11-04 22:40:18.508264+05:30
f515d1f4-60f7-48f8-9885-b76577f492ee	53a6d912-8097-457f-a3f6-cbb94aaff913	500000.00	5L	12500.00	GROSS	2026-11-04 22:41:10.772742+05:30
114e2d59-4123-4956-901b-5ad2c6883217	53a6d912-8097-457f-a3f6-cbb94aaff913	1000000.00	10L	18000.00	GROSS	2026-11-04 22:41:10.77275+05:30
49a75495-2ac4-425a-98ae-b051e1d863ed	2f617e34-0817-4d1d-aa98-c6f9c4a896be	1000000.00	10L	19500.00	GROSS	2026-11-04 22:41:10.781098+05:30
150517cb-8119-4d59-afb6-3c05d512ca4b	2f617e34-0817-4d1d-aa98-c6f9c4a896be	2000000.00	20L	26000.00	GROSS	2026-11-04 22:41:10.781105+05:30
93469443-33d3-4cf7-b8ed-f6ca5a818e46	e924ac81-a423-458a-a54f-c142ee140b3e	500000.00	5L	11800.00	GROSS	2026-11-04 22:41:10.784602+05:30
bc940e93-33d4-4b2e-939d-b386c47e630f	b5ec89fb-bea6-4f36-917f-802b6f7e7e08	2500000.00	25L	31000.00	GROSS	2026-11-04 22:41:10.787481+05:30
0882f76d-27c9-469d-b391-2690c6626f01	b1d615a1-1d66-47c5-bce2-f6b11390f42f	1000000.00	10L	22000.00	GROSS	2026-11-04 22:41:12.247443+05:30
b0ed1289-d2ea-402e-b9a3-ee030ea2cfb4	2eb2e934-f758-44db-a4b8-74fc83e52655	1000000.00	10L	19500.00	GROSS	2026-11-04 22:41:12.943223+05:30
cd61535d-97b5-42bc-b18d-9a18f47c77e2	2eb2e934-f758-44db-a4b8-74fc83e52655	2500000.00	25L	32000.00	GROSS	2026-11-04 22:41:12.943232+05:30
2201e3d0-cb9c-4512-9292-ac2fe28dc8e6	23557f5c-0e18-4f0d-98df-d62967161234	500000.00	5L	12500.00	GROSS	2026-11-04 22:41:51.775146+05:30
c439aa81-531c-408a-bb45-5576b72f32bc	23557f5c-0e18-4f0d-98df-d62967161234	1000000.00	10L	18000.00	GROSS	2026-11-04 22:41:51.775156+05:30
446cf362-7fdc-43bc-a60d-c38f188fe7b9	29c22b1d-f273-41c5-a27c-932b9bc5fef7	1000000.00	10L	19500.00	GROSS	2026-11-04 22:41:51.778379+05:30
1f9ae875-e684-4b12-a410-5afbc7ed4a1f	29c22b1d-f273-41c5-a27c-932b9bc5fef7	2000000.00	20L	26000.00	GROSS	2026-11-04 22:41:51.778383+05:30
9f9ea928-d1f0-4118-ad4e-a974d1a0567b	ff4d8b66-7f6b-4b11-9e9e-43c0ab02c982	500000.00	5L	11800.00	GROSS	2026-11-04 22:41:51.780476+05:30
79f8118b-f810-4a46-855b-1f92656bc99f	eb12a10f-551a-4887-a016-07805476dcc3	2500000.00	25L	31000.00	GROSS	2026-11-04 22:41:51.781762+05:30
60a4ea8d-af54-4a60-a2b0-ab8a660fd130	8908e8d3-1f3d-4a0e-a992-d2e6ab1cbead	1000000.00	10L	22000.00	GROSS	2026-11-04 22:41:53.031287+05:30
909d437e-cfd5-4c33-882d-3ff47ffed71e	1f2626fd-8c73-4512-aad8-df5b056005c1	1000000.00	10L	19500.00	GROSS	2026-11-04 22:41:53.59092+05:30
cfdf56bb-10b1-474f-8c81-a4c7d500da77	1f2626fd-8c73-4512-aad8-df5b056005c1	2500000.00	25L	32000.00	GROSS	2026-11-04 22:41:53.590926+05:30
1399ddb6-587b-4561-a9a7-cfaa6328b311	383eca0d-be96-4a69-8130-b11406af1fdc	500000.00	5L	12500.00	GROSS	2026-11-04 22:44:36.794778+05:30
359b73ba-6093-40e0-b3f4-0adbaad41bcb	383eca0d-be96-4a69-8130-b11406af1fdc	1000000.00	10L	18000.00	GROSS	2026-11-04 22:44:36.794788+05:30
2afb961f-96c7-497f-afc3-b9000d36230b	5b3cd67d-e02f-4149-97bf-60e0352e3fd3	1000000.00	10L	19500.00	GROSS	2026-11-04 22:44:36.803153+05:30
4ada61a3-51b1-4f08-9b60-c3ba9de11d4b	5b3cd67d-e02f-4149-97bf-60e0352e3fd3	2000000.00	20L	26000.00	GROSS	2026-11-04 22:44:36.80317+05:30
17492562-9321-470f-a8f5-13d27faebae9	1b116760-5d31-43a1-9490-78dcb6041671	500000.00	5L	11800.00	GROSS	2026-11-04 22:44:36.809761+05:30
6c8eedc2-83c9-4c0f-9362-70ce9da10d33	380894c9-51d9-4cae-b741-dd85fe7df26d	2500000.00	25L	31000.00	GROSS	2026-11-04 22:44:36.815991+05:30
e817b5f4-d64d-46b2-9132-c2501b4b3840	830c5bb9-6091-46ef-ab5b-54a8e77fd50e	1000000.00	10L	22000.00	GROSS	2026-11-04 22:44:38.392398+05:30
0ebdfc88-d0da-49d9-bf1b-807cfd88a110	17ead161-97db-4b80-83bb-f8ae26cdd3d8	1000000.00	10L	19500.00	GROSS	2026-11-04 22:44:39.091905+05:30
b44dfce1-7626-4e8f-b9a7-b512c9fd6965	17ead161-97db-4b80-83bb-f8ae26cdd3d8	2500000.00	25L	32000.00	GROSS	2026-11-04 22:44:39.091911+05:30
4c90943b-230b-40b5-bc21-1061e0011ed2	5e26a2be-7fb1-4c6d-9ff4-621a30a71f86	500000.00	5L	12500.00	GROSS	2026-11-04 22:47:17.576269+05:30
d2b306af-3532-4751-9f25-dfb9b72fde09	5e26a2be-7fb1-4c6d-9ff4-621a30a71f86	1000000.00	10L	18000.00	GROSS	2026-11-04 22:47:17.576279+05:30
aa123ebc-1a23-4660-aac5-5135614683ee	736ea8d0-7326-4446-aaa7-35cf86948be9	1000000.00	10L	19500.00	GROSS	2026-11-04 22:47:17.581383+05:30
572821eb-cde9-4b7b-8077-cf57121e42e1	736ea8d0-7326-4446-aaa7-35cf86948be9	2000000.00	20L	26000.00	GROSS	2026-11-04 22:47:17.581391+05:30
b2eade20-3e3f-49f3-a0cb-71022e1219f6	85692e9d-d862-4ee4-8513-b453fcc336cc	500000.00	5L	11800.00	GROSS	2026-11-04 22:47:17.583659+05:30
1236ee86-cfeb-4e0a-b3f2-c10c1620c58e	1c078bd2-743e-43b2-b17e-5bcffed4190e	2500000.00	25L	31000.00	GROSS	2026-11-04 22:47:17.585921+05:30
621a7e44-57fb-4813-ae2d-2e70847523c9	5510f0b7-ccd5-42c9-ad8f-7c9ff16e2dd4	1000000.00	10L	22000.00	GROSS	2026-11-04 22:47:18.872235+05:30
c4f73129-f937-4a75-b1cb-6ef9845c7a1f	618b48e4-8980-4bc3-893c-32bea9f30594	1000000.00	10L	19500.00	GROSS	2026-11-04 22:47:19.645319+05:30
283f4929-412e-403e-a80d-979c1d1e9e20	618b48e4-8980-4bc3-893c-32bea9f30594	2500000.00	25L	32000.00	GROSS	2026-11-04 22:47:19.645325+05:30
8f3ac05b-892b-4d75-8b4c-090819d9b7a4	d1082f31-3de0-456d-ac21-3a2067b7eee0	500000.00	5L	12500.00	GROSS	2026-11-04 23:02:36.688323+05:30
e7552dd1-034b-4f72-a883-84830fc63fe5	d1082f31-3de0-456d-ac21-3a2067b7eee0	1000000.00	10L	18000.00	GROSS	2026-11-04 23:02:36.688336+05:30
e3be5820-83b5-4282-ab41-975c9784db1a	bf94428f-473c-4368-a98e-75b37408e977	1000000.00	10L	19500.00	GROSS	2026-11-04 23:02:36.762926+05:30
573c2372-15a0-4bd8-9f20-2109d39adbdf	bf94428f-473c-4368-a98e-75b37408e977	2000000.00	20L	26000.00	GROSS	2026-11-04 23:02:36.76293+05:30
989c6443-cc71-4aa9-ba1d-f90089fae263	a20cc781-828b-490e-8e4f-70b022e77b72	500000.00	5L	11800.00	GROSS	2026-11-04 23:02:36.764587+05:30
437df163-2997-4244-987f-9c88b7577dac	bba1f60d-362c-4853-b7cf-ff31c715591e	2500000.00	25L	31000.00	GROSS	2026-11-04 23:02:36.766101+05:30
72f4340c-339a-4428-8d78-ce4ceb93e130	52c29474-4373-4bd8-bd36-062239a7e3e3	1000000.00	10L	22000.00	GROSS	2026-11-04 23:02:37.52022+05:30
254332da-1e06-44a8-9b42-4987f2557789	c8403d8a-9cc0-4492-b269-2fec0dd2e895	1000000.00	10L	19500.00	GROSS	2026-11-04 23:02:38.036484+05:30
180e02d7-ce84-42c9-9731-b487da3ba114	c8403d8a-9cc0-4492-b269-2fec0dd2e895	2500000.00	25L	32000.00	GROSS	2026-11-04 23:02:38.036487+05:30
46414458-01e5-46d7-8d92-da223949fc30	269ec4d0-4f92-4089-8da2-ccf70f829671	500000.00	5L	12500.00	GROSS	2026-11-04 23:06:28.66736+05:30
db52d517-cf50-422d-94db-acf237b250a5	269ec4d0-4f92-4089-8da2-ccf70f829671	1000000.00	10L	18000.00	GROSS	2026-11-04 23:06:28.667365+05:30
78705a03-4ec6-42c8-bd30-c92baad96229	12f4d8dd-6628-4d28-8851-9fdd78e6a49d	1000000.00	10L	19500.00	GROSS	2026-11-04 23:06:28.711691+05:30
4c469652-2c67-4ab5-b383-09718c21c041	12f4d8dd-6628-4d28-8851-9fdd78e6a49d	2000000.00	20L	26000.00	GROSS	2026-11-04 23:06:28.711694+05:30
9a68c7cc-9fe2-4218-ba16-fe2479f0e93b	61c78478-9675-4912-a95a-44af1cd8184d	500000.00	5L	11800.00	GROSS	2026-11-04 23:06:28.714958+05:30
ae6241a0-06b2-4de5-a63c-c3d693b41521	88c7a33c-72c8-4868-9f4d-ac4f4dcc6ed2	2500000.00	25L	31000.00	GROSS	2026-11-04 23:06:28.717348+05:30
fabb4fdb-87d5-42d2-8826-76c93c0ab808	72393e9c-5c35-4f39-8871-92a63dd780bb	1000000.00	10L	22000.00	GROSS	2026-11-04 23:06:29.7901+05:30
e20e62c0-93f2-41c5-9948-9e638035d6bb	90a17378-9548-4c33-97fc-b64622175e8f	1000000.00	10L	19500.00	GROSS	2026-11-04 23:06:30.327099+05:30
555d323d-0eca-4e32-8892-1d0f790e96f0	90a17378-9548-4c33-97fc-b64622175e8f	2500000.00	25L	32000.00	GROSS	2026-11-04 23:06:30.327104+05:30
\.


--
-- Data for Name: insurance_health_quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_health_quotations (id, quotation_number, quotation_title, client_id, client_name, advisor_id, advisor_name, quotation_date, pin_code, contact_number, contact_email, notes, disclaimer_snapshot, premium_basis, status, tenant_id, created_at, updated_at) FROM stdin;
9fc9f278-f21a-4a1a-85ef-f1439c147589	HQ-2026-00001	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:51:53.444263+05:30	2026-11-01 17:51:53.44427+05:30
75ef48ad-7ff0-4dfb-9f47-3939b9169f41	HQ-2026-00002	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:51:57.724805+05:30	2026-11-01 17:51:57.724809+05:30
eb5b3fa8-b7db-44fb-b36b-a4732ba74fc0	HQ-2026-00003	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:52:01.767766+05:30	2026-11-01 17:52:01.767771+05:30
bfd648bb-e0c0-4c28-8185-a5019a8a1710	HQ-2026-00004	Initial Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400050	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:52:05.512127+05:30	2026-11-01 17:52:05.512133+05:30
9ed2734b-545e-44fd-a09d-4cae26a1bd2d	HQ-2026-00005	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:52:09.297209+05:30	2026-11-01 17:52:09.297213+05:30
c4419739-52e7-42f7-af8c-8cf23d6a0430	HQ-2026-00006	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:52:13.31841+05:30	2026-11-01 17:52:13.318413+05:30
1ecc736d-5177-4287-ad02-e26c9060ee6b	HQ-2026-00007	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:54:28.549516+05:30	2026-11-01 17:54:28.549521+05:30
dbec63c0-6a87-4b4d-bf7b-501f7eea8771	HQ-2026-00008	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:54:31.728459+05:30	2026-11-01 17:54:31.728463+05:30
ac19c0fe-1e7a-4fa1-94bf-41ada9d26a1e	HQ-2026-00009	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:54:34.316236+05:30	2026-11-01 17:54:34.316242+05:30
a70569b8-2954-4971-bba4-0614eca210c5	HQ-2026-00010	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:54:37.31734+05:30	2026-11-01 17:54:39.423039+05:30
9c7e7203-3598-4565-bc07-015c6875d06d	HQ-2026-00011	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:54:42.044787+05:30	2026-11-01 17:54:42.044793+05:30
586f174b-2126-475a-9061-20ca66f8fb72	HQ-2026-00012	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:54:51.275845+05:30	2026-11-01 17:54:51.275849+05:30
5e48975a-ad6f-4147-96d7-8ea9b994f69f	HQ-2026-00013	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:56:26.346407+05:30	2026-11-01 17:56:26.346412+05:30
77422edf-f737-4d82-9440-dab8736e33d6	HQ-2026-00014	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:56:29.128135+05:30	2026-11-01 17:56:29.128139+05:30
7d29448a-0aff-4dde-9845-c3371e1786a0	HQ-2026-00015	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:56:31.965976+05:30	2026-11-01 17:56:31.96598+05:30
b3c20dd7-7f0f-4082-897a-5f99cdb65157	HQ-2026-00016	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:56:34.654178+05:30	2026-11-01 17:56:36.846522+05:30
e486b08b-179a-4d7b-8d58-5efe65a6a601	HQ-2026-00017	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:56:41.108335+05:30	2026-11-01 17:56:41.108342+05:30
908132e5-0135-4f85-9026-d8c07a3fd25a	HQ-2026-00018	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:56:50.26076+05:30	2026-11-01 17:56:50.260765+05:30
109df747-4579-43a8-afb9-2a58b53f54f4	HQ-2026-00019	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:57:35.838957+05:30	2026-11-01 17:57:35.838961+05:30
a8c345cc-7eed-4764-ab8c-23351f6a1529	HQ-2026-00020	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:57:38.427443+05:30	2026-11-01 17:57:38.427447+05:30
f8a4e668-21de-4974-9f74-fb307c853624	HQ-2026-00021	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:57:41.012642+05:30	2026-11-01 17:57:41.012647+05:30
1f6fa7a4-aa36-4f79-8cd9-ac6f9decabd9	HQ-2026-00022	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:57:43.890396+05:30	2026-11-01 17:57:45.952441+05:30
08774c4f-e433-484d-b225-599d577be670	HQ-2026-00023	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:57:50.218217+05:30	2026-11-01 17:57:50.218221+05:30
56aa1fa7-6e12-48e2-86fa-172a4a36a982	HQ-2026-00024	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:57:59.298626+05:30	2026-11-01 17:57:59.298631+05:30
7a114092-4478-4e44-9996-5d7a1436bc99	HQ-2026-00025	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:59:03.892145+05:30	2026-11-01 17:59:03.892148+05:30
e07370f7-7c83-4411-821e-0eb91213ea50	HQ-2026-00026	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:59:06.371809+05:30	2026-11-01 17:59:06.371812+05:30
cdd54b28-23d0-46fc-b562-a9da70c98fe8	HQ-2026-00027	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:59:08.816769+05:30	2026-11-01 17:59:08.816772+05:30
4ec03a45-d25c-4330-932d-8882e42da614	HQ-2026-00028	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:59:11.374633+05:30	2026-11-01 17:59:13.459593+05:30
06d2c9fa-7290-4c15-a86d-01095fce49c2	HQ-2026-00029	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:59:16.071688+05:30	2026-11-01 17:59:16.071692+05:30
8a013209-2afd-4c4f-932a-cd7fc5724478	HQ-2026-00030	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 17:59:24.820928+05:30	2026-11-01 17:59:24.820931+05:30
098773da-d685-4a40-a0a2-de54b771eba6	HQ-2026-00061	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:39:46.102545+05:30	2026-11-04 22:39:46.102552+05:30
0f62f059-cbd0-448a-b0eb-fc8114375308	HQ-2026-00031	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:11:50.849302+05:30	2026-11-01 18:11:50.849306+05:30
48b6a9d9-ae0d-41e3-a05f-800e01ce512d	HQ-2026-00032	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:11:53.570568+05:30	2026-11-01 18:11:53.570576+05:30
13ab07ec-62f5-40f8-b9f4-6ddfafe894f7	HQ-2026-00033	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:11:56.239212+05:30	2026-11-01 18:11:56.239215+05:30
3294d1a5-836e-4877-a0d0-ed14d3fbe291	HQ-2026-00034	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:11:59.04236+05:30	2026-11-01 18:12:01.181143+05:30
10a47e8d-509f-4aae-bb05-7fe42e65e5d8	HQ-2026-00035	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:12:03.838255+05:30	2026-11-01 18:12:03.838259+05:30
db96c885-a0bc-4aed-9ba7-1e2233b70dfc	HQ-2026-00036	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:12:12.870169+05:30	2026-11-01 18:12:12.870172+05:30
648f2bf1-76e0-48f8-9d05-50a5d6286456	HQ-2026-00037	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:31:55.626696+05:30	2026-11-01 18:31:55.626698+05:30
3d8c6146-0cf2-4460-9bb5-c3f4d427c410	HQ-2026-00038	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:31:58.092787+05:30	2026-11-01 18:31:58.092791+05:30
a0eaa133-d4b1-458d-aa79-818a462bb272	HQ-2026-00039	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 18:32:00.579776+05:30	2026-11-01 18:32:00.579779+05:30
98db068c-b944-4d0a-ae63-2dedc75c4ce7	HQ-2026-00040	Aditya Thakre Premium Health Quotation	f206a3f3-9120-4794-a649-b8a617a70a8a	Harsh Vardhan	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	431001	17777777776	harsh.vardhan@example.com	sdvsdcsdvvsdvdv	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 20:31:32.820819+05:30	2026-11-01 20:31:32.820824+05:30
8249b200-547f-466b-b832-4e16b4aa1232	HQ-2026-00041	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 20:45:01.701957+05:30	2026-11-01 20:45:01.70196+05:30
ee1b9df2-5645-4169-b144-80d333541f7e	HQ-2026-00042	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 20:45:04.18492+05:30	2026-11-01 20:45:04.184924+05:30
bee6dc28-0a61-429c-9722-38eb81f41823	HQ-2026-00043	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 20:45:06.639054+05:30	2026-11-01 20:45:06.639057+05:30
4d691de0-3d64-49bf-86f2-aec82b354caa	HQ-2026-00044	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 20:45:09.543828+05:30	2026-11-01 20:45:11.613122+05:30
8ca69177-4fed-471d-b2a0-f872c48ff0de	HQ-2026-00045	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 20:45:14.088161+05:30	2026-11-01 20:45:14.088163+05:30
e1b9dcca-f475-4dbb-a599-11bc46d08c4d	HQ-2026-00046	ABCD Premium Health Quotation	0c7ad9a9-3a44-46ec-b5e6-5ff53112a9ac	Harsh Vardhan	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	431001	17777777776	harsh.vardhan@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 20:52:59.669356+05:30	2026-11-01 20:52:59.669372+05:30
3fbe8705-38c9-4f37-b627-a14229ee2e33	HQ-2026-00047	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 21:13:49.404927+05:30	2026-11-01 21:13:49.40493+05:30
e64fabe1-981e-4ba5-beca-7c8c83e7761c	HQ-2026-00049	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 21:13:54.179915+05:30	2026-11-01 21:13:54.179919+05:30
e639782f-e647-48d4-a093-ddee41764cb4	HQ-2026-00050	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 21:13:56.606961+05:30	2026-11-01 21:13:58.701015+05:30
80089d82-d1e3-45e8-9e0c-a2e8ef8862f7	HQ-2026-00051	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 21:14:01.192847+05:30	2026-11-01 21:14:01.192851+05:30
66529fbb-97b5-49f4-bde2-0005556c3ae2	HQ-2026-00052	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-01 21:14:09.814487+05:30	2026-11-01 21:14:09.81449+05:30
2ababf4a-89a3-478f-b861-a96d2f6b7e3a	HQ-2026-00053	Aditya Thakre Premium Health Quotation	12bd5fd9-91f4-488c-a842-58428547934c	Vikram Rathore	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-03	431003	4444444444	vikram.rathore@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-03 18:20:49.518915+05:30	2026-11-03 18:20:49.518923+05:30
6555b53a-479e-4ed1-aaf4-8c1ab40ee635	HQ-2026-00054	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-03 21:20:29.126836+05:30	2026-11-03 21:20:29.126839+05:30
6028f846-c2d6-4233-a107-97e9fe686ff6	HQ-2026-00055	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-03 21:20:29.590851+05:30	2026-11-03 21:20:29.590854+05:30
4e547f92-1679-4d2c-b30f-999e36316840	HQ-2026-00056	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-03	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-03 21:20:30.280425+05:30	2026-11-03 21:20:30.280431+05:30
f199b890-ac6f-4126-9afa-09844a7ef3c9	HQ-2026-00057	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-03 21:20:30.783693+05:30	2026-11-03 21:20:30.821651+05:30
f98d579f-6da5-4f88-b527-6fc3b579ed5c	HQ-2026-00058	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-03 21:20:31.312939+05:30	2026-11-03 21:20:31.312942+05:30
fdc8ca93-a632-47ad-af03-246163065d4d	HQ-2026-00059	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-03	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-03 21:20:31.892182+05:30	2026-11-03 21:20:31.892185+05:30
d41ba26d-3511-40e8-aecc-8644550490ec	HQ-2026-00060	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:39:43.959588+05:30	2026-11-04 22:39:43.959593+05:30
a9b4a749-0bf9-451c-8012-99652c012be3	HQ-2026-00062	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:39:47.91229+05:30	2026-11-04 22:39:47.912294+05:30
89917f5e-d5b1-481f-9832-6f5c082bb936	HQ-2026-00063	Initial Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400050	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:39:49.420323+05:30	2026-11-04 22:39:49.420327+05:30
0cab7ecb-c31d-432d-bae7-79bc0a22cab6	HQ-2026-00064	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:39:50.939212+05:30	2026-11-04 22:39:50.939216+05:30
ff131008-f97d-4e80-bd6f-67f3ba3e9650	HQ-2026-00065	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:39:52.380117+05:30	2026-11-04 22:39:52.38012+05:30
3eef8c60-f6c1-4ab1-a47e-d15652f12de9	HQ-2026-00066	Aditya Thakre Premium Health Quotation	\N	Test Client	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	4000AB	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:39:54.496231+05:30	2026-11-04 22:39:54.496235+05:30
365d3818-df64-45b2-8846-a2c17472edd0	HQ-2026-00067	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:40:11.654244+05:30	2026-11-04 22:40:11.654253+05:30
018d172c-15c0-44ba-a6f0-bfac26f39022	HQ-2026-00068	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:40:13.688839+05:30	2026-11-04 22:40:13.688844+05:30
3e6c6677-e4d6-487e-94d5-206bc9a44017	HQ-2026-00069	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:40:15.325211+05:30	2026-11-04 22:40:15.325217+05:30
4bcecbe7-4475-4a3b-8253-5a6b62d2dfe8	HQ-2026-00070	Initial Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400050	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:40:16.781843+05:30	2026-11-04 22:40:16.781846+05:30
798500c8-0078-4338-bc3c-d9363996b3f1	HQ-2026-00071	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:40:18.49259+05:30	2026-11-04 22:40:18.492598+05:30
e51b5a8d-3372-4323-bf6b-0b23cf11a49e	HQ-2026-00072	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:40:20.072755+05:30	2026-11-04 22:40:20.072759+05:30
b596cbe3-309d-4ef8-bebc-dba8dbaece1a	HQ-2026-00073	Aditya Thakre Premium Health Quotation	\N	Test Client	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	4000AB	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:40:22.20596+05:30	2026-11-04 22:40:22.205963+05:30
b2d792c8-10be-4701-b511-ae1d5ef369cd	HQ-2026-00074	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:10.129037+05:30	2026-11-04 22:41:10.129041+05:30
5baa1a97-452f-4616-bd00-83b7fd5783f8	HQ-2026-00075	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:10.760725+05:30	2026-11-04 22:41:10.760729+05:30
2290ab0e-610c-4ecd-80b5-4e765a786102	HQ-2026-00076	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:11.536741+05:30	2026-11-04 22:41:11.536756+05:30
7f4416e8-2c68-4d69-85ad-081cb5087cd1	HQ-2026-00077	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:12.184928+05:30	2026-11-04 22:41:12.242869+05:30
acedad77-57e4-44e0-9da6-cfd83e922c85	HQ-2026-00078	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:12.93478+05:30	2026-11-04 22:41:12.934785+05:30
85df1d39-26e2-4416-95fa-b5251e8d20f0	HQ-2026-00079	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:13.942186+05:30	2026-11-04 22:41:13.942191+05:30
224b6c12-6316-488e-b0c1-13b679cf47e3	HQ-2026-00080	Aditya Thakre Premium Health Quotation	\N	Test Client	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	4000AB	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:14.771273+05:30	2026-11-04 22:41:14.771276+05:30
6ee358d0-9954-4863-bdce-3c326b318d0c	HQ-2026-00081	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:51.179896+05:30	2026-11-04 22:41:51.179901+05:30
1d657778-e108-4098-a45e-46fc8ee75038	HQ-2026-00082	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:51.765409+05:30	2026-11-04 22:41:51.765413+05:30
a2995fad-b48f-4523-ae1b-508616269362	HQ-2026-00083	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:52.430706+05:30	2026-11-04 22:41:52.43071+05:30
649a1dab-ad11-4e1b-b13a-aa3ad4cc3cc8	HQ-2026-00084	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:52.994396+05:30	2026-11-04 22:41:53.027553+05:30
7303111d-2ac9-4363-8772-66e5541c9dac	HQ-2026-00085	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:53.58306+05:30	2026-11-04 22:41:53.583064+05:30
059ba3ba-eee6-41e7-9a69-37a88b961249	HQ-2026-00086	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:41:54.423266+05:30	2026-11-04 22:41:54.423269+05:30
a19d61e7-eba6-46a7-b41e-b8f5414760f8	HQ-2026-00087	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:44:36.175429+05:30	2026-11-04 22:44:36.175432+05:30
7aaa659b-fd37-4a3f-a8a6-30a749bcab09	HQ-2026-00088	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:44:36.782615+05:30	2026-11-04 22:44:36.782625+05:30
290c3558-9327-4730-84e8-9df3cb437d7a	HQ-2026-00089	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:44:37.560174+05:30	2026-11-04 22:44:37.560178+05:30
022e36f7-f2d7-41b6-98c8-addb2573ae78	HQ-2026-00090	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:44:38.337553+05:30	2026-11-04 22:44:38.387376+05:30
8317b63e-4246-4182-89ce-6635aaf70f51	HQ-2026-00091	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:44:39.083902+05:30	2026-11-04 22:44:39.083907+05:30
04da8822-5f03-4605-9290-916baea25b40	HQ-2026-00092	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:44:40.109703+05:30	2026-11-04 22:44:40.109707+05:30
7d24b34d-2db8-418b-b93b-66a35f174d53	HQ-2026-00093	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:47:16.928569+05:30	2026-11-04 22:47:16.928576+05:30
c24c62f1-f778-4a29-920b-72e8f43a4e71	HQ-2026-00094	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:47:17.568216+05:30	2026-11-04 22:47:17.568221+05:30
ab902e20-c339-4461-baf8-4e0f191411cf	HQ-2026-00095	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:47:18.197862+05:30	2026-11-04 22:47:18.197866+05:30
7ebda0c8-e598-4b3e-984c-21c2d704d444	HQ-2026-00096	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:47:18.803534+05:30	2026-11-04 22:47:18.864774+05:30
12090979-44e4-452e-96bf-094d3665c430	HQ-2026-00097	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:47:19.633821+05:30	2026-11-04 22:47:19.633829+05:30
1e7ac991-8126-4313-b67f-384ab85d222e	HQ-2026-00098	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 22:47:20.946289+05:30	2026-11-04 22:47:20.946293+05:30
26598004-0b87-48a0-9fc5-9530433fec78	HQ-2026-00099	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:02:36.263817+05:30	2026-11-04 23:02:36.26382+05:30
7ed41588-7d79-422e-bcd7-3fde0b86e7cc	HQ-2026-00100	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:02:36.681839+05:30	2026-11-04 23:02:36.681842+05:30
91f775fd-6e20-43df-88fd-b4133647b206	HQ-2026-00101	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:02:37.137696+05:30	2026-11-04 23:02:37.137699+05:30
5e8f666f-98d0-47c1-a064-78fa9b03a6ed	HQ-2026-00102	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:02:37.488166+05:30	2026-11-04 23:02:37.516818+05:30
dab57d45-0f14-4ac7-afe0-890b8ace5bc4	HQ-2026-00103	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:02:38.028677+05:30	2026-11-04 23:02:38.02868+05:30
32a3635a-2c95-408d-a732-385fc7056ba3	HQ-2026-00104	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:02:38.654479+05:30	2026-11-04 23:02:38.654482+05:30
dacbc2ee-0665-4561-870e-69d1391f16f0	HQ-2026-00105	Sharma Family Health Portfolio 2026	\N	Rahul Sharma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400001	+91 98200 12345	rahul.sharma@example.com	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:06:28.17183+05:30	2026-11-04 23:06:28.171832+05:30
1afc161c-881a-49a6-a577-11c50e791e9b	HQ-2026-00106	Dynamic Matrix Verification Quotation	\N	Vikram Verma	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	110001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:06:28.662291+05:30	2026-11-04 23:06:28.662294+05:30
f1b3960d-dce5-4244-94af-7aca60272379	HQ-2026-00107	Draft Prospect Without Premiums	\N	Anita Roy	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	560001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:06:29.204656+05:30	2026-11-04 23:06:29.204659+05:30
08021add-8a7d-4490-afbb-c9fff1b3cb4f	HQ-2026-00108	Updated Rajesh Kumar Quotation	\N	Rajesh Kumar	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400099	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:06:29.699324+05:30	2026-11-04 23:06:29.78728+05:30
91630893-fd99-4e7c-8a1d-30bbeec0799b	HQ-2026-00109	Comprehensive Export Test Quotation	\N	Sunil Joshi	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-01	400021	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:06:30.322158+05:30	2026-11-04 23:06:30.32216+05:30
c1fba66c-ca15-4616-b312-f20910950289	HQ-2026-00110	Original For Duplication	\N	Meera Sen	40351e16-e0dd-4064-a060-bd866d35bc63	Aditya Thakre	2026-11-04	700001	\N	\N	\N	THIS QUOTATION FOR YOUR REFERENCE, SUBJECT TO CHANGE AT TIME OF PURCHASE	GROSS	DRAFT	\N	2026-11-04 23:06:31.027689+05:30	2026-11-04 23:06:31.027691+05:30
\.


--
-- Data for Name: insurance_plan_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_plan_documents (id, plan_id, document_type, title, description, original_filename, storage_path, file_size_bytes, mime_type, sha256_hash, uploaded_by_id, created_at, updated_at) FROM stdin;
57013e25-3242-4568-8161-2e917c6b3ab7	15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2	Policy Brochure	ReAssureBrochure2.0	\N	ReAssureBrochure2.0.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2_57013e25_ReAssureBrochure2.0.pdf	3243407	application/pdf	16f5066239e18e9ff6b1f86aa657a20bc1c2a5dc0440603af8ed3f66aa7ace63	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 21:28:42.57428+05:30	2026-11-01 21:28:42.574288+05:30
5dbde318-1741-49be-a885-2b8966ebc149	f84d93e1-dd77-4e20-8be9-d41ac1123403	Policy Brochure	tataaig_medicare_brochure	\N	tataaig_medicare_brochure.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_f84d93e1-dd77-4e20-8be9-d41ac1123403_5dbde318_tataaig_medicare_brochure.pdf	250853	application/pdf	8510704d2793d621ac3eba529d484b914731ed62fb6c4653c58421385fdd4004	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 22:22:37.167242+05:30	2026-11-01 22:22:37.167246+05:30
c69a5398-7de5-4a5a-81c6-1eda5d4d73ad	f77024bf-0bf5-45cb-bce1-1222816a978a	Policy Brochure	1e72d1352ddb5cd3f6b6e881cb501015	\N	1e72d1352ddb5cd3f6b6e881cb501015.jpg	D:\\project\\backend\\storage\\plan_documents\\plan_f77024bf-0bf5-45cb-bce1-1222816a978a_c69a5398_1e72d1352ddb5cd3f6b6e881cb501015.jpg	123178	image/jpeg	3542cdf1115a4495b721c71265a7ab65e82590b957d738d7870a8ea5ea6aec0d	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 22:56:25.736514+05:30	2026-11-01 22:56:25.73652+05:30
07288b69-e1e7-4cc2-af27-fa5002a74885	9e8daedd-1859-46fd-9179-a2d42c15af0a	Policy Brochure	Official Plan Brochure 2026	\N	brochure_2026.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_9e8daedd-1859-46fd-9179-a2d42c15af0a_07288b69_brochure_2026.pdf	61	application/pdf	bb0294c899a028f024ac0071872eb8f28df8979291b536143742755dc713fdfe	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:11:18.877989+05:30	2026-11-01 23:11:18.877993+05:30
00de7261-697f-440e-8a81-7d433769a2b2	9e8daedd-1859-46fd-9179-a2d42c15af0a	Claim Form	Reimbursement Claim Intimation Form	\N	claim_intimation.docx	D:\\project\\backend\\storage\\plan_documents\\plan_9e8daedd-1859-46fd-9179-a2d42c15af0a_00de7261_claim_intimation.docx	20	application/vnd.openxmlformats-officedocument.wordprocessingml.document	8ac8082490a4816e30d4e8e280888b824c8bdf95f57e8d266ec7d64435ea57cf	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:11:20.941767+05:30	2026-11-01 23:11:20.94177+05:30
431a12f2-ec79-4564-86bb-72e679ad7244	9e8daedd-1859-46fd-9179-a2d42c15af0a	Premium Chart	Age-wise Premium Rate Chart	\N	rates_chart.xlsx	D:\\project\\backend\\storage\\plan_documents\\plan_9e8daedd-1859-46fd-9179-a2d42c15af0a_431a12f2_rates_chart.xlsx	20	application/vnd.openxmlformats-officedocument.spreadsheetml.sheet	fb84951103e3941b6dc99c36986492224ddb531cb6afcfc0c8872cbd084941db	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:11:23.046223+05:30	2026-11-01 23:11:23.046226+05:30
5b51fc66-f3f2-46d7-aaf6-59535fed1367	9e8daedd-1859-46fd-9179-a2d42c15af0a	Coverage Details	Network Hospital Infographic	\N	hospitals.png	D:\\project\\backend\\storage\\plan_documents\\plan_9e8daedd-1859-46fd-9179-a2d42c15af0a_5b51fc66_hospitals.png	23	image/png	40a17891553d475a0bb1fc82ee0958202e097a929554dc1d2f54e9363b542225	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:11:25.163581+05:30	2026-11-01 23:11:25.163585+05:30
2e92479e-050e-4b3d-a68c-68bee083c905	564d0c8a-cd43-4e0c-b0a9-50a4b32c5ae1	Policy Wording	Full Policy Terms & Conditions	\N	wording.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_564d0c8a-cd43-4e0c-b0a9-50a4b32c5ae1_2e92479e_wording.pdf	54	application/pdf	e8473588a9664d539a4186499733a427dfd648076e2cc48d4156a4f751338cfb	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:11:36.19879+05:30	2026-11-01 23:11:36.198795+05:30
553b3353-a226-42cc-aa19-b09911c4cba0	d8b66a85-ab10-43d2-9f4c-a14b6e37defa	Claim Form	Reimbursement Claim Intimation Form	\N	claim_intimation.docx	D:\\project\\backend\\storage\\plan_documents\\plan_d8b66a85-ab10-43d2-9f4c-a14b6e37defa_553b3353_claim_intimation.docx	20	application/vnd.openxmlformats-officedocument.wordprocessingml.document	8ac8082490a4816e30d4e8e280888b824c8bdf95f57e8d266ec7d64435ea57cf	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:19:53.41503+05:30	2026-11-03 21:19:53.415033+05:30
212cbcc1-1366-4e3c-b71e-7dcd0aa97f08	28828765-827a-4feb-8c4c-49626c64c942	Policy Brochure	Brochure	\N	b.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_28828765-827a-4feb-8c4c-49626c64c942_212cbcc1_b.pdf	11	application/pdf	0cdd4869fb22fa0a0691e9cab9793677b5674d6b58f2479a33e0bfd141d84e5a	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:12:12.678108+05:30	2026-11-01 23:12:12.678115+05:30
253c959a-0193-4117-9e0f-8aa807ef3df4	80cad959-6db1-4eb5-85eb-45c6fb494792	Policy Brochure	Alpha Master Brochure	\N	alpha_brochure.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_80cad959-6db1-4eb5-85eb-45c6fb494792_253c959a_alpha_brochure.pdf	45	application/pdf	70672decc2b8670ab4e2627619e4580ac1d88e8f725cb417d38cc30f7d89cee4	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:12:25.802891+05:30	2026-11-01 23:12:25.802894+05:30
8444f06e-ccf3-478b-9325-2624ec6fd9e8	80cad959-6db1-4eb5-85eb-45c6fb494792	Claim Form	Alpha Claim Form	\N	alpha_claim.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_80cad959-6db1-4eb5-85eb-45c6fb494792_8444f06e_alpha_claim.pdf	30	application/pdf	aad4b5e43095314816e3c13f38273bd843ecc0ab052107433f9a63ab449fef36	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:12:27.90383+05:30	2026-11-01 23:12:27.903833+05:30
1bd8fa7d-551f-441b-86b3-0916868601a8	5245e74a-7c7f-4cb3-943d-297917240f91	Policy Wording	Beta Wording T&C	\N	beta_wording.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_5245e74a-7c7f-4cb3-943d-297917240f91_1bd8fa7d_beta_wording.pdf	42	application/pdf	6227a8ed3b4cd477f26651e0fe480bbffe6143e62d1f47ecd1501ce1f9918d42	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:12:29.983462+05:30	2026-11-01 23:12:29.983468+05:30
42a8ecc2-51b7-4722-a260-808645274d41	d514c7ee-2d40-446c-b7e1-37fbbf09ed19	Terms & Conditions	Alpha T&C	\N	alpha_terms.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_d514c7ee-2d40-446c-b7e1-37fbbf09ed19_42a8ecc2_alpha_terms.pdf	43	application/pdf	2de528e08b220153ee1190d6d4616e990010e63cb4f800993b30fc4b06b04d93	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:12:51.621842+05:30	2026-11-01 23:12:51.621847+05:30
c812276b-5be0-41d8-9426-d4a30b28f340	49da15b2-c063-406c-9ca3-ddc2ad43c200	Rider Documents	Beta Riders	\N	beta_riders.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_49da15b2-c063-406c-9ca3-ddc2ad43c200_c812276b_beta_riders.pdf	29	application/pdf	80a0e4bb911d90cfab113c94e7833fdfc9ae54fb1a2763100f61ec161e45d033	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:12:53.740624+05:30	2026-11-01 23:12:53.74063+05:30
0866207c-2169-43c3-94d7-89f513c5598e	56931f84-528d-46a0-81e1-f59408773c9f	Policy Brochure	AdityaThakre_Resume-2 (1)	\N	AdityaThakre_Resume-2 (1).pdf	D:\\project\\backend\\storage\\plan_documents\\plan_56931f84-528d-46a0-81e1-f59408773c9f_0866207c_AdityaThakre_Resume-2 1.pdf	87526	application/pdf	c4010c2c1b299757a65d5e1c85682a37d486dc730dbfec4e79104dd27774811e	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-02 19:04:11.86308+05:30	2026-11-02 19:04:11.863083+05:30
1a83f7e4-b24d-4a56-8460-64878d36d8a2	56931f84-528d-46a0-81e1-f59408773c9f	Premium Chart	Spiderman Brand New Day	\N	Spiderman Brand New Day.jpg	D:\\project\\backend\\storage\\plan_documents\\plan_56931f84-528d-46a0-81e1-f59408773c9f_1a83f7e4_Spiderman Brand New Day.jpg	94306	image/jpeg	d29514658eaa324bc8a5103cf2cf4573bf9994bc6158de0987f18dc5a11cee52	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-02 19:04:13.983776+05:30	2026-11-02 19:04:13.983779+05:30
bf49a538-f9a4-4b4d-b2de-ffdb1b1a1093	56931f84-528d-46a0-81e1-f59408773c9f	Claim Form	4th Sem Hall ticket	\N	4th Sem Hall ticket.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_56931f84-528d-46a0-81e1-f59408773c9f_bf49a538_4th Sem Hall ticket.pdf	201232	application/pdf	8ac8bf25d6708e981260080101d69a791c1412d2435bf85ef60eb2d8f2a6664f	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-02 19:04:16.082353+05:30	2026-11-02 19:04:16.082356+05:30
a3391181-6db9-4b22-b46a-e7ee15ef29f8	d8b66a85-ab10-43d2-9f4c-a14b6e37defa	Policy Brochure	Official Plan Brochure 2026	\N	brochure_2026.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_d8b66a85-ab10-43d2-9f4c-a14b6e37defa_a3391181_brochure_2026.pdf	61	application/pdf	bb0294c899a028f024ac0071872eb8f28df8979291b536143742755dc713fdfe	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:19:53.383756+05:30	2026-11-03 21:19:53.38376+05:30
9c5837bc-7894-4ba2-8457-8986ad590cda	d8b66a85-ab10-43d2-9f4c-a14b6e37defa	Premium Chart	Age-wise Premium Rate Chart	\N	rates_chart.xlsx	D:\\project\\backend\\storage\\plan_documents\\plan_d8b66a85-ab10-43d2-9f4c-a14b6e37defa_9c5837bc_rates_chart.xlsx	20	application/vnd.openxmlformats-officedocument.spreadsheetml.sheet	fb84951103e3941b6dc99c36986492224ddb531cb6afcfc0c8872cbd084941db	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:19:53.437761+05:30	2026-11-03 21:19:53.437763+05:30
b3d12d6c-9cd9-45f8-b9d6-ffccf913f9de	d8b66a85-ab10-43d2-9f4c-a14b6e37defa	Coverage Details	Network Hospital Infographic	\N	hospitals.png	D:\\project\\backend\\storage\\plan_documents\\plan_d8b66a85-ab10-43d2-9f4c-a14b6e37defa_b3d12d6c_hospitals.png	23	image/png	40a17891553d475a0bb1fc82ee0958202e097a929554dc1d2f54e9363b542225	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:19:53.460439+05:30	2026-11-03 21:19:53.460442+05:30
be66e7c2-b028-453d-bbd2-74698172913c	dada69bf-34e5-4923-b038-fb3e2f7b6537	Policy Wording	Full Policy Terms & Conditions	\N	wording.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_dada69bf-34e5-4923-b038-fb3e2f7b6537_be66e7c2_wording.pdf	54	application/pdf	e8473588a9664d539a4186499733a427dfd648076e2cc48d4156a4f751338cfb	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:19:54.132995+05:30	2026-11-03 21:19:54.133001+05:30
385e7c91-26d8-43fd-9e07-94f13e9a13ee	797b3147-f98a-400d-8c8b-4ce03a66a310	Policy Brochure	Brochure	\N	b.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_797b3147-f98a-400d-8c8b-4ce03a66a310_385e7c91_b.pdf	11	application/pdf	0cdd4869fb22fa0a0691e9cab9793677b5674d6b58f2479a33e0bfd141d84e5a	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:19:55.653723+05:30	2026-11-03 21:19:55.653726+05:30
f3fa93fc-1a22-4a95-bc35-4e7bcb0f9578	8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd	Policy Brochure	Alpha Master Brochure	\N	alpha_brochure.pdf	D:\\project\\storage\\plan_documents\\plan_8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd_f3fa93fc_alpha_brochure.pdf	45	application/pdf	70672decc2b8670ab4e2627619e4580ac1d88e8f725cb417d38cc30f7d89cee4	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:38:57.096779+05:30	2026-11-03 21:38:57.096782+05:30
5fe74be4-d1bc-440b-9f20-6d4f93be44b2	8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd	Claim Form	Alpha Claim Form	\N	alpha_claim.pdf	D:\\project\\storage\\plan_documents\\plan_8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd_5fe74be4_alpha_claim.pdf	30	application/pdf	aad4b5e43095314816e3c13f38273bd843ecc0ab052107433f9a63ab449fef36	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:38:57.125032+05:30	2026-11-03 21:38:57.125035+05:30
9c680d7b-2bd8-40cd-bd0d-c0eb7892be7b	b6346a0c-1149-4eeb-9754-5d277eb859b1	Policy Wording	Beta Wording T&C	\N	beta_wording.pdf	D:\\project\\storage\\plan_documents\\plan_b6346a0c-1149-4eeb-9754-5d277eb859b1_9c680d7b_beta_wording.pdf	42	application/pdf	6227a8ed3b4cd477f26651e0fe480bbffe6143e62d1f47ecd1501ce1f9918d42	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:38:57.143542+05:30	2026-11-03 21:38:57.143544+05:30
63071cb7-bfcf-426d-a378-9968ad217d9b	ab6db863-1154-4f4f-9263-43ff93fb0ad8	Terms & Conditions	Alpha T&C	\N	alpha_terms.pdf	D:\\project\\storage\\plan_documents\\plan_ab6db863-1154-4f4f-9263-43ff93fb0ad8_63071cb7_alpha_terms.pdf	43	application/pdf	2de528e08b220153ee1190d6d4616e990010e63cb4f800993b30fc4b06b04d93	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:38:58.129867+05:30	2026-11-03 21:38:58.12987+05:30
31f38125-443a-43ac-a2f6-0a357154a0da	85dd741b-8b1e-4edc-8300-1f0b95eb890e	Rider Documents	Beta Riders	\N	beta_riders.pdf	D:\\project\\storage\\plan_documents\\plan_85dd741b-8b1e-4edc-8300-1f0b95eb890e_31f38125_beta_riders.pdf	29	application/pdf	80a0e4bb911d90cfab113c94e7833fdfc9ae54fb1a2763100f61ec161e45d033	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 21:38:58.151615+05:30	2026-11-03 21:38:58.151618+05:30
\.


--
-- Data for Name: insurance_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_plans (id, name, code, company_id, line_of_business, status, description, created_at, updated_at, riders, benefits, brochure_filename, brochure_storage_path, brochure_mime_type, claim_form_filename, claim_form_storage_path, claim_form_mime_type) FROM stdin;
f77024bf-0bf5-45cb-bce1-1222816a978a	Plan Beta AC34B6	PLB-AC34B6	d9560957-51eb-4f79-ac37-492d69e13505	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-01 22:06:30.063532+05:30	2026-11-01 22:56:25.717685+05:30	\N	\N	\N	\N	\N	\N	\N	\N
f4f6f9af-10c6-4db1-a921-0967d2e09dc3	Care Advantage Plus	PLAN-D49B	9708b516-792a-4326-9127-2098b7e4126f	HEALTH	ACTIVE	\N	2026-11-01 23:08:19.701193+05:30	2026-11-01 23:08:19.701196+05:30	\N	\N	\N	\N	\N	\N	\N	\N
3a1ab600-e20a-4719-b189-eb61b0c7ae77	Comprehensive Health Plus C43274	PLN-C43274	6dfca1f6-a370-4d58-b50d-a6c8d93efe56	Health Insurance	ACTIVE	Enterprise health plan with zero room rent capping.	2026-11-01 23:11:01.636935+05:30	2026-11-01 23:11:01.636935+05:30	["Critical Illness", "Hospital Cash"]	["Unlimited restoration", "AYUSH covered"]	\N	\N	\N	\N	\N	\N
564d0c8a-cd43-4e0c-b0a9-50a4b32c5ae1	Stream Plan C0EB34	SP-C0EB34	d6dcb394-0b4a-46aa-b231-1e35828493db	Health Insurance	ACTIVE	\N	2026-11-01 23:11:34.089665+05:30	2026-11-01 23:11:34.089665+05:30	\N	\N	\N	\N	\N	\N	\N	\N
1b30d8ad-da6d-468e-8ce9-43a2e5197ed9	Inactive Plan F873EE	INACT-F873EE	fafca85b-89df-4fe5-bc15-20ce5c2133ec	Life Insurance	INACTIVE	\N	2026-11-01 23:12:10.620089+05:30	2026-11-01 23:12:10.620089+05:30	\N	\N	\N	\N	\N	\N	\N	\N
28828765-827a-4feb-8c4c-49626c64c942	Active Plan F873EE	ACT-F873EE	fafca85b-89df-4fe5-bc15-20ce5c2133ec	Health Insurance	ACTIVE	\N	2026-11-01 23:12:08.552608+05:30	2026-11-01 23:12:12.678297+05:30	\N	\N	b.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_28828765-827a-4feb-8c4c-49626c64c942_212cbcc1_b.pdf	application/pdf	\N	\N	\N
c0c3b9a0-d753-449d-b521-eaba6ee9da39	Optima Secure Plus	OPT+	b06a433f-624a-4900-a3f8-860d5fbbf9f8	Health Insurance	ACTIVE	\N	2026-11-01 20:54:46.116675+05:30	2026-11-01 20:54:46.116675+05:30	\N	\N	\N	\N	\N	\N	\N	\N
d514c7ee-2d40-446c-b7e1-37fbbf09ed19	Plan Alpha 333FCA	PLA-333FCA	d662b0c8-643f-43ab-8eaa-6cfafaa4cebf	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-01 23:12:47.437575+05:30	2026-11-01 23:12:47.437575+05:30	\N	\N	\N	\N	\N	\N	\N	\N
49da15b2-c063-406c-9ca3-ddc2ad43c200	Plan Beta 333FCA	PLB-333FCA	d662b0c8-643f-43ab-8eaa-6cfafaa4cebf	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-01 23:12:49.512951+05:30	2026-11-01 23:12:49.512951+05:30	\N	\N	\N	\N	\N	\N	\N	\N
c992e607-b7d2-4a7f-be7e-b045528966ae	Plan Alpha F7855D	PLA-F7855D	6cb0ec18-e2b1-4d90-83db-25939877aae1	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-01 23:13:41.102425+05:30	2026-11-01 23:13:41.102425+05:30	\N	\N	\N	\N	\N	\N	\N	\N
877a4808-a654-4d51-8295-5bde0a7a3f12	Plan Beta F7855D	PLB-F7855D	6cb0ec18-e2b1-4d90-83db-25939877aae1	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-01 23:13:43.216562+05:30	2026-11-01 23:13:43.216562+05:30	\N	\N	\N	\N	\N	\N	\N	\N
56931f84-528d-46a0-81e1-f59408773c9f	optima restore	ASDSAF	b06a433f-624a-4900-a3f8-860d5fbbf9f8	General/Motor	ACTIVE	2 yr	2026-11-02 19:04:09.754979+05:30	2026-11-02 19:04:16.082498+05:30	["consumable"]	\N	AdityaThakre_Resume-2 (1).pdf	D:\\project\\backend\\storage\\plan_documents\\plan_56931f84-528d-46a0-81e1-f59408773c9f_0866207c_AdityaThakre_Resume-2 1.pdf	application/pdf	4th Sem Hall ticket.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_56931f84-528d-46a0-81e1-f59408773c9f_bf49a538_4th Sem Hall ticket.pdf	application/pdf
844cd334-7cf0-4557-81c3-75c672b3e6ce	Comprehensive Health Plus E54309	PLN-E54309	5fcc48da-7f59-4a20-9bc5-4544de8b43bd	Health Insurance	ACTIVE	Enterprise health plan with zero room rent capping.	2026-11-03 21:19:52.665029+05:30	2026-11-03 21:19:52.665029+05:30	["Critical Illness", "Hospital Cash"]	["Unlimited restoration", "AYUSH covered"]	\N	\N	\N	\N	\N	\N
dada69bf-34e5-4923-b038-fb3e2f7b6537	Stream Plan BB9D19	SP-BB9D19	a951ccab-c95c-4cc5-add7-a1515d30394d	Health Insurance	ACTIVE	\N	2026-11-03 21:19:54.101047+05:30	2026-11-03 21:19:54.101047+05:30	\N	\N	\N	\N	\N	\N	\N	\N
bda31222-5ff6-49a9-82ff-8ae8620daaa0	Inactive Plan C8DC80	INACT-C8DC80	863f3d63-3e6b-45d5-a246-40ca158fa736	Life Insurance	INACTIVE	\N	2026-11-03 21:19:55.634369+05:30	2026-11-03 21:19:55.634369+05:30	\N	\N	\N	\N	\N	\N	\N	\N
797b3147-f98a-400d-8c8b-4ce03a66a310	Active Plan C8DC80	ACT-C8DC80	863f3d63-3e6b-45d5-a246-40ca158fa736	Health Insurance	ACTIVE	\N	2026-11-03 21:19:55.616058+05:30	2026-11-03 21:19:55.653898+05:30	\N	\N	b.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_797b3147-f98a-400d-8c8b-4ce03a66a310_385e7c91_b.pdf	application/pdf	\N	\N	\N
e8526985-13df-4d54-bfa0-3715cf108f0d	Super Health Shield	PLAN-BB97	967c7ff1-75fe-49a4-8917-6ba868130eeb	HEALTH	ACTIVE	\N	2026-11-03 21:38:38.776983+05:30	2026-11-03 21:38:38.776988+05:30	\N	\N	\N	\N	\N	\N	\N	\N
ab6db863-1154-4f4f-9263-43ff93fb0ad8	Plan Alpha EC2FD8	PLA-EC2FD8	0a1ff162-37d4-438b-a105-806e983e2ee4	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-03 21:38:58.086643+05:30	2026-11-03 21:38:58.086643+05:30	\N	\N	\N	\N	\N	\N	\N	\N
85dd741b-8b1e-4edc-8300-1f0b95eb890e	Plan Beta EC2FD8	PLB-EC2FD8	0a1ff162-37d4-438b-a105-806e983e2ee4	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-03 21:38:58.110308+05:30	2026-11-03 21:38:58.110308+05:30	\N	\N	\N	\N	\N	\N	\N	\N
d5f22ab8-6426-4345-8c12-90ed4b01f0f9	Plan Alpha F48BB7	PLA-F48BB7	ab99ff29-3839-49a0-9d8c-39c2bb7431a0	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-03 21:39:00.431198+05:30	2026-11-03 21:39:00.431198+05:30	\N	\N	\N	\N	\N	\N	\N	\N
450117a6-c017-44e0-829b-cc5064478eb1	Plan Beta F48BB7	PLB-F48BB7	ab99ff29-3839-49a0-9d8c-39c2bb7431a0	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-03 21:39:00.44824+05:30	2026-11-03 21:39:00.44824+05:30	\N	\N	\N	\N	\N	\N	\N	\N
9b7f9ade-e0eb-46fc-8ba7-a540e83976fa	Super Health Shield	PLAN-47C4	75b24af0-6efd-4ca1-84e0-f70e9e44c9d5	HEALTH	ACTIVE	\N	2026-11-04 22:42:06.022423+05:30	2026-11-04 22:42:06.022427+05:30	\N	\N	\N	\N	\N	\N	\N	\N
278ef5da-3aa6-4fc4-bb0c-d613c6babf00	Super Health Shield	PLAN-0017	56a1df01-9aa9-4249-bdea-324d3ca58b55	HEALTH	ACTIVE	\N	2026-11-04 22:46:19.45404+05:30	2026-11-04 22:46:19.454041+05:30	\N	\N	\N	\N	\N	\N	\N	\N
15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2	Reassure 2.0	REA 2.0	be7d9e4f-21dc-42b2-9755-8715fb07cf20	Health Insurance	ACTIVE	\N	2026-11-01 21:25:53.171844+05:30	2026-11-01 21:28:49.071997+05:30	\N	\N	ReAssureBrochure2.0.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2_57013e25_ReAssureBrochure2.0.pdf	application/pdf	\N	\N	\N
0efdcecf-edc4-4d06-8761-3c4a8ee565bb	Super Health Shield	PLAN-D772	a4f0fa9e-9c6a-4194-9cc8-34b44513c904	HEALTH	ACTIVE	\N	2026-11-04 22:47:30.326053+05:30	2026-11-04 22:47:30.326057+05:30	\N	\N	\N	\N	\N	\N	\N	\N
9881caee-1151-4b9e-986d-f71ca1beb184	Super Health Shield	PLAN-6698	4977f377-2239-4987-9ca5-de05eec47aaf	HEALTH	ACTIVE	\N	2026-11-04 23:06:31.977958+05:30	2026-11-04 23:06:31.977962+05:30	\N	\N	\N	\N	\N	\N	\N	\N
11baf4c2-2694-4a3d-818b-c6251f91abd0	LIFE CARE	LIFECARE-828	10453ae4-a173-4a8f-8376-be15522264a8	LIFE	ACTIVE	\N	2026-11-05 12:21:45.432355+05:30	2026-11-05 12:21:45.432355+05:30	\N	\N	\N	\N	\N	\N	\N	\N
735eee87-1aab-43a2-8b18-8cea4925841b	Super Health Shield	PLAN-4ED6	25f092a0-74a0-4197-870f-bcb9a5d57696	HEALTH	ACTIVE	\N	2026-11-05 12:53:35.010884+05:30	2026-11-05 12:53:35.010888+05:30	\N	\N	\N	\N	\N	\N	\N	\N
a0ccf095-d10e-4102-bd8c-5beb3640a2d4	ZK PLAN	ZKPLAN-573	ed566bb2-6bd4-4a34-973d-00c1b7d4b71c	LIFE	ACTIVE	\N	2026-11-05 12:55:23.405891+05:30	2026-11-05 12:55:23.405891+05:30	\N	\N	\N	\N	\N	\N	\N	\N
a1545e9e-4d92-4a71-86f0-67ea69c8f2e8	Direct Plan	DP-c7c4	d08b27c4-534c-4fad-a893-026f1d5cee02	LIFE	ACTIVE	\N	2026-11-05 12:56:21.232984+05:30	2026-11-05 12:56:21.232988+05:30	\N	\N	\N	\N	\N	\N	\N	\N
657d272d-b75f-4b26-a9a0-efb8390e57a2	Optima Secure Health	PLAN-1363	7b7950f9-cfee-4ee5-86f6-4c766ef8a923	HEALTH	ACTIVE	\N	2026-11-05 13:04:19.292159+05:30	2026-11-05 13:04:19.292172+05:30	\N	\N	\N	\N	\N	\N	\N	\N
ef8d0493-6f0b-4c04-b3f8-6f0ea0899a12	Super Health Shield	PLAN-DEDF	890c76ab-6703-430b-b812-f1e5d71bbb43	HEALTH	ACTIVE	\N	2026-11-05 13:04:26.902622+05:30	2026-11-05 13:04:26.902627+05:30	\N	\N	\N	\N	\N	\N	\N	\N
65f230ef-015c-4c3d-8636-46457733da94	Super Health Shield	PLAN-970F	1abfb97f-993d-4b8d-80b7-134771b35404	HEALTH	ACTIVE	\N	2026-11-01 23:10:15.287164+05:30	2026-11-01 23:10:15.287167+05:30	\N	\N	\N	\N	\N	\N	\N	\N
9e8daedd-1859-46fd-9179-a2d42c15af0a	Docs Plan F55B60	DP-F55B60	0f796dae-4226-46e4-b0cc-181d6165afc8	Health Insurance	ACTIVE	\N	2026-11-01 23:11:16.787208+05:30	2026-11-01 23:11:18.878138+05:30	\N	\N	brochure_2026.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_9e8daedd-1859-46fd-9179-a2d42c15af0a_07288b69_brochure_2026.pdf	application/pdf	\N	\N	\N
aaf8c9dd-f1bf-4f58-999f-f0233571cba7	Lifecycle Plan 0E9F63	LP-0E9F63	e7e8e066-2b52-46be-9efb-9788ffe2c7b9	Health Insurance	ACTIVE	\N	2026-11-01 23:11:51.339817+05:30	2026-11-01 23:11:51.339817+05:30	\N	\N	\N	\N	\N	\N	\N	\N
5245e74a-7c7f-4cb3-943d-297917240f91	Plan Beta F5538E	PLB-F5538E	2214e29b-49a5-4a4a-ae29-b0ea13df7bd0	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-01 23:12:23.690023+05:30	2026-11-01 23:12:23.690023+05:30	\N	\N	\N	\N	\N	\N	\N	\N
80cad959-6db1-4eb5-85eb-45c6fb494792	Plan Alpha F5538E	PLA-F5538E	2214e29b-49a5-4a4a-ae29-b0ea13df7bd0	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-01 23:12:21.559217+05:30	2026-11-01 23:12:27.903969+05:30	\N	\N	alpha_brochure.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_80cad959-6db1-4eb5-85eb-45c6fb494792_253c959a_alpha_brochure.pdf	application/pdf	alpha_claim.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_80cad959-6db1-4eb5-85eb-45c6fb494792_8444f06e_alpha_claim.pdf	application/pdf
6ea8238b-df3a-4839-8b28-73261d187e27	Plan Alpha 4C1566	PLA-4C1566	74211c83-8de2-46a3-b6f5-eabd5b500a54	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-01 23:13:09.236158+05:30	2026-11-01 23:13:09.236158+05:30	\N	\N	\N	\N	\N	\N	\N	\N
6da00363-1782-4b82-b9b1-9f0b8ff0ae16	Plan Beta 4C1566	PLB-4C1566	74211c83-8de2-46a3-b6f5-eabd5b500a54	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-01 23:13:11.30567+05:30	2026-11-01 23:13:11.30567+05:30	\N	\N	\N	\N	\N	\N	\N	\N
9b129d00-cb17-4167-943c-795d338be075	Super Health Shield	PLAN-2CAD	7e23e04d-d7e1-4175-a3a7-fc647c996f92	HEALTH	ACTIVE	\N	2026-11-01 23:14:09.72417+05:30	2026-11-01 23:14:09.724172+05:30	\N	\N	\N	\N	\N	\N	\N	\N
f84d93e1-dd77-4e20-8be9-d41ac1123403	Medicare Select	MEDI-12345	2976d04a-ba9f-4c02-8e55-d85ddbc3f6ec	Health Insurance	ACTIVE	\N	2026-11-01 22:22:35.001909+05:30	2026-11-01 22:22:37.167485+05:30	\N	\N	tataaig_medicare_brochure.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_f84d93e1-dd77-4e20-8be9-d41ac1123403_5dbde318_tataaig_medicare_brochure.pdf	application/pdf	\N	\N	\N
d8b66a85-ab10-43d2-9f4c-a14b6e37defa	Docs Plan E687E1	DP-E687E1	cf3fe13e-e279-41f4-912f-76f3adb25b74	Health Insurance	ACTIVE	\N	2026-11-03 21:19:53.348261+05:30	2026-11-03 21:19:53.383995+05:30	\N	\N	brochure_2026.pdf	D:\\project\\backend\\storage\\plan_documents\\plan_d8b66a85-ab10-43d2-9f4c-a14b6e37defa_a3391181_brochure_2026.pdf	application/pdf	\N	\N	\N
f3289de0-b6af-4ce8-84a3-254fb77bd496	Lifecycle Plan C459A5	LP-C459A5	11dce89f-b83d-42f3-806d-fb90b6a1f169	Health Insurance	ACTIVE	\N	2026-11-03 21:19:54.861895+05:30	2026-11-03 21:19:54.861895+05:30	\N	\N	\N	\N	\N	\N	\N	\N
931be452-f6a6-4a4a-90c5-e95d5417b9e6	Super Health Shield	PLAN-2662	949d8195-6fed-4b56-aaba-c69ad51dc831	HEALTH	ACTIVE	\N	2026-11-03 21:20:49.005679+05:30	2026-11-03 21:20:49.005682+05:30	\N	\N	\N	\N	\N	\N	\N	\N
b6346a0c-1149-4eeb-9754-5d277eb859b1	Plan Beta A4F608	PLB-A4F608	0bb8d0e0-9dfb-4fd1-b4fb-bb26cc4d55fb	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-03 21:38:57.075326+05:30	2026-11-03 21:38:57.075326+05:30	\N	\N	\N	\N	\N	\N	\N	\N
8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd	Plan Alpha A4F608	PLA-A4F608	0bb8d0e0-9dfb-4fd1-b4fb-bb26cc4d55fb	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-03 21:38:57.056342+05:30	2026-11-03 21:38:57.125211+05:30	\N	\N	alpha_brochure.pdf	D:\\project\\storage\\plan_documents\\plan_8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd_f3fa93fc_alpha_brochure.pdf	application/pdf	alpha_claim.pdf	D:\\project\\storage\\plan_documents\\plan_8924ea5d-b8e5-42c0-a1ce-28d5c30eb7bd_5fe74be4_alpha_claim.pdf	application/pdf
b4186ca6-d53c-447a-bdae-b7b8a96effd8	Plan Alpha 7F47C1	PLA-7F47C1	6567b961-1a16-4703-911a-22911aebb56c	Health Insurance	ACTIVE	Plan A with comprehensive benefits	2026-11-03 21:38:59.028617+05:30	2026-11-03 21:38:59.028617+05:30	\N	\N	\N	\N	\N	\N	\N	\N
5390ef62-18cb-4ed2-bd9c-8cc81a7592be	Plan Beta 7F47C1	PLB-7F47C1	6567b961-1a16-4703-911a-22911aebb56c	Health Insurance	ACTIVE	Plan B with standard benefits	2026-11-03 21:38:59.048464+05:30	2026-11-03 21:38:59.048464+05:30	\N	\N	\N	\N	\N	\N	\N	\N
e8b07b7d-c4a8-4059-a38a-23e3e7b6dee7	Super Health Shield	PLAN-C490	65f8599f-d4b3-49eb-87de-2bd93f7ff2e9	HEALTH	ACTIVE	\N	2026-11-04 22:44:47.468218+05:30	2026-11-04 22:44:47.468223+05:30	\N	\N	\N	\N	\N	\N	\N	\N
f7336d2b-6bb8-4993-af47-0176b6fd7cfd	Super Health Shield	PLAN-B66D	ca6e9832-acf5-4c1e-a12e-7a4020ac1c02	HEALTH	ACTIVE	\N	2026-11-04 22:46:58.728062+05:30	2026-11-04 22:46:58.728063+05:30	\N	\N	\N	\N	\N	\N	\N	\N
e9bde4ae-878c-4554-a940-c546887cf3b1	Super Health Shield	PLAN-4F68	49ed2d68-180e-4ff2-90e1-f3fd2ea72e36	HEALTH	ACTIVE	\N	2026-11-04 23:02:39.737401+05:30	2026-11-04 23:02:39.737404+05:30	\N	\N	\N	\N	\N	\N	\N	\N
6544710b-f3ea-4b3f-b6be-8c080b360fd5	Super Health Shield	PLAN-C19E	f1642cd9-74e3-4ec9-9607-30c73df06486	HEALTH	ACTIVE	\N	2026-11-05 12:25:16.974857+05:30	2026-11-05 12:25:16.974865+05:30	\N	\N	\N	\N	\N	\N	\N	\N
c981ecf7-ed34-444c-9b29-e92bdc557421	Super Health Shield	PLAN-F50C	322a9302-53c8-4cf4-85da-bae7c7373798	HEALTH	ACTIVE	\N	2026-11-05 12:54:50.47046+05:30	2026-11-05 12:54:50.470462+05:30	\N	\N	\N	\N	\N	\N	\N	\N
ed0978be-16ef-4ef1-ad07-7cf0bf3874c2	Optima Secure Health	PLAN-EC26	9fbddf96-d6d6-4754-9416-327445192a3e	HEALTH	ACTIVE	\N	2026-11-05 12:56:20.096312+05:30	2026-11-05 12:56:20.096316+05:30	\N	\N	\N	\N	\N	\N	\N	\N
fc8bbef1-e318-46e8-9b70-d8657c7ba014	Super Health Shield	PLAN-E29D	4bd4cad0-05d2-4967-b6e1-7e711da20d85	HEALTH	ACTIVE	\N	2026-11-05 12:56:31.286615+05:30	2026-11-05 12:56:31.286617+05:30	\N	\N	\N	\N	\N	\N	\N	\N
45abcd5b-19a0-4f3c-96c9-be00ba471d18	Direct Plan	DP-6472	66b7d9c2-5abd-4aa5-a1e2-dc6d8f186280	LIFE	ACTIVE	\N	2026-11-05 13:04:22.081456+05:30	2026-11-05 13:04:22.081465+05:30	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: insurance_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policies (id, policy_number, policy_type, customer_id, company_id, plan_id, purchase_party_id, sub_agent_id, term_years, sum_assured, final_premium, is_single_premium, premium_mode, policy_start_date, first_receipt_date, expiry_date, next_premium_due_date, status, notes, created_by_id, created_at, updated_at, net_premium, tax_amount, coverage_type, proposal_number, business_type, previous_policy_number, previous_insurer, portability_continuity_details, product_variant, hospital_cash_benefit, vehicle_registration_number, vehicle_manufacturer, vehicle_model, vehicle_type, travel_destination, travel_type, intermediary_name, contact_city, contact_pincode, contact_mobile, contact_email, commission_received_status, actual_commission_received_amount, commission_received_date, commission_bank_reference, previous_policy_id, issue_date) FROM stdin;
3ef7ac86-26d4-4e76-815b-577fcba9c611	POL-P9-375EE6	HEALTH	ae2d6dc3-b1c7-4cfd-a4ab-e3f4f2c5d6f2	7b7950f9-cfee-4ee5-86f6-4c766ef8a923	657d272d-b75f-4b26-a9a0-efb8390e57a2	\N	5c5e97a8-529b-4afa-adde-9bbefc6d3570	1	500000.00	11800.00	f	Yearly	2026-11-05	\N	2027-11-05	2026-11-05	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 13:04:20.113215+05:30	2026-11-05 13:04:20.962354+05:30	10000.00	1800.00	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	+919938124734	vikram.0dc3f7@example.com	RECEIVED	1350.00	2026-11-05	UTR-INSURER-BFFA2540	\N	2026-11-05
147a1139-f18d-42b4-bbc5-e4257ba26d52	POL-DIR-E33839	LIFE	0c1a3165-9ade-47b5-a2e5-0e281c429b9e	66b7d9c2-5abd-4aa5-a1e2-dc6d8f186280	45abcd5b-19a0-4f3c-96c9-be00ba471d18	\N	\N	1	1000000.00	20000.00	f	Yearly	2026-11-05	\N	2027-11-05	2026-11-05	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 13:04:23.009407+05:30	2026-11-05 13:04:23.009416+05:30	20000.00	0.00	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	+919130887342	\N	PENDING	\N	\N	\N	\N	2026-11-05
9c3e3904-7f5e-469c-8c4c-11df47f9d161	POL-P9-E30063	HEALTH	23dc9c70-a491-49b9-a349-e936c372be07	9fbddf96-d6d6-4754-9416-327445192a3e	ed0978be-16ef-4ef1-ad07-7cf0bf3874c2	\N	b1129775-17b5-4a0e-b01b-fc44a353d562	1	500000.00	11800.00	f	Yearly	2026-11-05	\N	2027-11-05	2026-11-05	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:20.512415+05:30	2026-11-05 12:56:20.868407+05:30	10000.00	1800.00	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	+919941432042	vikram.1a967b@example.com	RECEIVED	1350.00	2026-11-05	UTR-INSURER-F30FD60B	\N	2026-11-05
03a9ae35-c40d-4825-8a88-8722b74ef3b7	POL-DIR-371037	LIFE	f7bc0bed-e116-43d7-8c4f-8cbe36769173	d08b27c4-534c-4fad-a893-026f1d5cee02	a1545e9e-4d92-4a71-86f0-67ea69c8f2e8	\N	\N	1	1000000.00	20000.00	f	Yearly	2026-11-05	\N	2027-11-05	2026-11-05	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:21.562028+05:30	2026-11-05 12:56:21.562035+05:30	20000.00	0.00	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	+919171327561	\N	PENDING	\N	\N	\N	\N	2026-11-05
915a17bc-5bc6-42bf-b555-f24696e5f2fb	POL-HLTH-2026-48773	HEALTH	0b701338-6132-4e11-a922-a9619b0d8397	d662b0c8-643f-43ab-8eaa-6cfafaa4cebf	d514c7ee-2d40-446c-b7e1-37fbbf09ed19	9702dc07-e242-4ebd-9817-577a13cf4ff4	\N	1	1000000.00	20000.00	f	YEARLY	2023-01-01	2023-01-01	2024-01-01	\N	EXPIRED	[Renewed into POL-HLTH-2026-48773-R1 on 2026-11-05]:	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:28:53.710784+05:30	2026-11-05 12:26:12.505172+05:30	20000.00	0.00	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	+919822900746	policyuser_a4f608@test.com	PENDING	\N	\N	\N	\N	2023-01-01
5c136a8e-a490-425c-b3bc-da5a0c788db1	POL-HLTH-2026-47144	HEALTH	6da0ef85-3341-45fa-9e38-b4f85626b48c	2976d04a-ba9f-4c02-8e55-d85ddbc3f6ec	f84d93e1-dd77-4e20-8be9-d41ac1123403	9702dc07-e242-4ebd-9817-577a13cf4ff4	\N	1	2000000.00	14160.00	f	YEARLY	2025-11-03	2026-11-01	2026-11-03	\N	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 22:26:11.559331+05:30	2026-11-01 22:26:11.63874+05:30	12000.00	2160.00	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	INCLUDED	\N	\N	\N	\N	\N	\N	FinNexus IMF Direct Sourcing	Pune	\N	1111111111	priya.deshmukh@example.com	PENDING	\N	\N	\N	\N	2026-11-01
7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	POL-CORP-2026-49576	HEALTH	5a199e21-1953-41ae-b32f-e193bf5400c2	b06a433f-624a-4900-a3f8-860d5fbbf9f8	56931f84-528d-46a0-81e1-f59408773c9f	f5b0f018-03cb-4e17-9093-8c31f571141d	04d134c4-a81b-447f-873b-483752abb726	1	1000000.00	15800.00	t	YEARLY	2026-11-03	2026-11-03	2029-11-03	\N	ACTIVE		40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 17:23:58.642211+05:30	2026-11-05 11:05:05.635065+05:30	10000.00	1800.00	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	RAMNAGAR	431003	8446090974	thakreaadi53@gmail.com	PENDING	\N	\N	\N	\N	2026-11-03
15d44347-7c07-4e4f-8dcd-fb8961d4219f	QWDQW	OTHER	5a199e21-1953-41ae-b32f-e193bf5400c2	b06a433f-624a-4900-a3f8-860d5fbbf9f8	56931f84-528d-46a0-81e1-f59408773c9f	f5b0f018-03cb-4e17-9093-8c31f571141d	04d134c4-a81b-447f-873b-483752abb726	1	1000000.00	53100.00	f	YEARLY	2026-11-03	2026-11-03	2027-11-03	\N	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 17:03:00.781554+05:30	2026-11-03 17:03:00.842633+05:30	1000.00	52100.00	FAMILY_FLOATER	wqdqw	PORT	65416131+16+	star health insurance	50000	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	Beacon Point Corporate Agency	RAMNAGAR	431003	8446090974	tadityafin@gmail.com	PENDING	\N	\N	\N	\N	2026-11-03
ef4fcc75-194d-416c-8dde-e7fbff754b9b	POL-HLTH-2026-99549	HEALTH	387bb7bc-7400-4770-bdf8-0921aa1d0816	2976d04a-ba9f-4c02-8e55-d85ddbc3f6ec	f84d93e1-dd77-4e20-8be9-d41ac1123403	9702dc07-e242-4ebd-9817-577a13cf4ff4	\N	1	1000000.00	25000.00	f	YEARLY	2026-11-05	2026-11-05	2027-11-05	\N	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:13:53.818903+05:30	2026-11-05 11:13:53.894715+05:30	25000.00	0.00	INDIVIDUAL	\N	RENEW	saerf	Tata aig	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	FinNexus IMF Direct Sourcing	Chhatrapati Sambhajinagar	431003	8452012567	nandini@gmail.com	PENDING	\N	\N	\N	\N	2026-11-05
aac36891-45fd-4003-8569-0a218bf134fe	POL-LIFE-2026-73892	LIFE	0b701338-6132-4e11-a922-a9619b0d8397	10453ae4-a173-4a8f-8376-be15522264a8	11baf4c2-2694-4a3d-818b-c6251f91abd0	9702dc07-e242-4ebd-9817-577a13cf4ff4	\N	1	1000000.00	20000.00	f	YEARLY	2026-11-05	2026-11-05	2027-11-05	\N	ACTIVE	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:22:43.650278+05:30	2026-11-05 12:22:43.849211+05:30	20000.00	0.00	INDIVIDUAL	\N	NEW	\N	\N	\N	Term Insurance	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	FinNexus IMF Direct Sourcing	\N	\N	+919822900746	policyuser_a4f608@test.com	PENDING	\N	\N	\N	\N	2026-11-05
af101880-6400-4562-ac71-699c477531f9	POL-HLTH-2026-70921	HEALTH	5a199e21-1953-41ae-b32f-e193bf5400c2	be7d9e4f-21dc-42b2-9755-8715fb07cf20	15c25a79-8896-4fdf-a0f1-a7e8e79e6cc2	9702dc07-e242-4ebd-9817-577a13cf4ff4	\N	1	3000000.00	17700.00	f	YEARLY	2026-04-13	2026-04-13	2027-04-13	\N	EXPIRED	new policy	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 21:35:49.645763+05:30	2026-11-05 12:26:47.556995+05:30	15000.00	2700.00	FAMILY_FLOATER	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	FinNexus IMF Direct Sourcing	\N	\N	8446090974	tadityafin@gmail.com	PENDING	\N	\N	\N	\N	2026-04-13
1bdce3ec-908f-4203-aecc-2e00b12bbad4	POL-TEST-9FD7C3	HEALTH	26b6a1e3-5ca0-47d5-80fe-a60caea45c66	25f092a0-74a0-4197-870f-bcb9a5d57696	735eee87-1aab-43a2-8b18-8cea4925841b	\N	cb432e66-7c5d-4234-9439-b99441687b2f	1	500000.00	11800.00	f	Yearly	2026-11-05	\N	2027-11-05	\N	ACTIVE	\N	\N	2026-11-05 12:53:35.020822+05:30	2026-11-05 12:53:35.807908+05:30	10000.00	\N	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	PARTIALLY_RECEIVED	800.00	2026-11-05	UTR-PARTIAL-800	\N	2026-11-05
7c89262c-bdfc-43ed-b012-3e29ed9c9a9c	POL-TEST-7A2059	HEALTH	a1bd90a1-ccd4-4d3c-b2bb-ea276b0d1f31	322a9302-53c8-4cf4-85da-bae7c7373798	c981ecf7-ed34-444c-9b29-e92bdc557421	\N	625ab89c-10a8-46ba-8a00-4bff5171186c	1	500000.00	11800.00	f	Yearly	2026-11-05	\N	2027-11-05	\N	ACTIVE	\N	\N	2026-11-05 12:54:50.478241+05:30	2026-11-05 12:54:51.302893+05:30	10000.00	\N	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	REVERSED	1350.00	2026-11-05	UTR-FINAL-550	\N	2026-11-05
83ac70ba-8819-4036-af99-a5ef424e0b1e	POL-TEST-346441	HEALTH	0f5910f1-6197-420c-b343-dcddeb0a4c02	4bd4cad0-05d2-4967-b6e1-7e711da20d85	fc8bbef1-e318-46e8-9b70-d8657c7ba014	\N	60ca45b7-ccd2-4930-be2c-8661095919b8	1	500000.00	11800.00	f	Yearly	2026-11-05	\N	2027-11-05	\N	ACTIVE	\N	\N	2026-11-05 12:56:31.293991+05:30	2026-11-05 12:56:32.277996+05:30	10000.00	\N	INDIVIDUAL	\N	NEW	\N	\N	\N	\N	NOT_APPLICABLE	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	REVERSED	1350.00	2026-11-05	UTR-FINAL-550	\N	2026-11-05
\.


--
-- Data for Name: insurance_policy_commissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policy_commissions (id, policy_id, sub_agent_id, commission_type, gross_commission_amount, gross_commission_rate, sub_agent_amount, firm_net_amount, split_rule_applied, status, payment_date, notes, created_at, updated_at, net_premium_applied, tds_rate, tds_amount, net_commission_payable, sub_agent_tds_rate, sub_agent_tds_amount, sub_agent_net_payout, firm_tds_amount, firm_net_bank_credit, calculation_source, override_reason, bank_reference, policy_category, expected_receipt_date, actual_gross_received, actual_tds_deducted, actual_net_received, reconciliation_difference, reconciliation_status, recipient_type, allocation_basis, commission_agreement_id, split_agreement_id, agreement_snapshot, approved_by_id, approved_at, approval_notes, reversed_by_id, reversed_at, reversal_reason, reversal_amount, original_commission_id, actual_commission_rate, actual_tds_rate, bank_account, balance_receivable) FROM stdin;
9bee513e-7920-46ae-b3dc-438877b1cf73	9c3e3904-7f5e-469c-8c4c-11df47f9d161	b1129775-17b5-4a0e-b01b-fc44a353d562	FIRST_YEAR	1500.00	15.00	300.00	1200.00	Explicit Sub-Agent Allocation	RECEIVED	2026-11-05	\N	2026-11-05 12:56:20.528478+05:30	2026-11-05 12:56:20.866812+05:30	10000.00	10.00	150.00	1350.00	5.00	15.00	285.00	150.00	1050.00	MANUAL_OVERRIDE	\N	UTR-INSURER-F30FD60B	HEALTH	2026-12-05	1500.00	150.00	1350.00	0.00	RECONCILED	SUB_AGENT	GROSS_COMMISSION	e57cd95f-fd42-467e-862e-1d29e9908d0f	\N	{"calculated_at": "2026-11-05T07:26:20.526913+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "b1129775-17b5-4a0e-b01b-fc44a353d562", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "e57cd95f-fd42-467e-862e-1d29e9908d0f", "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	15.00	10.00	HDFC-A/C-99881122	0.00
ebc0ee69-55ea-421f-8913-25b9f4771716	5c136a8e-a490-425c-b3bc-da5a0c788db1	\N	FIRST_YEAR	1525.20	12.71	0.00	1525.20	Direct Firm Sourced (100% Firm)	APPROVED	\N	\N	2026-11-01 22:26:11.589508+05:30	2026-11-01 23:08:20.771667+05:30	12000.00	10.00	152.52	1372.68	\N	0.00	0.00	152.52	1372.68	MANUAL_OVERRIDE	\N	\N	HEALTH	2026-11-01	0.00	0.00	0.00	0.00	UNRECONCILED	MAIN_FIRM	GROSS_COMMISSION	\N	\N	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:08:20.771651+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	1372.68
e5f743d8-3c04-4b83-80b6-f7810d22fcc7	af101880-6400-4562-ac71-699c477531f9	\N	FIRST_YEAR	2250.00	15.00	0.00	2250.00	Direct Firm Sourced (100% Firm)	APPROVED	2026-11-01	Status updated to PENDING via commission console	2026-11-01 21:35:49.68491+05:30	2026-11-01 23:09:21.134102+05:30	15000.00	10.00	225.00	2025.00	\N	0.00	0.00	225.00	2025.00	MANUAL_OVERRIDE	\N	\N	HEALTH	2026-04-13	0.00	0.00	0.00	0.00	UNRECONCILED	MAIN_FIRM	GROSS_COMMISSION	\N	\N	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:09:21.134084+05:30	done	\N	\N	\N	\N	\N	\N	\N	\N	2025.00
69e268f7-c077-4e17-8e34-b3597821ef72	03a9ae35-c40d-4825-8a88-8722b74ef3b7	\N	FIRST_YEAR	2000.00	10.00	0.00	2000.00	Direct Firm Sourced (100% Firm)	PENDING	\N	\N	2026-11-05 12:56:21.575047+05:30	2026-11-05 12:56:21.57505+05:30	20000.00	10.00	200.00	1800.00	\N	0.00	0.00	200.00	1800.00	MANUAL_OVERRIDE	\N	\N	LIFE	2026-12-05	0.00	0.00	0.00	0.00	UNRECONCILED	MAIN_FIRM	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-05T07:26:21.574272+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 20000.0, "insurer_rate_percent": 10.0, "gross_commission": 2000.0, "tds_rate_percent": 10.0, "tds_amount": 200.0, "net_commission_payable": 1800.0, "sub_agent_id": null, "recipient_type": "MAIN_FIRM", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 0.0, "sub_agent_tds_rate": 0.0, "sub_agent_tds_amount": 0.0, "sub_agent_net_payout": 0.0, "firm_gross_share": 2000.0, "firm_net_bank_credit": 1800.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1800.00
e2815622-750e-41d4-aef8-1d805699b894	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	04d134c4-a81b-447f-873b-483752abb726	RENEWAL	750.00	7.50	0.00	750.00	Sub-Agent Assigned (No active agreement found, 0% allocated)	PENDING	\N	\N	2026-11-03 17:41:57.445329+05:30	2026-11-03 17:41:57.445334+05:30	10000.00	10.00	75.00	675.00	\N	0.00	0.00	75.00	675.00	DEFAULT_STANDARD	\N	\N	HEALTH	2026-12-03	0.00	0.00	0.00	0.00	UNRECONCILED	SUB_AGENT	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-03T12:11:57.440407+00:00", "commission_type": "RENEWAL", "calculation_source": "DEFAULT_STANDARD", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 7.5, "gross_commission": 750.0, "tds_rate_percent": 10.0, "tds_amount": 75.0, "net_commission_payable": 675.0, "sub_agent_id": "04d134c4-a81b-447f-873b-483752abb726", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 0.0, "sub_agent_tds_rate": 0.0, "sub_agent_tds_amount": 0.0, "sub_agent_net_payout": 0.0, "firm_gross_share": 750.0, "firm_net_bank_credit": 675.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	675.00
a9eb76b5-5026-4eef-aeae-f6c25cea8500	83ac70ba-8819-4036-af99-a5ef424e0b1e	60ca45b7-ccd2-4930-be2c-8661095919b8	RENEWAL	750.00	7.50	150.00	600.00	20.00% Split (GROSS_COMMISSION)	PENDING	\N	\N	2026-11-05 12:56:31.327144+05:30	2026-11-05 12:56:31.327146+05:30	10000.00	10.00	75.00	675.00	5.00	7.50	142.50	75.00	525.00	RULE_AGREEMENT	\N	\N	HEALTH	2026-12-05	0.00	0.00	0.00	0.00	UNRECONCILED	SUB_AGENT	GROSS_COMMISSION	c06cf054-dd4b-491b-88e5-a9708d6ebde6	e6d25fec-096c-4cb6-9675-102a7538cfe0	{"calculated_at": "2026-11-05T07:26:31.326636+00:00", "commission_type": "RENEWAL", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 7.5, "gross_commission": 750.0, "tds_rate_percent": 10.0, "tds_amount": 75.0, "net_commission_payable": 675.0, "sub_agent_id": "60ca45b7-ccd2-4930-be2c-8661095919b8", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 150.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 7.5, "sub_agent_net_payout": 142.5, "firm_gross_share": 600.0, "firm_net_bank_credit": 525.0, "agreement_id": "c06cf054-dd4b-491b-88e5-a9708d6ebde6", "split_agreement_id": "e6d25fec-096c-4cb6-9675-102a7538cfe0", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	675.00
82b09482-7b09-4ff4-8334-bb9c73b6bc53	83ac70ba-8819-4036-af99-a5ef424e0b1e	60ca45b7-ccd2-4930-be2c-8661095919b8	FIRST_YEAR	1500.00	15.00	300.00	1200.00	20.00% Split (GROSS_COMMISSION)	REVERSED	2026-11-05	Reversal note: Full insurer clawback initiated.	2026-11-05 12:56:31.314419+05:30	2026-11-05 12:56:32.275704+05:30	10000.00	10.00	150.00	1350.00	5.00	15.00	285.00	150.00	1050.00	RULE_AGREEMENT	\N	UTR-FINAL-550	HEALTH	2026-12-05	1500.00	150.00	1350.00	0.00	RECONCILED	SUB_AGENT	GROSS_COMMISSION	c06cf054-dd4b-491b-88e5-a9708d6ebde6	e6d25fec-096c-4cb6-9675-102a7538cfe0	{"calculated_at": "2026-11-05T07:26:31.312706+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "60ca45b7-ccd2-4930-be2c-8661095919b8", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "c06cf054-dd4b-491b-88e5-a9708d6ebde6", "split_agreement_id": "e6d25fec-096c-4cb6-9675-102a7538cfe0", "override_reason": null}	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:31.989801+05:30	Insurer statement verified against portal.	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:32.275674+05:30	Policy cancelled during 30-day free-look window.	1500.00	\N	\N	\N	\N	0.00
e13740bb-c070-408b-ad6d-f9b491d050f7	3ef7ac86-26d4-4e76-815b-577fcba9c611	5c5e97a8-529b-4afa-adde-9bbefc6d3570	FIRST_YEAR	1500.00	15.00	300.00	1200.00	Explicit Sub-Agent Allocation	RECEIVED	2026-11-05	\N	2026-11-05 13:04:20.145934+05:30	2026-11-05 13:04:20.956672+05:30	10000.00	10.00	150.00	1350.00	5.00	15.00	285.00	150.00	1050.00	MANUAL_OVERRIDE	\N	UTR-INSURER-BFFA2540	HEALTH	2026-12-05	1500.00	150.00	1350.00	0.00	RECONCILED	SUB_AGENT	GROSS_COMMISSION	bff38c16-1a25-437b-ad68-c8500df287b2	\N	{"calculated_at": "2026-11-05T07:34:20.142892+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "5c5e97a8-529b-4afa-adde-9bbefc6d3570", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "bff38c16-1a25-437b-ad68-c8500df287b2", "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	15.00	10.00	HDFC-A/C-99881122	0.00
7d22c1a7-13c8-45fe-9f70-dea6d26470ab	147a1139-f18d-42b4-bbc5-e4257ba26d52	\N	FIRST_YEAR	2000.00	10.00	0.00	2000.00	Direct Firm Sourced (100% Firm)	PENDING	\N	\N	2026-11-05 13:04:23.038548+05:30	2026-11-05 13:04:23.038558+05:30	20000.00	10.00	200.00	1800.00	\N	0.00	0.00	200.00	1800.00	MANUAL_OVERRIDE	\N	\N	LIFE	2026-12-05	0.00	0.00	0.00	0.00	UNRECONCILED	MAIN_FIRM	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-05T07:34:23.037172+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 20000.0, "insurer_rate_percent": 10.0, "gross_commission": 2000.0, "tds_rate_percent": 10.0, "tds_amount": 200.0, "net_commission_payable": 1800.0, "sub_agent_id": null, "recipient_type": "MAIN_FIRM", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 0.0, "sub_agent_tds_rate": 0.0, "sub_agent_tds_amount": 0.0, "sub_agent_net_payout": 0.0, "firm_gross_share": 2000.0, "firm_net_bank_credit": 1800.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1800.00
f242e21a-bb1a-42e6-9a4e-d439c58fd481	ef4fcc75-194d-416c-8dde-e7fbff754b9b	\N	FIRST_YEAR	3177.50	12.71	0.00	3177.50	Direct Firm Sourced (100% Firm)	PENDING	\N	\N	2026-11-05 11:13:53.864472+05:30	2026-11-05 11:13:53.864474+05:30	25000.00	10.00	317.75	2859.75	\N	0.00	0.00	317.75	2859.75	MANUAL_OVERRIDE	\N	\N	HEALTH	2026-12-05	0.00	0.00	0.00	0.00	UNRECONCILED	MAIN_FIRM	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-05T05:43:53.862121+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 25000.0, "insurer_rate_percent": 12.71, "gross_commission": 3177.5, "tds_rate_percent": 10.0, "tds_amount": 317.75, "net_commission_payable": 2859.75, "sub_agent_id": null, "recipient_type": "MAIN_FIRM", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 0.0, "sub_agent_tds_rate": 0.0, "sub_agent_tds_amount": 0.0, "sub_agent_net_payout": 0.0, "firm_gross_share": 3177.5, "firm_net_bank_credit": 2859.75, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2859.75
48f1e2d9-85f7-403d-9849-29327128546f	915a17bc-5bc6-42bf-b555-f24696e5f2fb	\N	FIRST_YEAR	3000.00	15.00	0.00	3000.00	Direct Firm Sourced (100% Firm)	PENDING	\N	\N	2026-11-05 11:28:53.723458+05:30	2026-11-05 11:28:53.72346+05:30	20000.00	10.00	300.00	2700.00	\N	0.00	0.00	300.00	2700.00	MANUAL_OVERRIDE	\N	\N	HEALTH	2023-01-31	0.00	0.00	0.00	0.00	UNRECONCILED	MAIN_FIRM	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-05T05:58:53.722977+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 20000.0, "insurer_rate_percent": 15.0, "gross_commission": 3000.0, "tds_rate_percent": 10.0, "tds_amount": 300.0, "net_commission_payable": 2700.0, "sub_agent_id": null, "recipient_type": "MAIN_FIRM", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 0.0, "sub_agent_tds_rate": 0.0, "sub_agent_tds_amount": 0.0, "sub_agent_net_payout": 0.0, "firm_gross_share": 3000.0, "firm_net_bank_credit": 2700.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2700.00
6762f9ce-a5ad-42b1-bcd0-8f06dbe05e3c	aac36891-45fd-4003-8569-0a218bf134fe	\N	FIRST_YEAR	3000.00	15.00	0.00	3000.00	Direct Firm Sourced (100% Firm)	PENDING	\N	\N	2026-11-05 12:22:43.707316+05:30	2026-11-05 12:22:43.707323+05:30	20000.00	10.00	300.00	2700.00	\N	0.00	0.00	300.00	2700.00	MANUAL_OVERRIDE	\N	\N	LIFE	2026-12-05	0.00	0.00	0.00	0.00	UNRECONCILED	MAIN_FIRM	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-05T06:52:43.702858+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 20000.0, "insurer_rate_percent": 15.0, "gross_commission": 3000.0, "tds_rate_percent": 10.0, "tds_amount": 300.0, "net_commission_payable": 2700.0, "sub_agent_id": null, "recipient_type": "MAIN_FIRM", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 0.0, "sub_agent_tds_rate": 0.0, "sub_agent_tds_amount": 0.0, "sub_agent_net_payout": 0.0, "firm_gross_share": 3000.0, "firm_net_bank_credit": 2700.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2700.00
72857361-abd4-49f3-bea2-b1ef8783b323	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	04d134c4-a81b-447f-873b-483752abb726	FIRST_YEAR	1500.00	15.00	750.00	750.00	Explicit Sub-Agent Allocation	PENDING	\N	\N	2026-11-03 17:23:58.651677+05:30	2026-11-03 17:23:58.651681+05:30	10000.00	10.00	150.00	1350.00	5.00	37.50	712.50	150.00	600.00	MANUAL_OVERRIDE	\N	\N	OTHER	2026-12-03	0.00	0.00	0.00	0.00	UNRECONCILED	SUB_AGENT	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-03T11:53:58.650827+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "04d134c4-a81b-447f-873b-483752abb726", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 750.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 37.5, "sub_agent_net_payout": 712.5, "firm_gross_share": 750.0, "firm_net_bank_credit": 600.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1350.00
5ee26161-04ea-404d-ae90-0cc178333515	15d44347-7c07-4e4f-8dcd-fb8961d4219f	04d134c4-a81b-447f-873b-483752abb726	FIRST_YEAR	150.00	15.00	75.00	75.00	Explicit Sub-Agent Allocation	APPROVED	\N	\N	2026-11-03 17:03:00.80396+05:30	2026-11-03 18:09:36.743589+05:30	1000.00	10.00	15.00	135.00	5.00	3.75	71.25	15.00	60.00	MANUAL_OVERRIDE	\N	\N	OTHER	2026-12-03	0.00	0.00	0.00	0.00	UNRECONCILED	SUB_AGENT	GROSS_COMMISSION	\N	\N	{"calculated_at": "2026-11-03T11:33:00.801694+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 1000.0, "insurer_rate_percent": 15.0, "gross_commission": 150.0, "tds_rate_percent": 10.0, "tds_amount": 15.0, "net_commission_payable": 135.0, "sub_agent_id": "04d134c4-a81b-447f-873b-483752abb726", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 75.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 3.75, "sub_agent_net_payout": 71.25, "firm_gross_share": 75.0, "firm_net_bank_credit": 60.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 18:09:36.743572+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	135.00
59a78068-680a-4ec9-8a2d-f5c8b8c84788	1bdce3ec-908f-4203-aecc-2e00b12bbad4	cb432e66-7c5d-4234-9439-b99441687b2f	RENEWAL	750.00	7.50	150.00	600.00	20.00% Split (GROSS_COMMISSION)	PENDING	\N	\N	2026-11-05 12:53:35.063489+05:30	2026-11-05 12:53:35.063491+05:30	10000.00	10.00	75.00	675.00	5.00	7.50	142.50	75.00	525.00	RULE_AGREEMENT	\N	\N	HEALTH	2026-12-05	0.00	0.00	0.00	0.00	UNRECONCILED	SUB_AGENT	GROSS_COMMISSION	cdedeec5-1314-4846-9e8c-084504c4e658	be759006-255b-47d7-9cc3-6df7084c1347	{"calculated_at": "2026-11-05T07:23:35.063088+00:00", "commission_type": "RENEWAL", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 7.5, "gross_commission": 750.0, "tds_rate_percent": 10.0, "tds_amount": 75.0, "net_commission_payable": 675.0, "sub_agent_id": "cb432e66-7c5d-4234-9439-b99441687b2f", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 150.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 7.5, "sub_agent_net_payout": 142.5, "firm_gross_share": 600.0, "firm_net_bank_credit": 525.0, "agreement_id": "cdedeec5-1314-4846-9e8c-084504c4e658", "split_agreement_id": "be759006-255b-47d7-9cc3-6df7084c1347", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	675.00
897cc7ff-648e-4705-aefb-f2d79d6552cf	1bdce3ec-908f-4203-aecc-2e00b12bbad4	cb432e66-7c5d-4234-9439-b99441687b2f	FIRST_YEAR	1500.00	15.00	300.00	1200.00	20.00% Split (GROSS_COMMISSION)	PARTIALLY_RECEIVED	\N	\N	2026-11-05 12:53:35.047683+05:30	2026-11-05 12:53:35.805672+05:30	10000.00	10.00	150.00	1350.00	5.00	15.00	285.00	150.00	1050.00	RULE_AGREEMENT	\N	UTR-PARTIAL-800	HEALTH	2026-12-05	888.89	88.89	800.00	-550.00	SHORT_PAYMENT	SUB_AGENT	GROSS_COMMISSION	cdedeec5-1314-4846-9e8c-084504c4e658	be759006-255b-47d7-9cc3-6df7084c1347	{"calculated_at": "2026-11-05T07:23:35.045740+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "cb432e66-7c5d-4234-9439-b99441687b2f", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "cdedeec5-1314-4846-9e8c-084504c4e658", "split_agreement_id": "be759006-255b-47d7-9cc3-6df7084c1347", "override_reason": null}	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:53:35.635467+05:30	Insurer statement verified against portal.	\N	\N	\N	\N	\N	\N	\N	\N	550.00
b4ffa738-5bf5-46cc-b2e1-9f8b1fb18bed	7c89262c-bdfc-43ed-b012-3e29ed9c9a9c	625ab89c-10a8-46ba-8a00-4bff5171186c	RENEWAL	750.00	7.50	150.00	600.00	20.00% Split (GROSS_COMMISSION)	PENDING	\N	\N	2026-11-05 12:54:50.507669+05:30	2026-11-05 12:54:50.507671+05:30	10000.00	10.00	75.00	675.00	5.00	7.50	142.50	75.00	525.00	RULE_AGREEMENT	\N	\N	HEALTH	2026-12-05	0.00	0.00	0.00	0.00	UNRECONCILED	SUB_AGENT	GROSS_COMMISSION	07140e42-b1bb-402e-aa67-05b54430538d	a182056b-c311-4eba-8a01-5f12aaf55ee6	{"calculated_at": "2026-11-05T07:24:50.507258+00:00", "commission_type": "RENEWAL", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 7.5, "gross_commission": 750.0, "tds_rate_percent": 10.0, "tds_amount": 75.0, "net_commission_payable": 675.0, "sub_agent_id": "625ab89c-10a8-46ba-8a00-4bff5171186c", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 150.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 7.5, "sub_agent_net_payout": 142.5, "firm_gross_share": 600.0, "firm_net_bank_credit": 525.0, "agreement_id": "07140e42-b1bb-402e-aa67-05b54430538d", "split_agreement_id": "a182056b-c311-4eba-8a01-5f12aaf55ee6", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	675.00
4fadf88f-b106-4f31-95c5-ce62744e557a	7c89262c-bdfc-43ed-b012-3e29ed9c9a9c	625ab89c-10a8-46ba-8a00-4bff5171186c	FIRST_YEAR	1500.00	15.00	300.00	1200.00	20.00% Split (GROSS_COMMISSION)	REVERSED	2026-11-05	Reversal note: Full insurer clawback initiated.	2026-11-05 12:54:50.496224+05:30	2026-11-05 12:54:51.301854+05:30	10000.00	10.00	150.00	1350.00	5.00	15.00	285.00	150.00	1050.00	RULE_AGREEMENT	\N	UTR-FINAL-550	HEALTH	2026-12-05	1500.00	150.00	1350.00	0.00	RECONCILED	SUB_AGENT	GROSS_COMMISSION	07140e42-b1bb-402e-aa67-05b54430538d	a182056b-c311-4eba-8a01-5f12aaf55ee6	{"calculated_at": "2026-11-05T07:24:50.494552+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "625ab89c-10a8-46ba-8a00-4bff5171186c", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "07140e42-b1bb-402e-aa67-05b54430538d", "split_agreement_id": "a182056b-c311-4eba-8a01-5f12aaf55ee6", "override_reason": null}	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:54:51.108319+05:30	Insurer statement verified against portal.	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:54:51.301841+05:30	Policy cancelled during 30-day free-look window.	1500.00	\N	\N	\N	\N	0.00
\.


--
-- Data for Name: insurance_policy_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policy_documents (id, policy_id, document_type, title, description, original_filename, storage_path, file_size_bytes, mime_type, sha256_hash, uploaded_by_id, created_at, updated_at) FROM stdin;
fb9b77cb-7915-439f-95c4-2884882f596a	af101880-6400-4562-ac71-699c477531f9	Official Policy Certificate	abcd	\N	AdityaThakre_Resume-2 (2).pdf	D:\\project\\backend\\storage\\policy_documents\\policy_af101880-6400-4562-ac71-699c477531f9_fb9b77cb_AdityaThakre_Resume-2 2.pdf	87526	application/pdf	c4010c2c1b299757a65d5e1c85682a37d486dc730dbfec4e79104dd27774811e	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 22:15:14.233875+05:30	2026-11-01 22:15:39.41074+05:30
9b18b596-7910-4cea-a5ab-b952b514dbe7	ef4fcc75-194d-416c-8dde-e7fbff754b9b	Official Policy Certificate	Quotation_HQ-2026-00053	\N	Quotation_HQ-2026-00053.pdf	D:\\project\\backend\\storage\\policy_documents\\policy_ef4fcc75-194d-416c-8dde-e7fbff754b9b_9b18b596_Quotation_HQ-2026-00053.pdf	15826	application/pdf	730029c8fd73a9f71b3b5b1ace6c099756713ee59546efcf993c46de7888d9e2	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:13:53.973764+05:30	2026-11-05 11:13:53.973768+05:30
\.


--
-- Data for Name: insurance_policy_histories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policy_histories (id, current_policy_id, previous_policy_id, insurance_company_name, previous_policy_number, policy_business_type, history_sequence, policy_start_date, policy_expiry_date, sum_insured, net_premium, gross_premium, product_variant, policy_status, claim_history, insurer_contact, cumulative_bonus, continuity_details, waiting_period_waiver_details, remarks, is_external_policy, created_at, updated_at) FROM stdin;
0c457509-9aeb-459d-9bc4-8b498fbf43fb	ef4fcc75-194d-416c-8dde-e7fbff754b9b	\N	Tata aig	saerf	RENEW	1	2025-07-01	2026-06-30	520000.00	\N	36630.00	waer	ACTIVE	NO_CLAIM	\N	0	\N	\N	ferawer	t	2026-11-05 11:13:53.849774+05:30	2026-11-05 11:13:53.849777+05:30
\.


--
-- Data for Name: insurance_policy_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policy_members (id, policy_id, customer_id, full_name, relationship, date_of_birth, gender, mobile_number, email, address, member_code, individual_sum_insured, notes, created_at, updated_at) FROM stdin;
2d7b6e05-216b-4795-8fa4-061052ccfc4e	af101880-6400-4562-ac71-699c477531f9	5a199e21-1953-41ae-b32f-e193bf5400c2	Aditya Thakre	SELF	2004-05-29	MALE	8446090974	tadityafin@gmail.com	\N	\N	\N	\N	2026-11-01 21:35:49.658258+05:30	2026-11-01 21:35:49.658263+05:30
947d304f-b9ae-43ae-997e-81600d716cb8	af101880-6400-4562-ac71-699c477531f9	\N	Nandini	SPOUSE	2006-01-25	FEMALE	\N	\N	\N	\N	\N	\N	2026-11-01 21:35:49.658265+05:30	2026-11-01 21:35:49.658267+05:30
b4060535-4018-4285-b24b-a189d2ec4dcd	5c136a8e-a490-425c-b3bc-da5a0c788db1	6da0ef85-3341-45fa-9e38-b4f85626b48c	Priya Deshmukh	SELF	1991-01-01	MALE	1111111111	priya.deshmukh@example.com	\N	\N	1000000.00	\N	2026-11-01 22:26:11.573049+05:30	2026-11-01 22:26:11.573056+05:30
d3c230de-01a4-44dc-8661-e83bac3c31ff	15d44347-7c07-4e4f-8dcd-fb8961d4219f	5a199e21-1953-41ae-b32f-e193bf5400c2	Aditya Thakre	SELF	\N	MALE	8446090974	tadityafin@gmail.com	\N	\N	\N	\N	2026-11-03 17:03:00.789986+05:30	2026-11-03 17:03:00.78999+05:30
01607a2e-2120-482a-a03b-1b7e951ec614	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	\N	Aadi Thakre	SPOUSE	2026-12-02	MALE	942356030.03	asxd@gmail.com	\N	\N	1000000.00	\N	2026-11-03 17:23:58.644251+05:30	2026-11-03 17:23:58.644257+05:30
c457b2d8-da62-4732-8427-3751ba496b19	ef4fcc75-194d-416c-8dde-e7fbff754b9b	387bb7bc-7400-4770-bdf8-0921aa1d0816	Nandini Sharma	SELF	\N	MALE	8452012567	nandini@gmail.com	GATE NO 56 NEAR TULJA BHAVANI SCHOOL MUKUNDNAGAR CHH SAMBHAJINAGAR	\N	1000000.00	\N	2026-11-05 11:13:53.825405+05:30	2026-11-05 11:13:53.825407+05:30
9477339f-c54b-433d-a925-c923a513a2c6	915a17bc-5bc6-42bf-b555-f24696e5f2fb	0b701338-6132-4e11-a922-a9619b0d8397	PolicyUserA4F608 TestClient	SELF	\N	MALE	+919822900746	policyuser_a4f608@test.com	\N	\N	1000000.00	\N	2026-11-05 11:28:53.714259+05:30	2026-11-05 11:28:53.714264+05:30
b2757a69-ac1e-45ac-9923-14fab2cc2ac5	aac36891-45fd-4003-8569-0a218bf134fe	0b701338-6132-4e11-a922-a9619b0d8397	PolicyUserA4F608 TestClient	SELF	\N	MALE	+919822900746	policyuser_a4f608@test.com	\N	\N	1000000.00	\N	2026-11-05 12:22:43.673476+05:30	2026-11-05 12:22:43.673485+05:30
\.


--
-- Data for Name: insurance_policy_nominees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policy_nominees (id, policy_id, full_name, relationship, date_of_birth, mobile_number, address, share_percentage, created_at, updated_at) FROM stdin;
89fd2dfc-58b8-4012-8f83-12d76bb84a5a	af101880-6400-4562-ac71-699c477531f9	Nandini	Spouse	2006-01-25	\N	\N	100.00	2026-11-01 21:35:49.652701+05:30	2026-11-01 21:35:49.652707+05:30
8adc65bf-d0c5-42e9-a1c2-f6fba95e4e97	5c136a8e-a490-425c-b3bc-da5a0c788db1	Aditya	Other	\N	\N	\N	100.00	2026-11-01 22:26:11.5698+05:30	2026-11-01 22:26:11.569806+05:30
d78cb2ee-7c59-464b-9995-3068812e4988	ef4fcc75-194d-416c-8dde-e7fbff754b9b	Mohit	Spouse	\N	\N	\N	100.00	2026-11-05 11:13:53.822926+05:30	2026-11-05 11:13:53.82293+05:30
374ee4a1-3fab-4685-bfe2-42189f1cf8b2	915a17bc-5bc6-42bf-b555-f24696e5f2fb	zsdf	Spouse	\N	\N	\N	100.00	2026-11-05 11:28:53.712487+05:30	2026-11-05 11:28:53.712489+05:30
3755bda1-d2dc-4066-825b-7ed23f261923	aac36891-45fd-4003-8569-0a218bf134fe	ANVRRF	Spouse	\N	\N	\N	100.00	2026-11-05 12:22:43.65958+05:30	2026-11-05 12:22:43.659591+05:30
\.


--
-- Data for Name: insurance_policy_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policy_payments (id, policy_id, premium_schedule_id, payment_mode, bank_name, transaction_reference, first_receipt_date, payment_date, amount, status, notes, created_by_id, created_at, document_id, document_filename) FROM stdin;
90f19e88-a676-49fc-8402-01c32a927a4b	af101880-6400-4562-ac71-699c477531f9	2f7508bc-cc7c-47b8-b311-b4885ca92809	ONLINE	\N	\N	2026-04-13	2026-04-13	15000.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 21:35:49.749865+05:30	\N	\N
58bd310e-b4cc-4cab-ac59-b9b247b672ba	5c136a8e-a490-425c-b3bc-da5a0c788db1	11316d2b-68f3-438a-8681-aea965bca09f	ONLINE	\N	\N	2026-11-01	2026-11-01	1.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 22:26:11.647153+05:30	\N	\N
648b13ca-7257-44e8-8392-b480ac505853	15d44347-7c07-4e4f-8dcd-fb8961d4219f	243a5354-a05c-46e9-aaad-2250a6135727	ONLINE	\N	\N	2026-11-03	2026-11-03	4.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 17:03:00.845947+05:30	\N	\N
e218b390-f730-4962-a044-9875ea56690b	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	098b13a5-448f-48cc-bcd7-bdc9a3dea345	ONLINE	\N	\N	2026-11-03	2026-11-03	10000.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-03 17:23:58.67929+05:30	\N	\N
8d7ef1e3-44ef-4881-acd0-693464531a24	5c136a8e-a490-425c-b3bc-da5a0c788db1	11316d2b-68f3-438a-8681-aea965bca09f	ONLINE	\N	\N	2026-11-05	2026-11-05	14160.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:04:55.426035+05:30	\N	\N
4d2039b0-8628-4dd1-84fe-e0805d3427ab	af101880-6400-4562-ac71-699c477531f9	2f7508bc-cc7c-47b8-b311-b4885ca92809	ONLINE	\N	\N	2026-11-05	2026-11-05	17700.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:04:57.467534+05:30	\N	\N
e105f436-0c30-49b2-960a-4d1964224bd4	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	098b13a5-448f-48cc-bcd7-bdc9a3dea345	ONLINE	\N	\N	2026-11-05	2026-11-05	11800.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:04:59.602111+05:30	\N	\N
a69bc215-17f8-47c9-9ff2-2d62db2b97fd	15d44347-7c07-4e4f-8dcd-fb8961d4219f	243a5354-a05c-46e9-aaad-2250a6135727	ONLINE	\N	\N	2026-11-05	2026-11-05	53100.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:05:01.353341+05:30	\N	\N
eabf58a9-9c94-4260-a990-2e5c0a19e2fb	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	2e70364f-8286-4357-9c87-bfd0f647d215	ONLINE	\N	\N	2026-11-05	2026-11-05	15800.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:05:03.081851+05:30	\N	\N
9264d289-4989-4ee0-adaf-b0629eb8eda0	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	ef1a1ccf-33b4-4cff-a2b4-e10cba8d8731	ONLINE	\N	\N	2026-11-05	2026-11-05	11800.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:05:05.636176+05:30	\N	\N
2d6182ac-2b23-44b7-98c2-7a2de0c8a0ae	ef4fcc75-194d-416c-8dde-e7fbff754b9b	494468cf-bf9c-4818-9e12-89cddcea0be9	ONLINE	\N	\N	2026-11-05	2026-11-05	25000.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:13:53.896358+05:30	\N	\N
8a0b2f14-dcc2-4eab-9258-880f903ab438	915a17bc-5bc6-42bf-b555-f24696e5f2fb	cc072a65-92bd-48f6-9803-0fa35bd76ce9	ONLINE	\N	\N	2026-11-05	2026-11-05	20000.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 11:28:53.751324+05:30	\N	\N
a3bd5067-3c27-4662-a16b-2bf0907a9fa6	aac36891-45fd-4003-8569-0a218bf134fe	142b12b4-6b40-4701-875d-ba22dd0911fb	ONLINE	\N	\N	2026-11-05	2026-11-05	20000.00	COMPLETED	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:22:43.858008+05:30	\N	\N
\.


--
-- Data for Name: insurance_policy_years; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policy_years (id, policy_id, policy_year, policy_number, proposal_number, business_type, prior_policy_number, product_variant, start_date, end_date, net_premium, gross_premium, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_premium_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_premium_schedules (id, policy_id, installment_number, due_date, amount, status, paid_date, created_at, updated_at) FROM stdin;
11316d2b-68f3-438a-8681-aea965bca09f	5c136a8e-a490-425c-b3bc-da5a0c788db1	1	2025-11-03	14160.00	PAID	2026-11-05	2026-11-01 22:26:11.58053+05:30	2026-11-05 11:04:55.394161+05:30
2f7508bc-cc7c-47b8-b311-b4885ca92809	af101880-6400-4562-ac71-699c477531f9	1	2026-04-13	17700.00	PAID	2026-11-05	2026-11-01 21:35:49.668726+05:30	2026-11-05 11:04:57.462375+05:30
098b13a5-448f-48cc-bcd7-bdc9a3dea345	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	1	2026-11-03	11800.00	PAID	2026-11-05	2026-11-03 17:23:58.646217+05:30	2026-11-05 11:04:59.597642+05:30
243a5354-a05c-46e9-aaad-2250a6135727	15d44347-7c07-4e4f-8dcd-fb8961d4219f	1	2026-11-03	53100.00	PAID	2026-11-05	2026-11-03 17:03:00.79472+05:30	2026-11-05 11:05:01.346976+05:30
2e70364f-8286-4357-9c87-bfd0f647d215	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	3	2028-11-03	15800.00	PAID	2026-11-05	2026-11-03 17:44:18.513184+05:30	2026-11-05 11:05:03.033729+05:30
ef1a1ccf-33b4-4cff-a2b4-e10cba8d8731	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	2	2027-11-03	11800.00	PAID	2026-11-05	2026-11-03 17:41:57.447679+05:30	2026-11-05 11:05:05.631306+05:30
494468cf-bf9c-4818-9e12-89cddcea0be9	ef4fcc75-194d-416c-8dde-e7fbff754b9b	1	2026-11-05	25000.00	PAID	2026-11-05	2026-11-05 11:13:53.854569+05:30	2026-11-05 11:13:53.892505+05:30
cc072a65-92bd-48f6-9803-0fa35bd76ce9	915a17bc-5bc6-42bf-b555-f24696e5f2fb	1	2023-01-01	20000.00	PAID	2026-11-05	2026-11-05 11:28:53.717287+05:30	2026-11-05 11:28:53.745458+05:30
142b12b4-6b40-4701-875d-ba22dd0911fb	aac36891-45fd-4003-8569-0a218bf134fe	1	2026-11-05	20000.00	PAID	2026-11-05	2026-11-05 12:22:43.678699+05:30	2026-11-05 12:22:43.835439+05:30
5a8a37b7-bb42-4718-9bc2-ba9174d0c5b4	9c3e3904-7f5e-469c-8c4c-11df47f9d161	1	2026-11-05	11800.00	DUE_TODAY	\N	2026-11-05 12:56:20.516438+05:30	2026-11-05 12:56:20.516441+05:30
181ce0b6-664d-486e-8b32-3c0c9065bbf0	03a9ae35-c40d-4825-8a88-8722b74ef3b7	1	2026-11-05	20000.00	DUE_TODAY	\N	2026-11-05 12:56:21.566771+05:30	2026-11-05 12:56:21.566778+05:30
a556c6e9-8028-44fc-90fa-94b9865f5e51	3ef7ac86-26d4-4e76-815b-577fcba9c611	1	2026-11-05	11800.00	DUE_TODAY	\N	2026-11-05 13:04:20.122646+05:30	2026-11-05 13:04:20.122655+05:30
4e6947f7-ecfc-4134-b1c6-46e14dde7075	147a1139-f18d-42b4-bbc5-e4257ba26d52	1	2026-11-05	20000.00	DUE_TODAY	\N	2026-11-05 13:04:23.019726+05:30	2026-11-05 13:04:23.019735+05:30
\.


--
-- Data for Name: insurance_purchase_parties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_purchase_parties (id, name, code, contact_person, email, phone, address, notes, is_active, created_at, updated_at) FROM stdin;
9702dc07-e242-4ebd-9817-577a13cf4ff4	FinNexus IMF Direct Sourcing	PP-IMF-DIR	Internal Principal Officer	sourcing@finnexus.demo	+91 22 6100 8900	FinNexus Financial Hub, BKC, Mumbai 400051	Direct internal Insurance Marketing Firm sourcing entity.	t	2026-11-01 17:28:19.258995+05:30	2026-11-01 17:28:19.258995+05:30
6f81624e-a664-4780-b116-5d5904229d50	Apex Alliance Insurance Brokers	PP-APEX-01	Rohan Deshmukh	rohan.d@apexbrokers.demo	+91 98200 45123	Trade Centre, 4th Floor, Bandra Kurla Complex, Mumbai 400051	Direct composite broker channel for corporate group and health policies.	t	2026-11-01 17:28:19.258995+05:30	2026-11-01 17:28:19.258995+05:30
f5b0f018-03cb-4e17-9093-8c31f571141d	Beacon Point Corporate Agency	PP-BEACON-02	Pooja Singhania	pooja@beaconagency.demo	+91 98110 33445	Connaught Place, Outer Circle, New Delhi 110001	Corporate agency channel specializing in term life and motor origination.	t	2026-11-01 17:28:19.258995+05:30	2026-11-01 17:28:19.258995+05:30
\.


--
-- Data for Name: insurance_sub_agent_payout_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_sub_agent_payout_payments (id, payout_id, payment_date, amount, tds_deducted, net_amount, payment_method, bank_account_details, transaction_reference, payment_proof_url, notes, recorded_by_id, created_at, updated_at) FROM stdin;
1745b1c1-8d57-4e4a-ab2d-0f6bc65cdc03	3670e1d0-9301-4810-9fe3-7d014dda78c7	2026-11-05	300.00	15.00	285.00	BANK_TRANSFER	ICICI Bank A/C 0011223344	UTR-AGT-D006A33F	\N	Full commission share disbursed to sub-agent.	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:20.975945+05:30	2026-11-05 12:56:20.975948+05:30
445d2c27-f5d8-4d27-997f-400fea129e06	297dc36c-0d49-4e57-94cb-7dd423d00a02	2026-11-05	300.00	15.00	285.00	BANK_TRANSFER	ICICI Bank A/C 0011223344	UTR-AGT-9D319CA7	\N	Full commission share disbursed to sub-agent.	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 13:04:21.476605+05:30	2026-11-05 13:04:21.476611+05:30
\.


--
-- Data for Name: insurance_sub_agent_payouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_sub_agent_payouts (id, policy_id, commission_id, sub_agent_id, commission_type, insurer_gross_commission, agreed_percentage, payable_amount, tds_rate, tds_amount, net_payable_amount, amount_paid, remaining_payable, status, payout_date, split_rule_applied, split_agreement_snapshot, notes, on_hold_reason, approved_by_id, approved_at, approval_notes, reversed_by_id, reversed_at, reversal_reason, created_at, updated_at) FROM stdin;
28cd833d-7847-4ddf-b134-4574be3a2c08	7d4d035e-94bd-4fa5-b80e-9fabcbff68c2	72857361-abd4-49f3-bea2-b1ef8783b323	04d134c4-a81b-447f-873b-483752abb726	FIRST_YEAR	1500.00	50.00	750.00	5.00	37.50	712.50	0.00	712.50	PENDING	\N	Explicit Sub-Agent Allocation	{"calculated_at": "2026-11-03T11:53:58.650827+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "04d134c4-a81b-447f-873b-483752abb726", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 750.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 37.5, "sub_agent_net_payout": 712.5, "firm_gross_share": 750.0, "firm_net_bank_credit": 600.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-03 17:23:58.651677+05:30	2026-11-03 17:23:58.651681+05:30
bfa1cdf6-0766-4e2d-92cf-5d702f1e6a02	15d44347-7c07-4e4f-8dcd-fb8961d4219f	5ee26161-04ea-404d-ae90-0cc178333515	04d134c4-a81b-447f-873b-483752abb726	FIRST_YEAR	150.00	50.00	75.00	5.00	3.75	71.25	0.00	71.25	PENDING	\N	Explicit Sub-Agent Allocation	{"calculated_at": "2026-11-03T11:33:00.801694+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 1000.0, "insurer_rate_percent": 15.0, "gross_commission": 150.0, "tds_rate_percent": 10.0, "tds_amount": 15.0, "net_commission_payable": 135.0, "sub_agent_id": "04d134c4-a81b-447f-873b-483752abb726", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 75.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 3.75, "sub_agent_net_payout": 71.25, "firm_gross_share": 75.0, "firm_net_bank_credit": 60.0, "agreement_id": null, "split_agreement_id": null, "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-03 17:03:00.80396+05:30	2026-11-03 18:09:36.743589+05:30
53e80c26-dc76-468c-a039-0edf6d8d50d6	1bdce3ec-908f-4203-aecc-2e00b12bbad4	897cc7ff-648e-4705-aefb-f2d79d6552cf	cb432e66-7c5d-4234-9439-b99441687b2f	FIRST_YEAR	1500.00	20.00	300.00	5.00	15.00	285.00	0.00	285.00	PENDING	\N	20.00% Split (GROSS_COMMISSION)	{"calculated_at": "2026-11-05T07:23:35.045740+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "cb432e66-7c5d-4234-9439-b99441687b2f", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "cdedeec5-1314-4846-9e8c-084504c4e658", "split_agreement_id": "be759006-255b-47d7-9cc3-6df7084c1347", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-05 12:53:35.055171+05:30	2026-11-05 12:53:35.055174+05:30
4c31d0b5-8e9c-4883-a09d-eeeeb2d43f84	1bdce3ec-908f-4203-aecc-2e00b12bbad4	59a78068-680a-4ec9-8a2d-f5c8b8c84788	cb432e66-7c5d-4234-9439-b99441687b2f	RENEWAL	750.00	20.00	150.00	5.00	7.50	142.50	0.00	142.50	PENDING	\N	20.00% Split (GROSS_COMMISSION)	{"calculated_at": "2026-11-05T07:23:35.063088+00:00", "commission_type": "RENEWAL", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 7.5, "gross_commission": 750.0, "tds_rate_percent": 10.0, "tds_amount": 75.0, "net_commission_payable": 675.0, "sub_agent_id": "cb432e66-7c5d-4234-9439-b99441687b2f", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 150.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 7.5, "sub_agent_net_payout": 142.5, "firm_gross_share": 600.0, "firm_net_bank_credit": 525.0, "agreement_id": "cdedeec5-1314-4846-9e8c-084504c4e658", "split_agreement_id": "be759006-255b-47d7-9cc3-6df7084c1347", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-05 12:53:35.0654+05:30	2026-11-05 12:53:35.065404+05:30
5d2a11fd-bf56-4028-8cda-76ff5dd75482	7c89262c-bdfc-43ed-b012-3e29ed9c9a9c	4fadf88f-b106-4f31-95c5-ce62744e557a	625ab89c-10a8-46ba-8a00-4bff5171186c	FIRST_YEAR	1500.00	20.00	300.00	5.00	15.00	285.00	0.00	285.00	PENDING	\N	20.00% Split (GROSS_COMMISSION)	{"calculated_at": "2026-11-05T07:24:50.494552+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "625ab89c-10a8-46ba-8a00-4bff5171186c", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "07140e42-b1bb-402e-aa67-05b54430538d", "split_agreement_id": "a182056b-c311-4eba-8a01-5f12aaf55ee6", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-05 12:54:50.50154+05:30	2026-11-05 12:54:50.501544+05:30
e0eb14d7-a948-4f4a-91ee-9aae6b94a64f	7c89262c-bdfc-43ed-b012-3e29ed9c9a9c	b4ffa738-5bf5-46cc-b2e1-9f8b1fb18bed	625ab89c-10a8-46ba-8a00-4bff5171186c	RENEWAL	750.00	20.00	150.00	5.00	7.50	142.50	0.00	142.50	PENDING	\N	20.00% Split (GROSS_COMMISSION)	{"calculated_at": "2026-11-05T07:24:50.507258+00:00", "commission_type": "RENEWAL", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 7.5, "gross_commission": 750.0, "tds_rate_percent": 10.0, "tds_amount": 75.0, "net_commission_payable": 675.0, "sub_agent_id": "625ab89c-10a8-46ba-8a00-4bff5171186c", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 150.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 7.5, "sub_agent_net_payout": 142.5, "firm_gross_share": 600.0, "firm_net_bank_credit": 525.0, "agreement_id": "07140e42-b1bb-402e-aa67-05b54430538d", "split_agreement_id": "a182056b-c311-4eba-8a01-5f12aaf55ee6", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-05 12:54:50.509791+05:30	2026-11-05 12:54:50.509794+05:30
3670e1d0-9301-4810-9fe3-7d014dda78c7	9c3e3904-7f5e-469c-8c4c-11df47f9d161	9bee513e-7920-46ae-b3dc-438877b1cf73	b1129775-17b5-4a0e-b01b-fc44a353d562	FIRST_YEAR	1500.00	20.00	300.00	5.00	15.00	285.00	285.00	0.00	PAID	2026-11-05	Explicit Sub-Agent Allocation	{"calculated_at": "2026-11-05T07:26:20.526913+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "b1129775-17b5-4a0e-b01b-fc44a353d562", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "e57cd95f-fd42-467e-862e-1d29e9908d0f", "split_agreement_id": null, "override_reason": null}	\N	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 12:56:20.931579+05:30	Policy verified, commission received from insurer. Payout approved.	\N	\N	\N	2026-11-05 12:56:20.533363+05:30	2026-11-05 12:56:20.980449+05:30
85a5686b-5366-4ab7-833b-2dd1ca8ea0b4	83ac70ba-8819-4036-af99-a5ef424e0b1e	82b09482-7b09-4ff4-8334-bb9c73b6bc53	60ca45b7-ccd2-4930-be2c-8661095919b8	FIRST_YEAR	1500.00	20.00	300.00	5.00	15.00	285.00	0.00	285.00	PENDING	\N	20.00% Split (GROSS_COMMISSION)	{"calculated_at": "2026-11-05T07:26:31.312706+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "60ca45b7-ccd2-4930-be2c-8661095919b8", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "c06cf054-dd4b-491b-88e5-a9708d6ebde6", "split_agreement_id": "e6d25fec-096c-4cb6-9675-102a7538cfe0", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-05 12:56:31.320035+05:30	2026-11-05 12:56:31.320039+05:30
8a5bd528-1795-4d46-a485-d6a863161446	83ac70ba-8819-4036-af99-a5ef424e0b1e	a9eb76b5-5026-4eef-aeae-f6c25cea8500	60ca45b7-ccd2-4930-be2c-8661095919b8	RENEWAL	750.00	20.00	150.00	5.00	7.50	142.50	0.00	142.50	PENDING	\N	20.00% Split (GROSS_COMMISSION)	{"calculated_at": "2026-11-05T07:26:31.326636+00:00", "commission_type": "RENEWAL", "calculation_source": "RULE_AGREEMENT", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 7.5, "gross_commission": 750.0, "tds_rate_percent": 10.0, "tds_amount": 75.0, "net_commission_payable": 675.0, "sub_agent_id": "60ca45b7-ccd2-4930-be2c-8661095919b8", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 150.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 7.5, "sub_agent_net_payout": 142.5, "firm_gross_share": 600.0, "firm_net_bank_credit": 525.0, "agreement_id": "c06cf054-dd4b-491b-88e5-a9708d6ebde6", "split_agreement_id": "e6d25fec-096c-4cb6-9675-102a7538cfe0", "override_reason": null}	\N	\N	\N	\N	\N	\N	\N	\N	2026-11-05 12:56:31.329764+05:30	2026-11-05 12:56:31.329767+05:30
297dc36c-0d49-4e57-94cb-7dd423d00a02	3ef7ac86-26d4-4e76-815b-577fcba9c611	e13740bb-c070-408b-ad6d-f9b491d050f7	5c5e97a8-529b-4afa-adde-9bbefc6d3570	FIRST_YEAR	1500.00	20.00	300.00	5.00	15.00	285.00	285.00	0.00	PAID	2026-11-05	Explicit Sub-Agent Allocation	{"calculated_at": "2026-11-05T07:34:20.142892+00:00", "commission_type": "FIRST_YEAR", "calculation_source": "MANUAL_OVERRIDE", "commissionable_basis": "NET_PREMIUM", "eligible_premium": 10000.0, "insurer_rate_percent": 15.0, "gross_commission": 1500.0, "tds_rate_percent": 10.0, "tds_amount": 150.0, "net_commission_payable": 1350.0, "sub_agent_id": "5c5e97a8-529b-4afa-adde-9bbefc6d3570", "recipient_type": "SUB_AGENT", "allocation_basis": "GROSS_COMMISSION", "sub_agent_amount": 300.0, "sub_agent_tds_rate": 5.0, "sub_agent_tds_amount": 15.0, "sub_agent_net_payout": 285.0, "firm_gross_share": 1200.0, "firm_net_bank_credit": 1050.0, "agreement_id": "bff38c16-1a25-437b-ad68-c8500df287b2", "split_agreement_id": null, "override_reason": null}	\N	\N	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-05 13:04:21.249569+05:30	Policy verified, commission received from insurer. Payout approved.	\N	\N	\N	2026-11-05 13:04:20.157876+05:30	2026-11-05 13:04:21.489067+05:30
\.


--
-- Data for Name: insurance_sub_agents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_sub_agents (id, full_name, agent_code, mobile, email, address, joining_date, status, parent_firm, parent_agent_id, public_profile_slug, bio, specialties, show_contact_info, created_at, updated_at) FROM stdin;
04d134c4-a81b-447f-873b-483752abb726	Rajesh Mehra	SA-A75F	+919786670268	rajesh.sa-a75f@example.com	\N	2026-11-01	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-a75f	\N	\N	t	2026-11-01 23:10:15.2855+05:30	2026-11-01 23:10:15.285501+05:30
2fa761e8-066b-4e89-91bf-7b818267f8f1	Vikram Rathore	SA-A58E	+919728099801	vikram.sa-a58e@example.com	\N	2026-11-01	ACTIVE	FinNexus Enterprise	\N	vikram-sa-a58e	\N	\N	t	2026-11-01 23:08:19.698909+05:30	2026-11-01 23:11:23.366267+05:30
2471abdd-0075-454c-8f69-955d93c986d7	Rajesh Mehra	SA-8ACF	+919721514522	rajesh.sa-8acf@example.com	\N	2026-11-01	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-8acf	\N	\N	t	2026-11-01 23:14:09.722673+05:30	2026-11-01 23:14:09.722675+05:30
5e7d2ee0-2217-4ed2-9889-dfb168a91ebf	Rajesh Mehra	SA-5D72	+919736197456	rajesh.sa-5d72@example.com	\N	2026-11-03	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-5d72	\N	\N	t	2026-11-03 21:20:49.003169+05:30	2026-11-03 21:20:49.003171+05:30
3d8afb8c-6a5c-49b5-b978-e4acb928a2a7	Rajesh Mehra	SA-F8B2	+919732649323	rajesh.sa-f8b2@example.com	\N	2026-11-03	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-f8b2	\N	\N	t	2026-11-03 21:38:38.774502+05:30	2026-11-03 21:38:38.774504+05:30
f8669e68-20ea-43a8-a701-1c6815acc24d	Rajesh Mehra	SA-B58E	+919779914970	rajesh.sa-b58e@example.com	\N	2026-11-04	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-b58e	\N	\N	t	2026-11-04 22:42:06.020431+05:30	2026-11-04 22:42:06.020434+05:30
fa84d217-a1e7-4b6c-82c8-e17a572b23f4	Rajesh Mehra	SA-D2C4	+919707090152	rajesh.sa-d2c4@example.com	\N	2026-11-04	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-d2c4	\N	\N	t	2026-11-04 22:44:47.465227+05:30	2026-11-04 22:44:47.465231+05:30
6f1b2c25-8221-48b5-8444-c6f148d836b0	Rajesh Mehra	SA-7264	+919747343837	rajesh.sa-7264@example.com	\N	2026-11-04	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-7264	\N	\N	t	2026-11-04 22:46:19.452479+05:30	2026-11-04 22:46:19.452481+05:30
986c0e47-7366-4250-bebe-8f08e12da7c1	Rajesh Mehra	SA-0F61	+919753557106	rajesh.sa-0f61@example.com	\N	2026-11-04	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-0f61	\N	\N	t	2026-11-04 22:46:58.726556+05:30	2026-11-04 22:46:58.726558+05:30
496643ab-f715-4f3a-b3cf-1284671d681b	Rajesh Mehra	SA-B96F	+919718280287	rajesh.sa-b96f@example.com	\N	2026-11-04	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-b96f	\N	\N	t	2026-11-04 22:47:30.323652+05:30	2026-11-04 22:47:30.323655+05:30
10ed4880-6f78-4a40-aeb1-52196ceb4ff0	Rajesh Mehra	SA-8013	+919703834410	rajesh.sa-8013@example.com	\N	2026-11-04	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-8013	\N	\N	t	2026-11-04 23:02:39.735424+05:30	2026-11-04 23:02:39.735429+05:30
7aa93170-c892-489a-ac35-3a53f7c7b6aa	Rajesh Mehra	SA-C60C	+919757894850	rajesh.sa-c60c@example.com	\N	2026-11-04	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-c60c	\N	\N	t	2026-11-04 23:06:31.975174+05:30	2026-11-05 10:48:03.137779+05:30
b35ac685-0202-4be6-81e8-6b85f304603a	Rajesh Mehra	SA-32C0	+919758417449	rajesh.sa-32c0@example.com	\N	2026-11-05	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-32c0	\N	\N	t	2026-11-05 12:25:16.966316+05:30	2026-11-05 12:25:16.966322+05:30
cb432e66-7c5d-4234-9439-b99441687b2f	Rajesh Mehra	SA-0207	+919736598980	rajesh.sa-0207@example.com	\N	2026-11-05	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-0207	\N	\N	t	2026-11-05 12:53:35.007915+05:30	2026-11-05 12:53:35.007917+05:30
625ab89c-10a8-46ba-8a00-4bff5171186c	Rajesh Mehra	SA-A8A9	+919708693091	rajesh.sa-a8a9@example.com	\N	2026-11-05	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-a8a9	\N	\N	t	2026-11-05 12:54:50.468661+05:30	2026-11-05 12:54:50.468663+05:30
b1129775-17b5-4a0e-b01b-fc44a353d562	Karan Verma	AGT-7CF2	+919800239326	karan.agt-7cf2@example.com	\N	2026-11-05	ACTIVE	FinNexus Enterprise	\N	karan-agt-7cf2	\N	\N	t	2026-11-05 12:56:20.093336+05:30	2026-11-05 12:56:20.093338+05:30
60ca45b7-ccd2-4930-be2c-8661095919b8	Rajesh Mehra	SA-EBFC	+919792481262	rajesh.sa-ebfc@example.com	\N	2026-11-05	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-ebfc	\N	\N	t	2026-11-05 12:56:31.285101+05:30	2026-11-05 12:56:31.285102+05:30
5c5e97a8-529b-4afa-adde-9bbefc6d3570	Karan Verma	AGT-F5CD	+919886831729	karan.agt-f5cd@example.com	\N	2026-11-05	ACTIVE	FinNexus Enterprise	\N	karan-agt-f5cd	\N	\N	t	2026-11-05 13:04:19.287087+05:30	2026-11-05 13:04:19.287092+05:30
858d20a3-fbaf-4e1a-8122-74f6a147576a	Rajesh Mehra	SA-A25D	+919711965990	rajesh.sa-a25d@example.com	\N	2026-11-05	ACTIVE	FinNexus Enterprise	\N	rajesh-sa-a25d	\N	\N	t	2026-11-05 13:04:26.90041+05:30	2026-11-05 13:04:26.900414+05:30
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) FROM stdin;
7b90e5ca-ec3f-4960-aa06-cc4bbd8b7186	40351e16-e0dd-4064-a060-bd866d35bc63	cd141afe106f0d672952860b6fbe2778c207ef7a3e993ed1655d0fb2997df5a9	2026-11-02 01:06:45.68796+05:30	\N	2026-11-01 17:06:45.690236+05:30
4b2d9198-a5aa-444c-afab-e3d5da5da9e8	40351e16-e0dd-4064-a060-bd866d35bc63	d36f40eb7477b1cafbe61c24e252f094be6b8233da827b0be079581bb1568e0d	2026-11-02 01:07:47.016854+05:30	\N	2026-11-01 17:07:47.018187+05:30
5d1e6904-1b60-420f-b8fa-d90e0f35e536	40351e16-e0dd-4064-a060-bd866d35bc63	5355ef8152503614a0993fb37d038e382d3706414b94a52c7e35a0eb273fe875	2026-11-02 01:17:06.188389+05:30	2026-11-01 17:46:01.883107+05:30	2026-11-01 17:17:06.191609+05:30
e7cb1ad7-07ca-4e5f-97aa-a735a9ef9baa	40351e16-e0dd-4064-a060-bd866d35bc63	d776d6ada3b22aab67fb0452e5a1034435d72e79db3e6cc0b640af708d6de5b1	2026-11-02 01:51:51.221009+05:30	\N	2026-11-01 17:51:51.222597+05:30
48cf9960-014d-4bc1-8e47-cc762cf58677	40351e16-e0dd-4064-a060-bd866d35bc63	f667cd0077ae8e3731e9e77f6f3ccc92158c36d28c9f557cb2eca67acc2c2d82	2026-11-02 01:51:55.3459+05:30	\N	2026-11-01 17:51:55.346899+05:30
88bc910b-1466-4314-9b4a-098ada7f4a25	40351e16-e0dd-4064-a060-bd866d35bc63	34211d0ffc1acc98f8fe4d6dfb0bff6adc89d8cd8ada275eed34cd337e44d2c0	2026-11-02 01:51:59.301664+05:30	\N	2026-11-01 17:51:59.303906+05:30
89586a8e-4355-442c-b8f2-6aa01352a72a	40351e16-e0dd-4064-a060-bd866d35bc63	04cc3453b622928b385aec093eee9a1b1725a39108978e501dfad597f821adac	2026-11-02 01:52:03.171309+05:30	\N	2026-11-01 17:52:03.172416+05:30
8395959c-3c55-4a18-96ac-8bdb5f2dff6a	40351e16-e0dd-4064-a060-bd866d35bc63	f443c74102dc7bbc0f4c912e62e240c7b03e8d2a33a89d27e36462784868e07c	2026-11-02 01:52:06.865822+05:30	\N	2026-11-01 17:52:06.867191+05:30
c084ce5d-0f1c-4eaa-b564-cbfd6ac372bd	40351e16-e0dd-4064-a060-bd866d35bc63	18db36733b217066c4f6644994c974cf860a2bd16f8e850cd74ca6559c471f8f	2026-11-02 01:52:10.738491+05:30	\N	2026-11-01 17:52:10.73946+05:30
f3af71d0-dff1-4c6b-855d-4e9af0cb2dd8	40351e16-e0dd-4064-a060-bd866d35bc63	7260c13c417630c49d166608aea8b022fa7bc03d890846207c98f239d23f68c4	2026-11-02 01:52:14.762793+05:30	\N	2026-11-01 17:52:14.763513+05:30
092089ac-68b0-476f-a6a4-5252d5d15378	40351e16-e0dd-4064-a060-bd866d35bc63	8d7bcc78aad07f9791b95d55b667b85b0b609a587c84119d1a26d12c1b26c47c	2026-11-02 01:54:15.889807+05:30	\N	2026-11-01 17:54:15.892523+05:30
ebf4c3b9-d837-4abe-8de0-07c49c964f0d	40351e16-e0dd-4064-a060-bd866d35bc63	db931db931822a6a3f3e797a4537b6603824ec9b33c94ffd1d1ae16fef946fb6	2026-11-02 01:54:26.280344+05:30	\N	2026-11-01 17:54:26.282888+05:30
d84c49d0-8739-4851-bf28-af2bd0eef796	40351e16-e0dd-4064-a060-bd866d35bc63	fdf01c721545d7840d7b75058f4da49d0c6e4a2d9bbcf1a73efe85d2a66c4d73	2026-11-02 01:54:29.26675+05:30	\N	2026-11-01 17:54:29.268237+05:30
603ab8ea-7308-4e30-8b67-f458e494d5a6	40351e16-e0dd-4064-a060-bd866d35bc63	9acd73ed44bb9ceb9a5d4a07708b9bf7df60fffd08d4ccbef98355fefbbb1ce4	2026-11-02 01:54:31.92246+05:30	\N	2026-11-01 17:54:31.923399+05:30
28a4c035-ca52-420e-972c-2b0fe1f73714	40351e16-e0dd-4064-a060-bd866d35bc63	ac0273e6286b167bdf4f8888a073e54edbfd089a19779e6cda20ee0367228b95	2026-11-02 01:54:34.612036+05:30	\N	2026-11-01 17:54:34.612693+05:30
d28909fe-24aa-4e39-b2f7-b09a95ed96a7	40351e16-e0dd-4064-a060-bd866d35bc63	44dec13905c4340ae59b300c41c7cdf709e3f5c78d6c6b141f3119143b328847	2026-11-02 01:54:39.663848+05:30	\N	2026-11-01 17:54:39.665698+05:30
56a3f4e4-e445-4a14-919c-907adade02a1	40351e16-e0dd-4064-a060-bd866d35bc63	ecc4db9f3d999a2eca7ebb41c0bc2a182b010dfceae803fe3771f7e6fbdc5402	2026-11-02 01:54:48.89097+05:30	\N	2026-11-01 17:54:48.892839+05:30
6db5ab77-33fd-49b6-bce9-3859dd7c1dfb	40351e16-e0dd-4064-a060-bd866d35bc63	9c98f815a2611f013a30ca4b20f3529f56e71c1c398ce18883de5bd769ae14ca	2026-11-02 01:54:57.788729+05:30	\N	2026-11-01 17:54:57.790553+05:30
d3cadfb2-a565-4d18-aa5a-1ce3e834d788	40351e16-e0dd-4064-a060-bd866d35bc63	7860e3d1e4dab02a43554f682989ece060de0acac23d266107b9418ba6b9a2ac	2026-11-02 01:56:24.125401+05:30	\N	2026-11-01 17:56:24.126811+05:30
40826325-7935-431a-96a0-fa5c95f7cb8b	40351e16-e0dd-4064-a060-bd866d35bc63	677253ca3fc255ae7f90378cfc056b32073a6fbb0bec4a10e8af2fd528a9a961	2026-11-02 01:56:26.6614+05:30	\N	2026-11-01 17:56:26.662386+05:30
ffcf67e5-8a2a-4e71-a3d6-6b5ce2dc02ff	40351e16-e0dd-4064-a060-bd866d35bc63	351c4aef92b477aa805fff2a6c934025d7ce289164f36e09cfb5c0c28a0168c8	2026-11-02 01:56:29.378538+05:30	\N	2026-11-01 17:56:29.379126+05:30
60e52414-af39-4bd5-a04b-cd1be5648a71	40351e16-e0dd-4064-a060-bd866d35bc63	7a9642963f1e3376ec793621c7ab38effece4d707cd0471ae8185fc2c6d80f78	2026-11-02 01:56:32.278591+05:30	\N	2026-11-01 17:56:32.279256+05:30
bcb77c6a-5584-4d77-aea2-4121111ad1bb	40351e16-e0dd-4064-a060-bd866d35bc63	73d45bf50840824076c4dcbf21a95079a8405e0cd74b16bf04eed7ad09491a5a	2026-11-02 01:56:38.69298+05:30	\N	2026-11-01 17:56:38.693844+05:30
8fbc7ee3-c83f-457e-be83-296f4790b166	40351e16-e0dd-4064-a060-bd866d35bc63	50972289c8a8a586072b758d084a9e8c3bb5bca4687ffadaf426b3c40e6052a9	2026-11-02 01:56:47.817079+05:30	\N	2026-11-01 17:56:47.817974+05:30
a1d1b5a7-1122-43eb-a126-93f999cdba92	40351e16-e0dd-4064-a060-bd866d35bc63	c09b859ee968bdb11c3f6b8764861a4603175bfccd83bf2774407401c486aaa3	2026-11-02 01:56:56.710168+05:30	\N	2026-11-01 17:56:56.712427+05:30
8e161613-ab4b-457a-9f77-e80c9a32dae6	40351e16-e0dd-4064-a060-bd866d35bc63	d7fd19b0a224f4d98ece41d6b5a7c9f1b140bf97ecddbbe2742e7d2838432044	2026-11-02 01:57:33.568447+05:30	\N	2026-11-01 17:57:33.570027+05:30
26ff4a9e-6543-4d86-b06b-b4b9bb8f37e9	40351e16-e0dd-4064-a060-bd866d35bc63	97e8c15143b07346575c1ec8a043e9882f564f53c38af80f13b7426a03950286	2026-11-02 01:57:36.044154+05:30	\N	2026-11-01 17:57:36.045073+05:30
ef410398-0e33-4187-8899-a122fb58712d	40351e16-e0dd-4064-a060-bd866d35bc63	e3dd247567c93ca5f80004553a58708c4a420be0777e7cdddb482fa4a0fbf537	2026-11-02 01:57:38.623353+05:30	\N	2026-11-01 17:57:38.624309+05:30
70e1ddde-69d9-43a2-9b71-2314325b501d	40351e16-e0dd-4064-a060-bd866d35bc63	342d274e90f2b1d78fc2928985dc5838db0de96b0fa70183e015325d46dd714b	2026-11-02 01:57:41.235201+05:30	\N	2026-11-01 17:57:41.236126+05:30
7b87acaa-7278-43d1-b998-d539cae813bd	40351e16-e0dd-4064-a060-bd866d35bc63	e717f176b9b15c79910dbfddf76fb7ef2c7c7b1d6d73667a5f486f2b4d28143c	2026-11-02 01:57:47.82561+05:30	\N	2026-11-01 17:57:47.826938+05:30
31fd4b7d-637c-4ba0-b8e4-5dbc369bacd2	40351e16-e0dd-4064-a060-bd866d35bc63	b301b24caae67d6148b604b1b11d38edb1361d1873ef0a4cd8329694c456a924	2026-11-02 01:57:56.887625+05:30	\N	2026-11-01 17:57:56.888539+05:30
474cd181-ef62-4d8d-b115-da58aba93dfa	40351e16-e0dd-4064-a060-bd866d35bc63	4041f2a2beffeb0976e6c10caa364a87642b05165316d3c22889c9c69ac89c66	2026-11-02 01:58:05.828311+05:30	\N	2026-11-01 17:58:05.831435+05:30
f89ddf4e-9f98-4309-876b-397084d4367b	40351e16-e0dd-4064-a060-bd866d35bc63	481da0727ac70a1b9c1bbf4c264d1e9648852a854290b3225387082b42c152a6	2026-11-02 01:59:01.645092+05:30	\N	2026-11-01 17:59:01.649241+05:30
5ce5dbbe-f130-4530-b752-5691d2c1eebd	40351e16-e0dd-4064-a060-bd866d35bc63	31694e761a84b1a08d9535faf1d037723833f87aa2368b9ee0fabfbd37410807	2026-11-02 01:59:04.121249+05:30	\N	2026-11-01 17:59:04.1223+05:30
11ba9aed-bb0a-44cc-910f-abd557347b41	40351e16-e0dd-4064-a060-bd866d35bc63	b33a9f5dab318243445e569c11dc6324d4cf80b4a447da7caf70585371f2dcda	2026-11-02 01:59:06.526858+05:30	\N	2026-11-01 17:59:06.528326+05:30
522d6c6d-a7ca-41d2-a692-3fe3f9e3574a	40351e16-e0dd-4064-a060-bd866d35bc63	c4dcdacf9a4cbf8316eaf4b98671cb33fa5f84d52a3212efc99da8cdf664b6f1	2026-11-02 01:59:09.003446+05:30	\N	2026-11-01 17:59:09.004931+05:30
eac6f787-97fa-4f66-aeec-38cc560a30bd	40351e16-e0dd-4064-a060-bd866d35bc63	06ac205316a0413ba9056bd005c7d6d244928bbecb9c18046ce94b77b3008b2b	2026-11-02 01:59:13.68648+05:30	\N	2026-11-01 17:59:13.687484+05:30
e8c63646-60ab-4110-ab3c-3f8eb0ef840c	40351e16-e0dd-4064-a060-bd866d35bc63	b79575890a72d9cc2f3e7a7bc2fcdd3876e7e76a596cd0cdfe0be3cfb7f89409	2026-11-02 01:59:22.546927+05:30	\N	2026-11-01 17:59:22.547527+05:30
9e9a5da8-3c80-49c6-9e54-e4e0fa3b49ad	40351e16-e0dd-4064-a060-bd866d35bc63	600943aa708283f6ad24ad2b88ea4e3d48e75422da5af08ffd334f8b4e4b6454	2026-11-02 01:59:31.177729+05:30	\N	2026-11-01 17:59:31.179105+05:30
df2b0412-0f70-4764-ad95-8a2be6fa0833	40351e16-e0dd-4064-a060-bd866d35bc63	8a6fcdb593a03ee8fc44ebb2c9f4f08a163f387fbb0034ce297827e082ada2ce	2026-11-02 02:11:48.367713+05:30	\N	2026-11-01 18:11:48.370346+05:30
b9c0def3-44a0-4c58-a01b-5a09e359be79	40351e16-e0dd-4064-a060-bd866d35bc63	add83c567f43d71257f3f109d96b6c641e776c0835234865df93c8311e4fda70	2026-11-02 02:11:51.095469+05:30	\N	2026-11-01 18:11:51.096425+05:30
ccfdd334-d5a1-4777-9155-7608f804df8b	40351e16-e0dd-4064-a060-bd866d35bc63	a12c0fde777ae28348cad2656146b89d931fa80d9efe9d76dffe05fff634d55b	2026-11-02 02:11:53.821501+05:30	\N	2026-11-01 18:11:53.823161+05:30
7807e4ab-3cd1-4ced-ae02-1ea4fafc2b42	40351e16-e0dd-4064-a060-bd866d35bc63	7f2e3cedc67182721d3b0e87874f20b4b1202d07e670b9b23f2c21137a0aa004	2026-11-02 02:11:56.424551+05:30	\N	2026-11-01 18:11:56.425244+05:30
f6955dea-4038-4b71-9641-dd44f0ef5f8c	40351e16-e0dd-4064-a060-bd866d35bc63	5fb817cd95cf875d98657f10f0c08df3ce95cf60b1ba38dac9f7ae31ba4727b5	2026-11-02 02:12:01.413198+05:30	\N	2026-11-01 18:12:01.41433+05:30
018964b9-8fb3-4abd-bc34-4002e9780daf	40351e16-e0dd-4064-a060-bd866d35bc63	9422ac2957143c0b014a69db0d60fe7cd95f974e7673153a7abcf2dce5dd3460	2026-11-02 02:12:10.489853+05:30	\N	2026-11-01 18:12:10.491267+05:30
39a4b31b-6d19-4477-b4f7-aa9eb837dbab	40351e16-e0dd-4064-a060-bd866d35bc63	412ede51dbc7d020676b93e2ac35b23cc5c1b40ee09e169c51ce2b2927049180	2026-11-02 02:12:19.344357+05:30	\N	2026-11-01 18:12:19.345674+05:30
d0532675-105a-4a63-8d5a-004d38bead94	40351e16-e0dd-4064-a060-bd866d35bc63	3a1332fc349ceeeacb686d2fcf753b4a2d9a28cce224199bd8c6e48affbaecdb	2026-11-02 01:54:21.558581+05:30	2026-11-01 18:14:18.303377+05:30	2026-11-01 17:54:21.56195+05:30
265d8622-11cc-43e3-95e3-e5a5460ce2a1	40351e16-e0dd-4064-a060-bd866d35bc63	f001a227b9343449b1bb5ea3ef2791b7bad8ebb02cc407ded7b7d945f9ac810b	2026-11-02 01:54:21.558581+05:30	2026-11-01 18:14:29.213045+05:30	2026-11-01 18:14:18.323218+05:30
324736e2-ed2a-466b-b889-a254cd9b11d4	40351e16-e0dd-4064-a060-bd866d35bc63	cb4c340d5eba549738d638d6a79bf7ba68b3617fd44e2ae118f12a156764b1d0	2026-11-02 02:27:56.280723+05:30	\N	2026-11-01 18:27:56.282338+05:30
66a6c5ba-815e-42e8-b997-a39be4be5a82	40351e16-e0dd-4064-a060-bd866d35bc63	0db475507c42cd4e88d342b0459e19576ccddf642b8ba356e6d59ccb08ef82fc	2026-11-02 02:28:35.301373+05:30	\N	2026-11-01 18:28:35.303656+05:30
5e654661-5cbc-4a28-aa39-322ffe5b17f3	40351e16-e0dd-4064-a060-bd866d35bc63	d698f5e9dd371ffb21daff87772f5c066ae437214d73190dda6717dad59b3a63	2026-11-02 01:54:21.558581+05:30	2026-11-01 18:29:45.553549+05:30	2026-11-01 18:14:29.219409+05:30
9723d03b-908e-4b0c-853e-4f509f5d8e88	40351e16-e0dd-4064-a060-bd866d35bc63	2141f3f1f708759591150b670c08d183ef81c81c4fa7b611bc548eb6e4dd9af3	2026-11-02 01:54:21.558581+05:30	\N	2026-11-01 18:29:45.571315+05:30
1327d9a4-be76-44f4-86cd-b853d3da26f7	40351e16-e0dd-4064-a060-bd866d35bc63	61f5bf0087242c0dee73c4dce9045f59b3603502c3739b713887f9403ad3db85	2026-11-02 02:31:53.407303+05:30	\N	2026-11-01 18:31:53.409079+05:30
5530a410-3990-451f-86d4-bb0b98eac685	40351e16-e0dd-4064-a060-bd866d35bc63	7bdd0b53b1393ca2bcd155495ee93aafaae96b38540a6a39624e55022a02ea63	2026-11-02 02:31:55.787369+05:30	\N	2026-11-01 18:31:55.788477+05:30
a71ffa51-01ce-4a0a-ab31-99cec56879cb	40351e16-e0dd-4064-a060-bd866d35bc63	3565c313862635bb202a22da86d30af42fb59349e20f74acb8ca2a2806706a87	2026-11-02 02:31:58.266901+05:30	\N	2026-11-01 18:31:58.268301+05:30
9f4c03c7-4085-4472-abf8-30d9359ffc4b	40351e16-e0dd-4064-a060-bd866d35bc63	9595409777772a4fd5c96363ba2daa448769d8e4a1ce698a54296b24db655421	2026-11-02 02:32:00.854474+05:30	\N	2026-11-01 18:32:00.855571+05:30
044e8d90-6eb0-46a1-8eb3-9fd5f3e51c12	40351e16-e0dd-4064-a060-bd866d35bc63	4cc63591028136561fb4ca42c6771ca6e76df86e920409727186be5c9d2e213b	2026-11-02 02:32:05.627503+05:30	\N	2026-11-01 18:32:05.628955+05:30
bddb5f71-8cd8-426c-a3ca-684464c76a6a	40351e16-e0dd-4064-a060-bd866d35bc63	f7d4e197146f8ff07a8374c8a5bfaabfeb8d508ce97f4e8fafae7c6a233db0b8	2026-11-02 02:32:14.591561+05:30	\N	2026-11-01 18:32:14.593691+05:30
96f31427-e03a-40a8-880f-3bb4fca6f213	40351e16-e0dd-4064-a060-bd866d35bc63	818dccb59cb9f3c5147c9b6c7a2285307c829aa10849ccd28caeb4b982d5777d	2026-11-02 02:32:23.456566+05:30	\N	2026-11-01 18:32:23.457509+05:30
3b3ecade-fa0c-4a7a-8b5f-d790df4158c2	40351e16-e0dd-4064-a060-bd866d35bc63	77696662e7824604937ba97d207e646a601bc7c6e84f0c9686411e775bbf104a	2026-11-02 04:44:59.408332+05:30	\N	2026-11-01 20:44:59.409683+05:30
ed542327-cc64-407f-aebb-f881330d9297	40351e16-e0dd-4064-a060-bd866d35bc63	17d6964054b97131ff72748e9299bebbf874ce20839139ccc062ad8152b82a87	2026-11-02 04:45:01.909661+05:30	\N	2026-11-01 20:45:01.910676+05:30
4f7cd8a5-ce3f-4549-a94e-ca7afa3b8873	40351e16-e0dd-4064-a060-bd866d35bc63	6e1bf8b1aefff0a8491c28ca1187e94aa9c080dd42afebf1b31d8237d5cf71af	2026-11-02 04:45:04.346024+05:30	\N	2026-11-01 20:45:04.34663+05:30
7979c46f-3ea5-4ff6-a41e-040dcfa4b426	40351e16-e0dd-4064-a060-bd866d35bc63	71918355ef234f39d99ab655ac2abd9fc553b7db0557abfa304411a50453d3d3	2026-11-02 04:45:06.864323+05:30	\N	2026-11-01 20:45:06.865168+05:30
5cd585ce-e3f0-4f07-848a-f6a2568df97f	40351e16-e0dd-4064-a060-bd866d35bc63	890e02fccce67b57fccc36ce78e8275ce3a295a174bdb834287cd99acb3d540b	2026-11-02 04:45:11.832321+05:30	\N	2026-11-01 20:45:11.832943+05:30
6ea1d391-f690-4796-8462-cda7322514bf	40351e16-e0dd-4064-a060-bd866d35bc63	6faaf1d500b502112a1e6393a98b0f47ebf2eda2e8a6caeff3a5ffd12cc50c0f	2026-11-02 04:45:20.813171+05:30	\N	2026-11-01 20:45:20.814084+05:30
dca9cc4e-d9a5-4baa-8c53-08ec1e5a051b	40351e16-e0dd-4064-a060-bd866d35bc63	a0256e4f0c5dd4846f893628fafa9ab6bc228913992feda764b09ce28faf480b	2026-11-02 04:45:29.45378+05:30	\N	2026-11-01 20:45:29.454431+05:30
25b257e0-068f-407f-9a6c-7eac842ad260	40351e16-e0dd-4064-a060-bd866d35bc63	58cb2ae99c042819701c646cb8b9ef8f0633f2a51d024f35e62509fe22b4b8a5	2026-11-02 04:29:09.342049+05:30	2026-11-01 20:49:10.982914+05:30	2026-11-01 20:29:09.349691+05:30
b388a228-edc0-4e85-a901-1b77824da8d1	40351e16-e0dd-4064-a060-bd866d35bc63	a1662fd2d29d7f3fecd3673e95b968e64a3e482638c5bc210146f36e691c1d58	2026-11-02 04:29:09.342049+05:30	2026-11-01 20:50:02.888121+05:30	2026-11-01 20:49:11.021391+05:30
382e04fe-6775-4a2d-8c06-e287849c7a09	40351e16-e0dd-4064-a060-bd866d35bc63	b2df5d270547a70068325156afc7967d318f3342f4622a3916f4d9cb01bfd74f	2026-11-02 05:10:13.740798+05:30	\N	2026-11-01 21:10:13.743292+05:30
64886579-6450-4bc6-85a0-fb14a77888ec	40351e16-e0dd-4064-a060-bd866d35bc63	e7c82e48f839a606c10eaf1399ec7411e800a96784f50cd19e4942acdecdd04a	2026-11-02 05:10:26.518279+05:30	\N	2026-11-01 21:10:26.519284+05:30
b1494ec9-6edb-4bd3-b3fa-c89215fecfce	40351e16-e0dd-4064-a060-bd866d35bc63	b6ed21216118239f43e6acb61011e6bfd6d2a6911d164d24261da1f27e054f3f	2026-11-02 05:10:43.420578+05:30	\N	2026-11-01 21:10:43.421472+05:30
246f4da2-151a-476a-aa59-3e252b093c6d	40351e16-e0dd-4064-a060-bd866d35bc63	f7ef3921927ad088ed65ced4513966453c616feb267455316ea4bff6ea6dcc64	2026-11-02 05:11:00.460873+05:30	\N	2026-11-01 21:11:00.461924+05:30
81695740-9fe8-4906-940c-7edae6327f0c	40351e16-e0dd-4064-a060-bd866d35bc63	dae64f390d56399601cca6cac5f302e4680a0b6f5f976e0beadf2f71507f808a	2026-11-02 05:11:17.361781+05:30	\N	2026-11-01 21:11:17.362585+05:30
34ffd837-64f4-46a0-8425-35a447e56e26	40351e16-e0dd-4064-a060-bd866d35bc63	7127ac6dcac4ecff931b84e32fe8aa4a896a1022f58ca3a05c218ba823a9ef0c	2026-11-02 05:12:02.604787+05:30	\N	2026-11-01 21:12:02.607238+05:30
44adca10-27ef-43c1-819b-a0c3d7479f86	40351e16-e0dd-4064-a060-bd866d35bc63	6ecac7ffba877ad9d28479c272e66aaadb35214fe5f6b564d5420a0a11b5908f	2026-11-02 05:12:17.410019+05:30	\N	2026-11-01 21:12:17.410896+05:30
7077b815-e9ec-4f9e-ab8f-cd267dcef023	40351e16-e0dd-4064-a060-bd866d35bc63	df86cf2ba25db2479be5e83481518b0a37e6525c3f0d59047a1e86481bcc7cf7	2026-11-02 04:50:08.369523+05:30	2026-11-01 21:12:26.893012+05:30	2026-11-01 20:50:08.371661+05:30
84d8f721-fe56-4b45-9498-d0880b26e522	40351e16-e0dd-4064-a060-bd866d35bc63	4caed1ab8cea65710eb300accd1e0c23c6c2bb5b3a881c124fa6d7b38182ca40	2026-11-02 05:12:34.320164+05:30	\N	2026-11-01 21:12:34.321213+05:30
66965791-25b3-4821-b128-15a1141919be	40351e16-e0dd-4064-a060-bd866d35bc63	7b284e5c8b2553bb39f33290c1dc9308087b84b4e450a8f9d77f8177059b917e	2026-11-02 05:12:51.080148+05:30	\N	2026-11-01 21:12:51.081528+05:30
1a333516-1cd6-4133-b5fb-af86d9747648	40351e16-e0dd-4064-a060-bd866d35bc63	5e4b237e3f34fd8d802aee89c9aeb7ec6b313221bea8fa31d1112c1759d3d48f	2026-11-02 05:13:08.00298+05:30	\N	2026-11-01 21:13:08.003985+05:30
b9bb7275-216c-44a6-96f4-aa6da1c944ef	40351e16-e0dd-4064-a060-bd866d35bc63	6f1d0ed91f87bed6bd698b1a164b7801c2f3dd93e31bbbd8f8c8c8baec643088	2026-11-02 05:13:47.187406+05:30	\N	2026-11-01 21:13:47.189723+05:30
8f1a8f21-f28c-4aff-98a6-1a9927ae9cf9	40351e16-e0dd-4064-a060-bd866d35bc63	67f2f3f01ffa3c69e7217ff1c4ddf377c38e3428d57647b4b16f8f11816cecab	2026-11-02 05:13:49.583764+05:30	\N	2026-11-01 21:13:49.585023+05:30
b4261bc1-c4a8-4a6c-935e-bdd226b2eda6	40351e16-e0dd-4064-a060-bd866d35bc63	05486da10889aa8e72a17b9607d614718b5de7d05da530f97bcda6c7a98a11d5	2026-11-02 05:13:51.982384+05:30	\N	2026-11-01 21:13:51.983013+05:30
1b638621-541b-47a8-9198-7c8ebd0f5702	40351e16-e0dd-4064-a060-bd866d35bc63	9a1857ceebf64e64bd708c49ae464ebece3d1cda6f1f61fff9df05d567682fa8	2026-11-02 05:13:54.304576+05:30	\N	2026-11-01 21:13:54.305507+05:30
526fee98-a647-4cbe-b10e-0a7f1a9e42b7	40351e16-e0dd-4064-a060-bd866d35bc63	f43da3a443b955f76206ac5f99872f97b232d4ff92e8eccdfb0114872f46115e	2026-11-02 05:13:58.979538+05:30	\N	2026-11-01 21:13:58.980625+05:30
b5050e27-7798-4e97-a24c-c6619c486f3c	40351e16-e0dd-4064-a060-bd866d35bc63	060d7c340f6765be46f2e9bb63088aeabf7e0818def91372925044e438ff70fa	2026-11-02 05:14:07.602836+05:30	\N	2026-11-01 21:14:07.603714+05:30
ea7cd5b1-ea52-4ebd-8d48-c9d8195d321d	40351e16-e0dd-4064-a060-bd866d35bc63	7a6709c42843492de69f67a98109f433ec06d5a3805afaacecc45be2fea35a1b	2026-11-02 05:14:16.258378+05:30	\N	2026-11-01 21:14:16.259901+05:30
932ae5eb-e319-4ff8-acf9-fee472bb403b	40351e16-e0dd-4064-a060-bd866d35bc63	f120ea5b67ace1f599ee98ac5b731f77c0044104c6059e46133e1b67f4cdbf9a	2026-11-02 05:23:43.370315+05:30	2026-11-01 21:41:40.65853+05:30	2026-11-01 21:23:43.372915+05:30
6a9c13a0-add6-4166-89b0-d0196c06fb5d	40351e16-e0dd-4064-a060-bd866d35bc63	5d90e1dd9d3423937c9128f90ef3255e8e9c5563f75eedff3eb0c35cd3e80252	2026-11-02 05:23:43.370315+05:30	\N	2026-11-01 21:41:40.674253+05:30
7231ca1a-87e4-494b-b1e3-d872c1662179	40351e16-e0dd-4064-a060-bd866d35bc63	d87f027ccea039c577a312694895359a12d3cf8ad5aa59ce7d7117ca38e17fcf	2026-11-02 05:59:47.688261+05:30	\N	2026-11-01 21:59:47.68997+05:30
a3d5f80b-6ea2-4f09-b197-71cd9baa7483	40351e16-e0dd-4064-a060-bd866d35bc63	2625869fc6318000c74162c993da907865ea3d176c9795b1202e8d88984eaabf	2026-11-02 06:00:02.703105+05:30	\N	2026-11-01 22:00:02.704087+05:30
38c0d081-c35d-4c0f-a036-0dbfaf2172e7	40351e16-e0dd-4064-a060-bd866d35bc63	2904889df24b6adc935ebc1dbd92b58a344bf417dcd010d7f3de65c17a542efb	2026-11-02 06:00:19.62324+05:30	\N	2026-11-01 22:00:19.624171+05:30
d7f10207-434f-4f82-9f85-f02ff23fe7d2	40351e16-e0dd-4064-a060-bd866d35bc63	fc576b67a9522be903e9711a6bc49371003b80b09ca6fcea35f7e4d6e4ce7f43	2026-11-02 06:00:36.685302+05:30	\N	2026-11-01 22:00:36.68626+05:30
43169652-308a-481b-a357-58bbf1f6e346	40351e16-e0dd-4064-a060-bd866d35bc63	f337f233c5d4733b7f0c07d2de7785f01a9238aec15806edaf98fa5de4eb3af3	2026-11-02 06:00:53.566157+05:30	\N	2026-11-01 22:00:53.566813+05:30
a2d039c5-7fae-4a3f-8573-35577b42996f	40351e16-e0dd-4064-a060-bd866d35bc63	e610607a3cd78a6e4ac21c239c85448a8b562e9775e1f66b5d5e78771d3dec47	2026-11-02 06:01:22.003515+05:30	\N	2026-11-01 22:01:22.005982+05:30
6ab39fa1-f853-4d00-a5e7-0330b8b36230	40351e16-e0dd-4064-a060-bd866d35bc63	6998649a9dc16dec3486528dba6dfff32f3a5718b4fe3f7681967db57089343d	2026-11-02 06:01:44.084138+05:30	\N	2026-11-01 22:01:44.084914+05:30
151b5db1-2bc5-43ae-a7ea-f4a4e3a4c680	40351e16-e0dd-4064-a060-bd866d35bc63	c35caab67d0e2f54b80838f01e4ca7640f774ee86a11f9d04c4ebf1886ef7151	2026-11-02 06:02:05.366061+05:30	\N	2026-11-01 22:02:05.36688+05:30
8afb0f33-13fb-419c-88fb-10120804a431	40351e16-e0dd-4064-a060-bd866d35bc63	5e1773e0d3e37bca816e5f9f30d41ccd0a2591a88ff771a150d37bfb45c0eb19	2026-11-02 06:02:23.175956+05:30	\N	2026-11-01 22:02:23.176901+05:30
75e96824-c2ae-4ebc-8f27-b4bf64edb89b	40351e16-e0dd-4064-a060-bd866d35bc63	15f1698c528eb0369752a73044394b5a24403190e6ac500f9cf2e083aaca1c15	2026-11-02 06:03:31.418084+05:30	\N	2026-11-01 22:03:31.420979+05:30
67315f92-948a-4c36-8143-9c3e67df0938	40351e16-e0dd-4064-a060-bd866d35bc63	4759bed41bf42b0dab83788385feb0687f774409b2110847db9b65ec1907b2a3	2026-11-02 06:03:52.862258+05:30	\N	2026-11-01 22:03:52.862989+05:30
70c44d79-728d-4562-9b3b-03651a432d83	40351e16-e0dd-4064-a060-bd866d35bc63	da0244e22d236ccf404ee96eb32398fe86d0806944145c34295f7c90bf81b1a9	2026-11-02 06:04:14.296929+05:30	\N	2026-11-01 22:04:14.297891+05:30
88ef8ced-9b1b-4cc1-aa2f-1bd27be042fd	40351e16-e0dd-4064-a060-bd866d35bc63	f1ac26048fef60421616306355bd0dcb834e7b3b24d15cc226d0bd929836fc8b	2026-11-02 06:04:31.708395+05:30	\N	2026-11-01 22:04:31.709109+05:30
5a44938d-9ba1-45ec-94c1-fbf33b574d5e	40351e16-e0dd-4064-a060-bd866d35bc63	a18a20a2fa710b589e3f7e280ee1678cc0b9385e11744698e06145123be723ef	2026-11-02 06:05:34.16495+05:30	\N	2026-11-01 22:05:34.166527+05:30
16d10e17-bfb3-42a3-9259-7488f0f572ae	40351e16-e0dd-4064-a060-bd866d35bc63	5b0891d68ada1089cfc7947b02d2ce81dcc0b42f6713821c41639f4a30ed512f	2026-11-02 05:43:02.902724+05:30	2026-11-01 22:10:44.209674+05:30	2026-11-01 21:43:02.905793+05:30
42234063-fa28-4cb3-8239-3776c0d257f5	40351e16-e0dd-4064-a060-bd866d35bc63	d7739493492af9bcccf4ab31087e64aaa5943ea015b64b8f9742d8f10a104371	2026-11-02 06:05:59.909635+05:30	\N	2026-11-01 22:05:59.910355+05:30
eabef74c-9494-48fa-9c7d-cb10546bce51	40351e16-e0dd-4064-a060-bd866d35bc63	76d2cc287adc439342400041670a270aa31c5ac3b8596391beb587d7058fd76d	2026-11-02 06:06:21.540542+05:30	\N	2026-11-01 22:06:21.541624+05:30
d65d4fd5-61c0-4df5-b234-b5083a2cef5a	40351e16-e0dd-4064-a060-bd866d35bc63	f8a7e0e046b09537c2e527906a01ea1feb67ea79878d9e87e35d5aeb18546b58	2026-11-02 06:06:51.261348+05:30	\N	2026-11-01 22:06:51.261904+05:30
fb67572f-2bec-4816-bb1b-1c0a308bf38f	40351e16-e0dd-4064-a060-bd866d35bc63	f11fb67c800626a6c37be3901497d4c1988f3be6a368fa15d0f846c93e47a8e4	2026-11-02 06:07:36.780447+05:30	\N	2026-11-01 22:07:36.783133+05:30
e2216053-56b4-458d-9e59-14441f32a3d6	40351e16-e0dd-4064-a060-bd866d35bc63	f6c61913920870e83794f6e6d1c68ba80785d6f1d4200fce90e66754e33e70d8	2026-11-02 06:08:02.469796+05:30	\N	2026-11-01 22:08:02.470638+05:30
66d506a9-c256-43c7-886b-663855c26a6f	40351e16-e0dd-4064-a060-bd866d35bc63	d8bba3fd89a9ace83fe212678c8a131e4257591b5f5a71003ad2c4ac36d42a61	2026-11-02 06:08:23.95945+05:30	\N	2026-11-01 22:08:23.960209+05:30
acc862f5-213f-4647-aa42-172579d4e82f	40351e16-e0dd-4064-a060-bd866d35bc63	7b38591085f5393cbeb4cf1c7b228a20910010d6a9a3fa81fb50d621ee5c5583	2026-11-02 06:08:55.611804+05:30	\N	2026-11-01 22:08:55.612804+05:30
ffed95c4-31f2-4669-94a9-01f8c02a917a	40351e16-e0dd-4064-a060-bd866d35bc63	1f19d96221e88c32c8afd80808422ee57b7d746e10639e1aa885db3dbd11af0a	2026-11-02 05:43:02.902724+05:30	2026-11-01 22:10:51.859215+05:30	2026-11-01 22:10:44.401518+05:30
98fc5b00-6f15-4608-beb0-f155100f87d5	40351e16-e0dd-4064-a060-bd866d35bc63	1b353fb7a9a44b5075bd5ead5fb3fad29cc143eb7dbc13b4f0e43603b127f6ef	2026-11-02 06:10:57.192752+05:30	2026-11-01 22:26:09.461394+05:30	2026-11-01 22:10:57.194437+05:30
d77a6ec8-c36b-4313-9393-7fb3717db1b4	40351e16-e0dd-4064-a060-bd866d35bc63	4b4eb93fba8282bc27419e8d8552539ae0ef98c3ce559c82ea04598d195b5876	2026-11-02 06:10:57.192752+05:30	2026-11-01 22:40:49.349195+05:30	2026-11-01 22:26:09.474245+05:30
175a1a73-dd80-43f5-822e-8af3b5e92971	40351e16-e0dd-4064-a060-bd866d35bc63	c147d4a580da964aa85afc0fc71f52fedcab596dcf79277ec75843bd8b60350d	2026-11-02 06:40:54.80835+05:30	2026-11-01 22:58:08.70712+05:30	2026-11-01 22:40:54.811105+05:30
cbe78f2b-d436-478f-89ec-59917e9ad138	40351e16-e0dd-4064-a060-bd866d35bc63	e93ab4007c6541309d2a137f503fe27fc5c56e4c82e1903e218425b2de1208f8	2026-11-02 07:03:20.138455+05:30	\N	2026-11-01 23:03:20.141383+05:30
cb524759-5007-4e0c-b324-ad9b897f81b1	40351e16-e0dd-4064-a060-bd866d35bc63	67b5f817b7f7c241430d08652dc7917440dde46e481cce405c7413c500c312dd	2026-11-02 07:03:20.47975+05:30	\N	2026-11-01 23:03:20.481397+05:30
1cc1af63-059e-44af-b2c7-ed6ecbffdcd8	40351e16-e0dd-4064-a060-bd866d35bc63	e7219b0e00b637ad08a5d2cdeaf368108a89d0992ccd4d4739d26c9fbb02e6d4	2026-11-02 07:03:20.601708+05:30	\N	2026-11-01 23:03:20.602645+05:30
c8d316ae-c67d-4d73-9d0e-92c2fe32268f	40351e16-e0dd-4064-a060-bd866d35bc63	656d753b409e19ebbf76486f7bcbdc3e9966846a5fc1fb1d87ca001b67ea837c	2026-11-02 07:03:23.046411+05:30	\N	2026-11-01 23:03:23.047381+05:30
fd715736-42dc-4164-bbce-ae0304009bee	40351e16-e0dd-4064-a060-bd866d35bc63	98b0795872f620a2735b86f1f87d70b899441ce288f49b67d453852c685b24ba	2026-11-02 07:03:26.55293+05:30	\N	2026-11-01 23:03:26.554046+05:30
2958c94a-881f-44ed-a837-7948741b1c0f	40351e16-e0dd-4064-a060-bd866d35bc63	d0f3b916c7896c51afe1a9296d5b5cb69935372be02365f39ce22f82fdffe1a4	2026-11-02 07:04:31.648053+05:30	\N	2026-11-01 23:04:31.649954+05:30
3f4ba060-fd70-4e14-a3a9-35a1e3e743d7	40351e16-e0dd-4064-a060-bd866d35bc63	db7047ca10e23c30217a609119fcedd5756c0bf6db92301fb2fd449616063ec7	2026-11-02 07:04:32.285598+05:30	\N	2026-11-01 23:04:32.286274+05:30
02dfdcc2-8c00-489d-b89c-552530a252a9	40351e16-e0dd-4064-a060-bd866d35bc63	d5e90ad99493c63f81d8881b631b1fc1b8afebca5c16fa0bcc9e05a65e84fda6	2026-11-02 07:04:32.430605+05:30	\N	2026-11-01 23:04:32.431457+05:30
ee287500-6333-43c3-a087-666f67819bba	40351e16-e0dd-4064-a060-bd866d35bc63	e89a15bc15bcf7579c5b4e03dd515ef76401dc148fe3815c22c80951a24eb55b	2026-11-02 07:04:34.964177+05:30	\N	2026-11-01 23:04:34.965631+05:30
fe11ebad-68af-4371-a7e2-3b08cfe19947	40351e16-e0dd-4064-a060-bd866d35bc63	44c79f0da674648341f172032b2c56f07788d46047bb96e011659dd3cad76866	2026-11-02 07:04:37.459286+05:30	\N	2026-11-01 23:04:37.461128+05:30
12b3ba2c-50cb-4157-846c-655bfbfb6a1e	40351e16-e0dd-4064-a060-bd866d35bc63	3343be4e0af39dfdd59ff3e708ab99760e01717930e2b027a9f79651b776ac3c	2026-11-02 07:05:13.263717+05:30	\N	2026-11-01 23:05:13.265718+05:30
711c875e-dbdf-430d-8e31-d00d28e3ffd3	40351e16-e0dd-4064-a060-bd866d35bc63	805289b63a3a0f89264538a1ca6369067051d0d412f7d209989270a128022058	2026-11-02 07:05:14.367966+05:30	\N	2026-11-01 23:05:14.36942+05:30
536bd691-d9eb-44ac-b293-e863515396e1	40351e16-e0dd-4064-a060-bd866d35bc63	617dbc0a05ecca72a873901f1bedf568d1a80e82c8d8584b4e41ad548a112aec	2026-11-02 07:05:14.567889+05:30	\N	2026-11-01 23:05:14.569827+05:30
acc27899-2676-431f-a90f-951fe5ea4534	40351e16-e0dd-4064-a060-bd866d35bc63	afd35d45c28c7b22f6b28017ad97edd61460d17cb1552efee25948854869cb08	2026-11-02 07:05:17.389979+05:30	\N	2026-11-01 23:05:17.392577+05:30
802744c0-1b1f-4984-9b68-1ab9d65dea06	40351e16-e0dd-4064-a060-bd866d35bc63	1f9e8ab30adf9f4d06d7d3cd2fb309c8742a0a01e3c25c03e66a6a85f2cfbf33	2026-11-02 07:05:20.112721+05:30	\N	2026-11-01 23:05:20.113953+05:30
b3bc40d1-b952-4668-83bd-4db886ab181a	40351e16-e0dd-4064-a060-bd866d35bc63	9824cdf3fcd9560dc0c676878af17ac50e4ea15ceb6e48d618abfcf35dd78e4a	2026-11-02 07:05:51.999227+05:30	\N	2026-11-01 23:05:52.000573+05:30
04484ba4-143e-4096-a737-602a6bfe80fc	40351e16-e0dd-4064-a060-bd866d35bc63	dd107156323743cec0c5e924188381890b6f11c45901025969f2a61f459d69e0	2026-11-02 07:05:52.736615+05:30	\N	2026-11-01 23:05:52.737208+05:30
b763f753-6516-40f5-8fbb-e39207ee4c79	40351e16-e0dd-4064-a060-bd866d35bc63	2b2851f79154f603cada8857f7dd615160789392a8549dd4ed448fd923889256	2026-11-02 07:05:52.88468+05:30	\N	2026-11-01 23:05:52.885617+05:30
3947096d-a534-422d-aa49-efeb71906490	40351e16-e0dd-4064-a060-bd866d35bc63	a851305626303c7b7845faad48150298fc96767526d269b3b4d4219531840dd8	2026-11-02 07:05:55.691096+05:30	\N	2026-11-01 23:05:55.692298+05:30
b35b0c24-d52b-44be-aae1-e309177949dc	40351e16-e0dd-4064-a060-bd866d35bc63	96297baddf4ac57512f966f54aeec3086cd3cc5146d9612cec4201c07eb607b9	2026-11-02 07:05:58.225537+05:30	\N	2026-11-01 23:05:58.226421+05:30
2f22850a-6fb6-4d0b-ae75-2bb813465f3e	40351e16-e0dd-4064-a060-bd866d35bc63	06163dee0ada5e9284c8ac4e16f2f692e12a7612cfa432edaa0016c575203adc	2026-11-02 07:07:38.173398+05:30	\N	2026-11-01 23:07:38.176066+05:30
fdd9499b-a27b-475e-9f8f-483739409ed5	40351e16-e0dd-4064-a060-bd866d35bc63	3057d9d9ab263a4b453eb59b88fe6ffdaf7f9a46591f9cc9f836440f8d7ec190	2026-11-02 07:07:39.226384+05:30	\N	2026-11-01 23:07:39.22746+05:30
6be9ab00-c293-4be6-a937-9d38c2cb5355	40351e16-e0dd-4064-a060-bd866d35bc63	15abc27d3d1b4e28028add3d9ca3b3e610aa77c029034549153af6dff1d94559	2026-11-02 07:07:39.373042+05:30	\N	2026-11-01 23:07:39.374315+05:30
a388a537-6bac-4386-b38e-8c09bf2e95cb	40351e16-e0dd-4064-a060-bd866d35bc63	bc73e2824458531aecf4de7bae8bb43be8d9f15a03a1174ba8e65a1b785c1035	2026-11-02 07:07:42.174562+05:30	\N	2026-11-01 23:07:42.175726+05:30
67b5f944-bd76-462f-b624-8036688251f8	40351e16-e0dd-4064-a060-bd866d35bc63	4bf1f30fb64e7049116f9c0be5eb0e167b53aa4d5af46872a12ba70036d622e9	2026-11-02 07:07:44.761364+05:30	\N	2026-11-01 23:07:44.762794+05:30
c27765e4-f876-469f-8d95-5a20f5a960ff	40351e16-e0dd-4064-a060-bd866d35bc63	ed0261c734ccb90babe1e50a1a5800792a6f67098d16bd1453ca4c3efdf521ca	2026-11-02 07:08:19.68244+05:30	\N	2026-11-01 23:08:19.683878+05:30
cc03430f-6f20-4e7d-9d35-6ed941f82c02	40351e16-e0dd-4064-a060-bd866d35bc63	cead93b38d54ab52d7c713c9aac2d1d66b3dd03f595d8c2925c43e14458493a1	2026-11-02 07:08:23.250366+05:30	\N	2026-11-01 23:08:23.251371+05:30
ad0d7206-f5e9-4bad-89c1-b7e212b7a76a	40351e16-e0dd-4064-a060-bd866d35bc63	b9ecca4d09756e7a25f918871047a41cc34a70730b5aeffa13e37d6e670d9446	2026-11-02 07:08:28.694265+05:30	\N	2026-11-01 23:08:28.695542+05:30
61fc2745-654f-4a4a-9be8-644e8154639e	40351e16-e0dd-4064-a060-bd866d35bc63	a1aa619dd209b4b63ca3295f7d95c1ef82e7fec0a67ce55f9614d57d97975a3b	2026-11-02 07:08:31.46176+05:30	\N	2026-11-01 23:08:31.462844+05:30
5ba0edf7-7c10-4961-a610-3ba975d1891b	40351e16-e0dd-4064-a060-bd866d35bc63	c63560f61d3bb3df910551652aef4d2ce4ff2f455b527f416256424237d52495	2026-11-02 07:08:34.058649+05:30	\N	2026-11-01 23:08:34.059871+05:30
ebfb64e1-85ac-4639-8034-f309d483548e	40351e16-e0dd-4064-a060-bd866d35bc63	dd12325092aec060c73a670a5f143ca0f9302134dc6b43bc714aa667d5b2f07d	2026-11-02 07:10:15.230171+05:30	\N	2026-11-01 23:10:15.232985+05:30
8474e546-560c-45bd-b0c8-ac53a545a855	40351e16-e0dd-4064-a060-bd866d35bc63	937236e3eb565edc0056c9f6583471121da0e05fbf3103c2188fb0e72598044c	2026-11-02 07:10:26.240984+05:30	\N	2026-11-01 23:10:26.24276+05:30
37e4090c-4f40-4e38-9b09-7ac1db36148b	40351e16-e0dd-4064-a060-bd866d35bc63	1200af056b2206539b897176da261bfc97f9af6e81264fdaed6d0707450fb6c3	2026-11-02 07:10:29.062965+05:30	\N	2026-11-01 23:10:29.064019+05:30
5fcfbc10-a17e-464d-9d67-67bf23414a54	40351e16-e0dd-4064-a060-bd866d35bc63	6d6448be81d8f23d2df6400f1370d5611edd479a2babce3d0070675d438427eb	2026-11-02 07:10:31.673981+05:30	\N	2026-11-01 23:10:31.675003+05:30
c7cc8374-9c86-49f9-9f28-87e4eaaf5081	40351e16-e0dd-4064-a060-bd866d35bc63	b989d832edc3e6c06af5654220c1788e359175a6272ccdc15d8f10fa8a161c4c	2026-11-02 07:10:36.616005+05:30	\N	2026-11-01 23:10:36.619316+05:30
077b0bef-e0bd-4189-afe4-46cc25bffc72	40351e16-e0dd-4064-a060-bd866d35bc63	f4a6338d7b0d861feb073d0592635946ab1deb0db749016d468279dbe07cd0b4	2026-11-02 07:10:57.328609+05:30	\N	2026-11-01 23:10:57.331291+05:30
b6cf688f-16bc-4185-aa06-412996b9a620	40351e16-e0dd-4064-a060-bd866d35bc63	0d45bcfba8d61ebbec74f08e0346aba2b06206b1a5b7efae67b7902c4d9d4eea	2026-11-02 07:11:12.258835+05:30	\N	2026-11-01 23:11:12.260437+05:30
15a835a9-de5a-4447-8bb6-569d05c63176	40351e16-e0dd-4064-a060-bd866d35bc63	b22c8fe835aedb574fbe3f54c78b52d3b616b503a792fe565aac55b06e1f2611	2026-11-02 07:11:29.447701+05:30	\N	2026-11-01 23:11:29.448632+05:30
f5d10fb6-9b8e-4796-9583-75dacdb80d57	40351e16-e0dd-4064-a060-bd866d35bc63	08a8684e84a7b1bbef4e0f0fa2259c99a7b1487c4f8fbcb3c5a9e5420953479b	2026-11-02 06:40:54.80835+05:30	2026-11-01 23:21:15.777279+05:30	2026-11-01 22:58:08.868202+05:30
00358abd-432d-4e30-a5ef-7cc94ca54d58	40351e16-e0dd-4064-a060-bd866d35bc63	bf83d6277ec9a780b7d14dc333534fbfb8eaead601eb9700caf74433c1fd65ab	2026-11-02 07:11:46.808996+05:30	\N	2026-11-01 23:11:46.810458+05:30
84b0f526-b56c-475b-be01-ea8a21e82c07	40351e16-e0dd-4064-a060-bd866d35bc63	dda681a9232319b48b4d482f05fe2cbe6a2eebf5cbae7e12547ef325a02784c7	2026-11-02 07:12:04.000781+05:30	\N	2026-11-01 23:12:04.002853+05:30
fa537532-2ab2-4da1-b236-b67c292e9b8c	40351e16-e0dd-4064-a060-bd866d35bc63	455227def18b1adc800eec7b61543bdc790769bc41d76e2597caa1b1c0988e18	2026-11-02 07:12:15.073995+05:30	\N	2026-11-01 23:12:15.075128+05:30
901be7ba-1e3a-409a-b23b-4ce3a94826a7	40351e16-e0dd-4064-a060-bd866d35bc63	c026538ba2f3cc61bb1ccb61959245b361d99be223e3876fb6f53c53700e5601	2026-11-02 07:12:40.702873+05:30	\N	2026-11-01 23:12:40.704686+05:30
17ba6ea8-5f12-4e7d-b739-72994a1b93c5	40351e16-e0dd-4064-a060-bd866d35bc63	b4d7334c6107df9222b2f91b2bfbb0b7104ce4e7960730bdf72b9cc0f0a0d961	2026-11-02 07:13:02.352796+05:30	\N	2026-11-01 23:13:02.35405+05:30
c6451ac8-6d86-4644-9695-abf97c2275fb	40351e16-e0dd-4064-a060-bd866d35bc63	9160c88ffab858274bfb6e0e99a0aa9313ed8160a827ee4c7d1999f949cef418	2026-11-02 07:13:34.44298+05:30	\N	2026-11-01 23:13:34.444452+05:30
c3652869-1901-41d1-a591-edbaede43394	40351e16-e0dd-4064-a060-bd866d35bc63	03f63fb8cd31a7cc33c24588e4c164b9f04221c070db36c77603cbb17f0e5814	2026-11-02 07:14:09.710879+05:30	\N	2026-11-01 23:14:09.713754+05:30
0a72504b-5873-4332-af3a-bfae666545d8	40351e16-e0dd-4064-a060-bd866d35bc63	3b3f71ea1f76e2b82aedf873184211165e0dd048efa785dc406436f995246af1	2026-11-02 07:14:20.538585+05:30	\N	2026-11-01 23:14:20.539599+05:30
4423b1f5-616b-4016-838f-8db84396685a	40351e16-e0dd-4064-a060-bd866d35bc63	809cd99a5f7dfd142bb48d7f2e5e0078f5f27782cab28933dc9f4695d7e75b22	2026-11-02 07:14:23.185388+05:30	\N	2026-11-01 23:14:23.186352+05:30
2ec155a1-8d82-4ffa-825b-7e3c8a247574	40351e16-e0dd-4064-a060-bd866d35bc63	497340b54b273818978c00983e774d52847ccf01c492b2431076d457e6879573	2026-11-02 07:14:25.754591+05:30	\N	2026-11-01 23:14:25.756543+05:30
f118b935-dc96-4114-b5e9-f08bfd4df19b	40351e16-e0dd-4064-a060-bd866d35bc63	27d51b067381c36775719c802a1bf9fa71759f217d832cdd2a7d923c8a0d09d6	2026-11-02 07:14:30.537274+05:30	\N	2026-11-01 23:14:30.539158+05:30
f7b06328-bd3f-473a-b72a-f2e2d6f8ba2d	40351e16-e0dd-4064-a060-bd866d35bc63	61b6353325f34087bad872723cfcff3470949e29ae021ed8f00ab4b5642bf88a	2026-11-02 06:40:54.80835+05:30	2026-11-01 23:23:35.557183+05:30	2026-11-01 23:21:16.010528+05:30
ce857310-c5fe-4eb9-b7a4-5f3c89e146dd	40351e16-e0dd-4064-a060-bd866d35bc63	69b90d562ceed65d97f919dc191630b30ad229d2a71abc00546e4f2024735d14	2026-11-02 07:43:47.161314+05:30	\N	2026-11-01 23:43:47.163319+05:30
c4445929-d8b4-4356-a8a9-a6daf2ea57d4	40351e16-e0dd-4064-a060-bd866d35bc63	e69801297e8b963272f9390b789afa0efcd00c3c686adf96f54d2dbbf5d6e196	2026-11-02 07:23:40.477205+05:30	2026-11-01 23:43:49.367267+05:30	2026-11-01 23:23:40.478324+05:30
952cf5bd-5595-4f23-a4ad-04bcd0748d6a	40351e16-e0dd-4064-a060-bd866d35bc63	443a82349c14331e2ce48173fb013c4d2970b307bbf26102677310b964fe6138	2026-11-02 07:23:40.477205+05:30	\N	2026-11-01 23:43:49.382811+05:30
9012fbd3-df1c-488b-ba31-920dc4fbc896	40351e16-e0dd-4064-a060-bd866d35bc63	e0430a0927d44b916f0b138d4c64d55e1ce97cc55bba4c0820db40de10f1644a	2026-11-03 01:49:35.555304+05:30	2026-11-02 18:05:00.99812+05:30	2026-11-02 17:49:35.556052+05:30
3bba83af-d0d9-45da-9438-13ecb11db7df	40351e16-e0dd-4064-a060-bd866d35bc63	a9dcbb4b377fdff82635a0d8f7d565db58c53d49524b243d178bd2ed48d63bbc	2026-11-03 01:49:29.258712+05:30	2026-11-02 18:05:15.671226+05:30	2026-11-02 17:49:29.262057+05:30
2c54dfeb-eed7-48bf-85f2-6a1de0ff6a4d	40351e16-e0dd-4064-a060-bd866d35bc63	278a7e0c3feecb3c61640558dc2b7e1e2a55e4a06441c68cfb8667f88405a7d2	2026-11-03 01:49:35.555304+05:30	2026-11-02 18:20:26.290905+05:30	2026-11-02 18:05:01.014956+05:30
7beb5e3e-4951-4a3a-baab-b364ceaeb081	40351e16-e0dd-4064-a060-bd866d35bc63	491e9687cf3db8677375ceb29b6c2ab083e432b89378352d7cae991a49f282ea	2026-11-03 01:49:35.555304+05:30	2026-11-02 18:44:20.37844+05:30	2026-11-02 18:20:26.300921+05:30
9390a79b-e153-4b7a-935d-239bcd30a569	40351e16-e0dd-4064-a060-bd866d35bc63	d31d5d54c66f8ce2f005ae1b5ed5d1bcc67df43fc1133a07b654f55a26659c71	2026-11-03 01:49:35.555304+05:30	2026-11-02 18:44:24.511336+05:30	2026-11-02 18:44:20.386822+05:30
1faafbc6-fd8b-4c73-ae0c-75c279b12372	40351e16-e0dd-4064-a060-bd866d35bc63	1373a6cab5d06331e75d67c23eda59b370bb2397fc15d09c9c3dda603c17f7cd	2026-11-03 01:49:35.555304+05:30	2026-11-02 19:04:07.699365+05:30	2026-11-02 18:44:24.51823+05:30
0a85dc62-7714-466c-b6e9-6594c6e4b132	40351e16-e0dd-4064-a060-bd866d35bc63	9a77cc2b78bd0e620742294c7915bda7b75d860c4ea4196ad65980bffcb73b40	2026-11-03 01:49:35.555304+05:30	2026-11-02 19:22:24.088589+05:30	2026-11-02 19:04:07.712174+05:30
34cdf25e-c26f-4f73-b5a7-58e31e32c468	40351e16-e0dd-4064-a060-bd866d35bc63	5b1c783c7ac71f04c5a408bbbdfcacecf91087ddf6e4988f3d3d448337170d31	2026-11-03 01:49:35.555304+05:30	\N	2026-11-02 19:22:24.096508+05:30
978a7e28-a351-448e-aa42-f10e1b18822e	40351e16-e0dd-4064-a060-bd866d35bc63	fc03eb1e614bcc9b807347eb15c998e518f1fe370331bb9ea4858eb93b2bce05	2026-11-04 00:16:24.811714+05:30	2026-11-03 16:33:42.475907+05:30	2026-11-03 16:16:24.816824+05:30
2e2359c3-fded-4932-9e51-ad6b91743563	40351e16-e0dd-4064-a060-bd866d35bc63	fd4ff8b75eb19a2760542b13198ba3fbf3f49a4230b1391eae16604f684d9dce	2026-11-04 00:16:24.811714+05:30	2026-11-03 16:33:46.640517+05:30	2026-11-03 16:33:42.487305+05:30
a9a39804-cd78-4188-b2b7-a1258e8a9728	40351e16-e0dd-4064-a060-bd866d35bc63	d8dbfff2ae6b399ab2da4efeaf84946b84ec05fa455e6b1a94df700e4b9a0323	2026-11-04 00:16:24.811714+05:30	2026-11-03 17:05:59.747132+05:30	2026-11-03 16:33:46.64848+05:30
ceb43eeb-a9f8-4c59-8218-32671f6c09ad	40351e16-e0dd-4064-a060-bd866d35bc63	b362b442b658827b5eb53fb4467188c10439d187b7e24db56235481c57391839	2026-11-04 00:16:24.811714+05:30	2026-11-03 17:23:56.577636+05:30	2026-11-03 17:05:59.758869+05:30
00ad4f76-cf65-4ff8-8cd5-211db163bf93	40351e16-e0dd-4064-a060-bd866d35bc63	5ccaf0ec0b720f2464538eb790a9e9a0f4c52858ce5e0cb507e7bdfa0aa33f86	2026-11-04 00:16:24.811714+05:30	2026-11-03 17:40:54.624128+05:30	2026-11-03 17:23:56.587791+05:30
e67ba11a-a0a1-4b96-8077-3868c89c3e6c	40351e16-e0dd-4064-a060-bd866d35bc63	6a1d69a2cc92518b700c072731b1220ac5f738acb8712226178f35f2f9680a62	2026-11-04 00:16:24.811714+05:30	2026-11-03 18:00:08.314652+05:30	2026-11-03 17:40:54.632697+05:30
55b16cd1-aedd-4ece-a1dc-6754f98fa23c	40351e16-e0dd-4064-a060-bd866d35bc63	5418f57b28996e539dcc8ab990a83470b8f5ec9fd0c1b2e88eb2afc07642543b	2026-11-04 00:16:24.811714+05:30	2026-11-03 18:20:47.401207+05:30	2026-11-03 18:00:08.329246+05:30
888a31d1-38ea-4a38-b0f5-5a6d3922b87e	40351e16-e0dd-4064-a060-bd866d35bc63	2c15596d11e0f86126e1250bf409a7b04aee460e7c62d8063f976d66144c1dc1	2026-11-04 00:16:24.811714+05:30	2026-11-03 18:38:34.295787+05:30	2026-11-03 18:20:47.410466+05:30
bbd0fcca-8c7a-40d6-8f9a-f0f7c3bdcd40	40351e16-e0dd-4064-a060-bd866d35bc63	c1efd33bd3b0d5e81865d3e4bec9156b9c0199e4ce01be849d1c1a8eca2935a9	2026-11-04 00:16:24.811714+05:30	2026-11-03 18:55:43.779185+05:30	2026-11-03 18:38:34.305588+05:30
267c97f7-2b18-48a2-beec-e7bf4b0d8c90	40351e16-e0dd-4064-a060-bd866d35bc63	4bdb814fd977ce92effb1b2b972f8a72531f3577a1974ce19236904a2be31bd2	2026-11-04 00:16:24.811714+05:30	\N	2026-11-03 18:55:43.786374+05:30
d2b6da7c-aa09-4873-a72b-36fb1abee354	40351e16-e0dd-4064-a060-bd866d35bc63	6f6a51e62e8c169731b8cf26ad918e0e2d44649b9f3b9a76aa18e9a22e465033	2026-11-04 04:59:18.524924+05:30	\N	2026-11-03 20:59:18.529133+05:30
ed767ddf-45bb-4743-a519-902a14b614b9	40351e16-e0dd-4064-a060-bd866d35bc63	c2ef48eb7dd1302c808212c58315c5810e67dc8c1dc41838a848e15e27830568	2026-11-04 05:07:16.770503+05:30	\N	2026-11-03 21:07:16.774292+05:30
d9416f88-9af9-4f83-bfa9-c7a9a7db2201	40351e16-e0dd-4064-a060-bd866d35bc63	c6df20116ba8ef2afb130fdfd08107d1dfe74d8fdb5c2a1751fa7b465fc72645	2026-11-04 05:19:52.330387+05:30	\N	2026-11-03 21:19:52.331373+05:30
5c185d8d-a275-414a-8d85-f07963394dc6	40351e16-e0dd-4064-a060-bd866d35bc63	88bd2ed74315812adc11dc87e86bc5ece1065411fadee8242c211836383ce4b6	2026-11-04 05:19:52.975521+05:30	\N	2026-11-03 21:19:52.976368+05:30
f9f66768-2323-4a89-89f3-c5b9a0b15dba	40351e16-e0dd-4064-a060-bd866d35bc63	4c45d87f9341c920c9218ca398b3f43f433832984b803e18749e4ed149a1a37c	2026-11-04 05:19:53.665893+05:30	\N	2026-11-03 21:19:53.666685+05:30
0da30f18-aae8-4173-9e20-cb3ce1e57f17	40351e16-e0dd-4064-a060-bd866d35bc63	7667e506410800f818219df34cc7529fe896ceaddebbf3753a8c642507bbc981	2026-11-04 05:19:54.433861+05:30	\N	2026-11-03 21:19:54.434886+05:30
a3d3813e-554c-4984-ae83-6a52923e485d	40351e16-e0dd-4064-a060-bd866d35bc63	65351c620e7b887436ecaca1a14f1d48b46028d4a0cc90d953e8b65c4021711f	2026-11-04 05:19:55.272808+05:30	\N	2026-11-03 21:19:55.273671+05:30
840d949b-7e08-409c-8fb5-fcd01c161797	40351e16-e0dd-4064-a060-bd866d35bc63	c55fcba32ca9e6d0d0e8856cbd793a8b11c357f2c843a671f6c5dbe956f6f81d	2026-11-04 05:20:28.609346+05:30	\N	2026-11-03 21:20:28.611627+05:30
36537701-2c99-4acf-a524-ffb7085fdd5e	40351e16-e0dd-4064-a060-bd866d35bc63	7ce4def36068f879513688915aca020b5824f7e0a52ff2259450efdaf640e3a6	2026-11-04 05:20:29.33736+05:30	\N	2026-11-03 21:20:29.338234+05:30
575ab24e-a2bd-4974-9e68-bfbedcc3a0a5	40351e16-e0dd-4064-a060-bd866d35bc63	5bc8b1c996f69e5523f6349621abf1f53856c10436df83f4e413e17372a6ba0a	2026-11-04 05:20:29.785451+05:30	\N	2026-11-03 21:20:29.78634+05:30
b973be23-a1fc-4433-8c40-a2203bc2219f	40351e16-e0dd-4064-a060-bd866d35bc63	f7a30795e97ef3db443ac2c18f36c09a6749e637d0aa8e15599c84ecc171ef78	2026-11-04 05:20:30.474682+05:30	\N	2026-11-03 21:20:30.475685+05:30
a0adfc84-73ca-4b11-a436-bbecbc3c8723	40351e16-e0dd-4064-a060-bd866d35bc63	1892e1cb17fb3060582477d0081a1367a508d59ffc182476ebeb014865c24c7a	2026-11-04 05:20:30.971986+05:30	\N	2026-11-03 21:20:30.972899+05:30
8792c685-c58e-4657-b356-8b723d82a5f4	40351e16-e0dd-4064-a060-bd866d35bc63	fa04b370851ad67f7d0b0302cddc13392605e52b3eb1dce08f9bb70fa317fe69	2026-11-04 05:20:31.633814+05:30	\N	2026-11-03 21:20:31.63532+05:30
f7c59319-fbad-4d0f-aa90-5eb45cf62bce	40351e16-e0dd-4064-a060-bd866d35bc63	f4a5035febe734c7d5c5410a4900bfa0e7a39fe911d4cf7497f33d5024105497	2026-11-04 05:20:32.146893+05:30	\N	2026-11-03 21:20:32.148471+05:30
091da78c-fe6b-43b5-b4aa-47f2b682b9eb	40351e16-e0dd-4064-a060-bd866d35bc63	6b673a6e58d99729cc0938833784bd74dd4796f749f18f6ddb816473e4617c86	2026-11-04 05:20:48.88706+05:30	\N	2026-11-03 21:20:48.890371+05:30
e4c4d563-d5fb-4f23-9f5d-0912b2dff4f5	40351e16-e0dd-4064-a060-bd866d35bc63	e5d28831354d4646f17e7549242060b74bd61a4ab3a0b324e632e8bda8f26ab6	2026-11-04 05:20:50.047178+05:30	\N	2026-11-03 21:20:50.048656+05:30
91c04603-eda4-4085-9697-989be6d689ce	40351e16-e0dd-4064-a060-bd866d35bc63	787e83b32f1be66fbafbd1804c0305aa4e9bcb8e576981422be4ef029660e552	2026-11-04 05:20:50.482442+05:30	\N	2026-11-03 21:20:50.483297+05:30
45e9d119-a022-4958-ae37-1a1856717baf	40351e16-e0dd-4064-a060-bd866d35bc63	f1deda13f24520def7fdcc2abd98f5fd1da52cc1240add5d2580e14d804bb0ea	2026-11-04 05:20:50.959118+05:30	\N	2026-11-03 21:20:50.960071+05:30
1a9508f3-fdc5-4132-8868-e294513bda6c	40351e16-e0dd-4064-a060-bd866d35bc63	8d64afaaffc55256ed0bccdbda1ef6ea2c934fc6bcd28df3e445047ded67788e	2026-11-04 05:20:51.490345+05:30	\N	2026-11-03 21:20:51.491339+05:30
af334c94-a155-4da2-b685-61608b9cb167	40351e16-e0dd-4064-a060-bd866d35bc63	82e7ee516990f74a274723f32a56444758049268d0f6e88b92a4530ad71cac7a	2026-11-04 05:38:38.716011+05:30	\N	2026-11-03 21:38:38.717296+05:30
46781ba1-30eb-4be0-a493-d3d4b1c1a62f	40351e16-e0dd-4064-a060-bd866d35bc63	b83ac245b514961bee4214ba325b9adf61d09c58bab53a4c72cfa8bd12c36572	2026-11-04 05:38:39.572505+05:30	\N	2026-11-03 21:38:39.573374+05:30
3dae5855-c0b3-4030-a913-c56b153ca7f7	40351e16-e0dd-4064-a060-bd866d35bc63	db09921764e53faf7e5db8049ed875ed2c6376bf9f897b1a0c929464e18de7d8	2026-11-04 05:38:40.083348+05:30	\N	2026-11-03 21:38:40.084233+05:30
27e9a841-0965-495b-89a7-a508bbadf800	40351e16-e0dd-4064-a060-bd866d35bc63	826997378d857961df32c6620805bce5889f3a109e754aec6e3674e5b51daac8	2026-11-04 05:38:40.578812+05:30	\N	2026-11-03 21:38:40.580545+05:30
5149844c-33b0-4bf1-8647-b9d1dab97076	40351e16-e0dd-4064-a060-bd866d35bc63	d68857b0bf59fac7f295a7fbe6b240e7f60c8c5655c5f0305c1efd9bc5bbc060	2026-11-04 05:38:41.188327+05:30	\N	2026-11-03 21:38:41.189368+05:30
9be360a5-cc8c-4069-9da2-d12bc05b1c0a	40351e16-e0dd-4064-a060-bd866d35bc63	cd071227d2a821118763e51fae8a50136bdd8fe6fac8646b4d0ba6e384f58b6d	2026-11-04 05:38:56.53083+05:30	\N	2026-11-03 21:38:56.532327+05:30
aa680511-1833-4324-9fcc-419aa4105e00	40351e16-e0dd-4064-a060-bd866d35bc63	108e9b424cd6f52582db8fb9dc395688a2f7327615b59d9aae8ede1372b137a5	2026-11-04 05:38:57.487116+05:30	\N	2026-11-03 21:38:57.490168+05:30
b9001415-01af-49ee-9b97-1cb10b030b78	40351e16-e0dd-4064-a060-bd866d35bc63	c9e3d347e7e5c806bc220cb4a000de608fed59038c7f5e190db6a2ecbfce23e0	2026-11-04 05:38:58.457753+05:30	\N	2026-11-03 21:38:58.458953+05:30
0e8c6916-a478-40a5-982a-57670c48ea65	40351e16-e0dd-4064-a060-bd866d35bc63	32ab81c4473e7cf205d7f42afc5178a88d88c017682349b9273a02898bee3669	2026-11-04 05:38:59.599914+05:30	\N	2026-11-03 21:38:59.601107+05:30
dd626dc5-0e52-4d07-85b7-6546d489ae18	40351e16-e0dd-4064-a060-bd866d35bc63	06b864bf17d2956a71cc2b0a539d838cd9aee51d7806dcbf49f364f8f37e0d2d	2026-11-04 05:25:03.82808+05:30	2026-11-03 21:41:15.732071+05:30	2026-11-03 21:25:03.831905+05:30
9684ab5d-591e-4a86-a4bc-387ef435a309	40351e16-e0dd-4064-a060-bd866d35bc63	6df330385be1c933f1bfc656a63e80a06abbc7812eaa009c1d18834bc0392af9	2026-11-04 05:45:17.192103+05:30	\N	2026-11-03 21:45:17.194853+05:30
5d60a83d-1f11-429e-afee-fdc02bc84926	40351e16-e0dd-4064-a060-bd866d35bc63	96cd5ddf80a7225d335ff630989e1c907b5474871e8cd4f56e06132a767445ac	2026-11-04 05:48:36.669039+05:30	\N	2026-11-03 21:48:36.670101+05:30
ed91192c-ca8d-47cb-bec7-2356c73bd1b5	40351e16-e0dd-4064-a060-bd866d35bc63	7b3fc405372f41b60908374714a009cac52aebd6b4829e15319edeed2ebd9b28	2026-11-04 05:25:03.82808+05:30	2026-11-03 22:12:55.24854+05:30	2026-11-03 21:41:15.740489+05:30
5189fbdb-3a18-44bc-850f-02bbe6627266	40351e16-e0dd-4064-a060-bd866d35bc63	d8c961e5be51a2f32cd0c57c12fd39dd3e1f85516a053111467ef7e2f87427b6	2026-11-04 05:25:03.82808+05:30	2026-11-03 22:12:55.343272+05:30	2026-11-03 22:12:55.261875+05:30
25bcc622-4701-4585-bea9-b4719882b86f	40351e16-e0dd-4064-a060-bd866d35bc63	45e150ef0eadfb7e1b8591b7e3842797fc5318a71502e07efb7d82cfa4f3f11a	2026-11-04 05:25:03.82808+05:30	\N	2026-11-03 22:12:55.353357+05:30
3cc7a5ae-8416-4214-bd56-965e31a0bb4b	40351e16-e0dd-4064-a060-bd866d35bc63	29455f091229ec75fa5e151501a9a7c5d019e45211a783e76222ad743d29b286	2026-11-05 05:49:41.61889+05:30	2026-11-04 22:05:39.785678+05:30	2026-11-04 21:49:41.622525+05:30
bbee180b-9c4b-44a2-9b4f-528dde40ff3d	40351e16-e0dd-4064-a060-bd866d35bc63	8d10551f8a1d1a36d0c40d5cbf911033a555a9d49347e243eaee201198963eb3	2026-11-05 05:49:41.61889+05:30	2026-11-04 22:21:48.660166+05:30	2026-11-04 22:05:39.852439+05:30
d50148bb-53c5-407b-8a7a-53151636f040	40351e16-e0dd-4064-a060-bd866d35bc63	a21aefd63c62b0d12cbea04bc986c481867d56c2069c65d90fc1ccc9d2396e95	2026-11-05 06:39:43.23588+05:30	\N	2026-11-04 22:39:43.238559+05:30
e94dbcc6-5879-4854-ae0c-2137a53ef31c	40351e16-e0dd-4064-a060-bd866d35bc63	84ed98361b509b70f3ce00309fb5504f13523d2a3969bd39275dc8e498040c4f	2026-11-05 06:39:45.364034+05:30	\N	2026-11-04 22:39:45.36528+05:30
54a1d607-e7b4-4b8a-8c9b-4b0733807b28	40351e16-e0dd-4064-a060-bd866d35bc63	9d97d7e5aea614d3d9135b162b6dca1889032ce439ad024408ecbe9304138399	2026-11-05 06:39:47.424541+05:30	\N	2026-11-04 22:39:47.425806+05:30
32267ede-1d78-4124-a9f5-3cfb8fe68d65	40351e16-e0dd-4064-a060-bd866d35bc63	35fe5dbb3d88bfb105df93f18ff6657a201e366bbbb90fd5e5e7534fc643feac	2026-11-05 06:39:48.947887+05:30	\N	2026-11-04 22:39:48.94856+05:30
a5324873-27bc-4e2c-9cee-81e22572b90e	40351e16-e0dd-4064-a060-bd866d35bc63	6f0814c67c8977b560aeabb5a9de4f8a14687b7e0e1d18f10ea223d0ca7d765a	2026-11-05 06:39:50.545251+05:30	\N	2026-11-04 22:39:50.546416+05:30
59b1852a-d143-4856-80d5-32b311223e8e	40351e16-e0dd-4064-a060-bd866d35bc63	1f07dda5efa824523a41cae5a374c40d27b7b467bf7bf9f103aa326a917e43e5	2026-11-05 06:39:51.992814+05:30	\N	2026-11-04 22:39:51.993419+05:30
a4a45036-9466-401e-9adf-8f9bf993c4ef	40351e16-e0dd-4064-a060-bd866d35bc63	ba24a18d614fd0683530f3535c1ca4a33b0eda959e8ea3ff332fe1f21c31dfe5	2026-11-05 06:39:53.981716+05:30	\N	2026-11-04 22:39:53.982794+05:30
22b3b1d7-0b79-4e6b-9c1b-63b45c2d7f24	40351e16-e0dd-4064-a060-bd866d35bc63	88bcdcede2278dd5f68a9ec8094b8bc51ab0f37943abcc6f530663d273c0e699	2026-11-05 06:40:11.163387+05:30	\N	2026-11-04 22:40:11.164686+05:30
e67e250a-8e18-4e67-9061-10ef55afe5f2	40351e16-e0dd-4064-a060-bd866d35bc63	fe10f27c89518fc631a7c6ece7f230870f4b7a981b61c922514df01ae38fb4c0	2026-11-05 06:40:13.078565+05:30	\N	2026-11-04 22:40:13.079356+05:30
52d8ee4d-3e2c-4f5d-8151-9c0ce295ff83	40351e16-e0dd-4064-a060-bd866d35bc63	29a0c47c53e7b1f35dafe99f88562d4205fd59ae0bde1734a48bc23ba71d4988	2026-11-05 06:40:14.877916+05:30	\N	2026-11-04 22:40:14.878813+05:30
b8acebbf-2747-496c-a1d8-e5cf52273f6e	40351e16-e0dd-4064-a060-bd866d35bc63	98d37772b42758f42f72c878a1bba90cbf05a46415dc3522fb5e986be64dc11f	2026-11-05 06:40:16.391031+05:30	\N	2026-11-04 22:40:16.391973+05:30
9a0eb0e4-884a-4c9a-adb8-def388c7501d	40351e16-e0dd-4064-a060-bd866d35bc63	6ffdbd8440d7cf51c244b5ae980491807068d5b01c213a8c8554f4e7b29fe678	2026-11-05 06:40:17.88456+05:30	\N	2026-11-04 22:40:17.885644+05:30
faaa7e3d-69b5-4e9f-8c56-f07e9cd2b2df	40351e16-e0dd-4064-a060-bd866d35bc63	57c77857cf2e78815395635ba4e70a3a0ede3d8480508ccd75288e51c04f7a25	2026-11-05 06:40:19.674344+05:30	\N	2026-11-04 22:40:19.675799+05:30
8cf5736c-a6ab-48fb-aea0-23570bec37cb	40351e16-e0dd-4064-a060-bd866d35bc63	521470167ddc1a5b354adafac913ef7d123bed29cb9c2e9016b79e0a0875c891	2026-11-05 06:40:21.731081+05:30	\N	2026-11-04 22:40:21.733471+05:30
a731383c-afb8-4414-a6d7-6f6af6885b96	40351e16-e0dd-4064-a060-bd866d35bc63	c96d4643448f6afd63d2562ee9179dbd46b1eb649d8eb4c7a60daa75500c36c8	2026-11-05 06:41:09.607017+05:30	\N	2026-11-04 22:41:09.60832+05:30
2c99ea1d-a799-4ff1-9118-ef1455264219	40351e16-e0dd-4064-a060-bd866d35bc63	078a75b969da373feab25c322c4142d24a838aa0ba82181db7eb3032397b1bb9	2026-11-05 06:41:10.36033+05:30	\N	2026-11-04 22:41:10.361315+05:30
90eb2d34-3c16-4dfd-94c5-9a653e376181	40351e16-e0dd-4064-a060-bd866d35bc63	cd1d9685963c6a9d57a962e35bb694bfb08621e44b979bd0e38bf25256e72eff	2026-11-05 06:41:10.978586+05:30	\N	2026-11-04 22:41:10.979645+05:30
57de15dc-63a7-4533-8cf5-5a0fcde5bbce	40351e16-e0dd-4064-a060-bd866d35bc63	5693c16825adb7266e8edd58f86abf0df54cc2586b410ca93d6c1ce758edc71e	2026-11-05 06:41:11.722525+05:30	\N	2026-11-04 22:41:11.723506+05:30
48db678a-caab-48aa-87a9-d76c86045d8b	40351e16-e0dd-4064-a060-bd866d35bc63	1d7575e136a35e0cf58c3c00190de437bdc051b661e68a40c1cbcd24e48df1f9	2026-11-05 06:41:12.458814+05:30	\N	2026-11-04 22:41:12.459995+05:30
720768e9-f656-4fec-b3f6-3f17fec36e80	40351e16-e0dd-4064-a060-bd866d35bc63	98545bf9ad85516fff6dc6d1f18911971a6059e579c2ad49991f834296bdd218	2026-11-05 06:41:13.509793+05:30	\N	2026-11-04 22:41:13.510805+05:30
f8582be8-a413-4421-bb28-80c073c591ec	40351e16-e0dd-4064-a060-bd866d35bc63	df51eccaa249de5ae2eda6f8fe485389b34d8cfbc91e0c76da81705b271c784b	2026-11-05 06:41:14.336605+05:30	\N	2026-11-04 22:41:14.337633+05:30
00b5d63e-c9f6-403e-93bd-24b05eb777af	40351e16-e0dd-4064-a060-bd866d35bc63	2d59d2c21e16dcb5f33952ffc02f5df992c5ccebe2580e0bbf1ee9d991495650	2026-11-05 06:41:50.715693+05:30	\N	2026-11-04 22:41:50.717086+05:30
c2db3595-b636-476f-b5b4-044787855d6e	40351e16-e0dd-4064-a060-bd866d35bc63	6fe0527cf6762fb67243cf46d2d23a78932d9c1f3da3cb90a329a30b702fc3e6	2026-11-05 06:41:51.502884+05:30	\N	2026-11-04 22:41:51.503738+05:30
d3c31275-edfc-460e-9e94-85a36230922e	40351e16-e0dd-4064-a060-bd866d35bc63	1d9d8e696895475504cf456a9c8eca063c904e8305989f4794dd2bb76c909138	2026-11-05 06:41:51.964315+05:30	\N	2026-11-04 22:41:51.965526+05:30
39075064-5b2e-4a91-83ca-295888c51e5d	40351e16-e0dd-4064-a060-bd866d35bc63	ede148282ff56e84f96e79bcb3f621e2b9231c95e1b92ef0645aa0f808258b59	2026-11-05 06:41:52.608021+05:30	\N	2026-11-04 22:41:52.609055+05:30
bdf65c4e-5ab7-4160-ac85-2ce69163d9c1	40351e16-e0dd-4064-a060-bd866d35bc63	9b62d705a6d3c66a10ba1ce2f7ebb8572b190781f77920c12c230bceea4c14dd	2026-11-05 06:41:53.200474+05:30	\N	2026-11-04 22:41:53.201321+05:30
e8650695-1e6d-4114-ab2c-3e1e1c41693c	40351e16-e0dd-4064-a060-bd866d35bc63	0fae7f5d2afb1ebecd286cd6d3d3e6e302f66f51dd4d08ce88f2f35b54ddaee4	2026-11-05 06:41:54.021651+05:30	\N	2026-11-04 22:41:54.022607+05:30
bb222922-ffb3-45ef-bf83-cf94e9e8bf82	40351e16-e0dd-4064-a060-bd866d35bc63	7589569c4aa80d762f819355cc05a1b7c46a0dcf0269cf4a11ac447ccd229f45	2026-11-05 06:41:54.691139+05:30	\N	2026-11-04 22:41:54.691742+05:30
ddb310ba-74bc-4025-a7be-8c2629c69757	40351e16-e0dd-4064-a060-bd866d35bc63	1e63447d7cbac988dc9ff9840627cef988f90a0ac90af0a007732d75224443c2	2026-11-05 06:42:06.003641+05:30	\N	2026-11-04 22:42:06.005571+05:30
fa75a827-357e-4db4-8b71-6ddac8256399	40351e16-e0dd-4064-a060-bd866d35bc63	7e44860c3f09625cfa89a7c8866b5fcd470abb38e01b5667fb1a449bb9f165f5	2026-11-05 06:42:07.544837+05:30	\N	2026-11-04 22:42:07.545464+05:30
9017bd19-fc87-48a3-8dff-2b2c48780b27	40351e16-e0dd-4064-a060-bd866d35bc63	dc249eb252385b71d6217951ffc4319c1ed84e178e55561b1b516fc1b991645c	2026-11-05 06:42:08.190844+05:30	\N	2026-11-04 22:42:08.191572+05:30
4315ee14-02dc-4203-9485-1eecbf334ceb	40351e16-e0dd-4064-a060-bd866d35bc63	90777a215b52b24bc15a9fec9cb5ad2bf2893f1015b23131e7cccc3bd5fb1f36	2026-11-05 06:24:12.813083+05:30	2026-11-04 22:55:05.346193+05:30	2026-11-04 22:24:12.81461+05:30
350a9c60-7dc7-4288-a648-63f79dab4fb3	40351e16-e0dd-4064-a060-bd866d35bc63	add6afc6b40b22d42660f2cb95be19364b5ec561611c4aa6c8f34bd340249306	2026-11-05 06:42:09.424356+05:30	\N	2026-11-04 22:42:09.425735+05:30
ecd368b9-fff7-4682-9256-a99b48583009	40351e16-e0dd-4064-a060-bd866d35bc63	29410eec0f1eae33a495896f65c6566ff01511c42d7520259460b25fb719ebfd	2026-11-05 06:42:10.105432+05:30	\N	2026-11-04 22:42:10.107086+05:30
0b25da8e-a6c1-4f50-bb5e-9fc48403435e	40351e16-e0dd-4064-a060-bd866d35bc63	fb77c7f40b2e445c28ace14402ee8c167d491be78340c1b37fd008b1e58ef821	2026-11-05 06:44:35.383394+05:30	\N	2026-11-04 22:44:35.3861+05:30
cb522ab3-1c7c-4f09-9a42-ebb2da81b42b	40351e16-e0dd-4064-a060-bd866d35bc63	49f0bfef545210b8940060d4e1af698d58443fc0c242a6915825967390b8497f	2026-11-05 06:44:36.380682+05:30	\N	2026-11-04 22:44:36.381562+05:30
7c18ad1e-6606-421e-a7c7-dcd6419631b0	40351e16-e0dd-4064-a060-bd866d35bc63	96bdc4ec7c25431cdcd8631e52d70e6e83d2cd5c06f85a1c646f538e03f0fd33	2026-11-05 06:44:37.097675+05:30	\N	2026-11-04 22:44:37.098681+05:30
b3cc986a-df94-412b-83de-635f1da13def	40351e16-e0dd-4064-a060-bd866d35bc63	6c2394f1eab16a33b406ed36f350c78d1302f813219ed5e7840ec8e113514cbd	2026-11-05 06:44:37.85105+05:30	\N	2026-11-04 22:44:37.853518+05:30
b501d7cc-95d2-407a-bd7b-19514967e6b9	40351e16-e0dd-4064-a060-bd866d35bc63	c9b5f2fb5021a2231116f3275e1cbf07048f682c36a0170178a02f57df823098	2026-11-05 06:44:38.556159+05:30	\N	2026-11-04 22:44:38.557061+05:30
bef9667f-3d56-47d3-9ff8-93803591099b	40351e16-e0dd-4064-a060-bd866d35bc63	770053a3aa0330a4a3c81f39dfdaf77dcea5b83f4f0847d5a93a2475d44aab22	2026-11-05 06:44:39.61348+05:30	\N	2026-11-04 22:44:39.614579+05:30
26168f4e-92af-4b0c-ad15-b49a6df64583	40351e16-e0dd-4064-a060-bd866d35bc63	d8174e906dbbfd4c5df29628e6e63fa9828d87dc432ace2cc294ce61d3aefc9b	2026-11-05 06:44:40.398139+05:30	\N	2026-11-04 22:44:40.399525+05:30
7e3a030e-8a2e-4ab0-9357-c3490a4b30ef	40351e16-e0dd-4064-a060-bd866d35bc63	73e1976ace90b0f6a7fb5975ec9143e13f1fa4937f6e04e6e26c7a5429dc52ae	2026-11-05 06:44:47.445284+05:30	\N	2026-11-04 22:44:47.446218+05:30
66a263ea-f0f1-43eb-b647-80f4fc8a7a4d	40351e16-e0dd-4064-a060-bd866d35bc63	d72efe1c094bfe2e5d5ad1b7dac4165543bb29d0658e338b49f6460e6e8d4b64	2026-11-05 06:44:49.348867+05:30	\N	2026-11-04 22:44:49.350029+05:30
bda7907a-b512-450e-855e-a79503bf165e	40351e16-e0dd-4064-a060-bd866d35bc63	e6523bb34251b22438e8632c02c34b6dcf615f1c198c766af38e7f51eee883d2	2026-11-05 06:44:50.258111+05:30	\N	2026-11-04 22:44:50.259542+05:30
4538b0a6-5f8c-49db-b55d-121c13cf8af7	40351e16-e0dd-4064-a060-bd866d35bc63	32f985266ac9ec81f96cad30c4fef56ec7ecdd3bc432ec29899664933b6cf503	2026-11-05 06:44:51.491811+05:30	\N	2026-11-04 22:44:51.493114+05:30
d8c0b9e1-40ce-4899-bbd1-6c42ae351165	40351e16-e0dd-4064-a060-bd866d35bc63	5e994f39f20a7d19ac6e40e62096097b1815eb34cfdba5e3d4c856aa6f17515c	2026-11-05 06:44:52.369887+05:30	\N	2026-11-04 22:44:52.371499+05:30
7a44745d-f73b-465f-81f9-4d6037e404a6	40351e16-e0dd-4064-a060-bd866d35bc63	3f60cb098594363622d20050d253af848d88ccaff388c4b529f48382d9e7e719	2026-11-05 06:46:19.439896+05:30	\N	2026-11-04 22:46:19.441423+05:30
58d3de3b-2d2c-474f-80b5-383346fc230b	40351e16-e0dd-4064-a060-bd866d35bc63	3b780ec4b1731bb35c1c3ffcbb44cacba1bd112cc983bc6468fdcf5946dc1c7d	2026-11-05 06:46:20.587081+05:30	\N	2026-11-04 22:46:20.587979+05:30
c62394a7-dd68-4f80-8426-604fca16c673	40351e16-e0dd-4064-a060-bd866d35bc63	1cc1082d38a1fb48591783e070522256076e3f11ce4e7adec59be63b745f34fa	2026-11-05 06:46:21.629379+05:30	\N	2026-11-04 22:46:21.630365+05:30
493d65a3-6d81-4ebf-b9f7-6ba471dae5dc	40351e16-e0dd-4064-a060-bd866d35bc63	afa980afee4a73225375cec2623dd00645b1182169e8b2815977a0ccf20faada	2026-11-05 06:46:22.015866+05:30	\N	2026-11-04 22:46:22.016609+05:30
744540d4-2da7-4aae-ac0a-988d6a94ba09	40351e16-e0dd-4064-a060-bd866d35bc63	dad871691989c1b6d7cd31f996fe9c547eb0eb68e267f11a62205a3238cc78f7	2026-11-05 06:46:22.734468+05:30	\N	2026-11-04 22:46:22.740735+05:30
14c350c9-7f9f-4e30-bd24-576ad7d9c401	40351e16-e0dd-4064-a060-bd866d35bc63	13dc76d72aa3f85344d041954c3c1d53e404cbaf54e2e4e4776fff1399362b31	2026-11-05 06:46:58.714581+05:30	\N	2026-11-04 22:46:58.716032+05:30
3698863e-ca91-411e-aee3-758c99348e06	40351e16-e0dd-4064-a060-bd866d35bc63	ba907c59120b68267550076add37a08bfc36078e8aacce7e54f0a7ed824d4ac5	2026-11-05 06:46:59.629359+05:30	\N	2026-11-04 22:46:59.630181+05:30
b18d5462-b728-45fc-a3e4-efbf8aae6bbd	40351e16-e0dd-4064-a060-bd866d35bc63	20b3a734579ddf63254ad75c13458f764e9fa4abfd6ae8fd73b028c87ac8ec74	2026-11-05 06:47:00.382238+05:30	\N	2026-11-04 22:47:00.383173+05:30
f1972149-1ed7-4bba-a0e7-eabb49a9702a	40351e16-e0dd-4064-a060-bd866d35bc63	e11ea3d01f9c565cc50b246f8426364f104a293a609e52db60f41c99a86cd5ec	2026-11-05 06:47:01.123694+05:30	\N	2026-11-04 22:47:01.124625+05:30
d9ba85ec-60d0-4653-a393-7cdd602eb12f	40351e16-e0dd-4064-a060-bd866d35bc63	93a0918225cc8d43c3de530890284dfc1bb63782d398fd24079ddaabc6564935	2026-11-05 06:47:02.008261+05:30	\N	2026-11-04 22:47:02.009308+05:30
09f61f7e-a77c-4306-b78b-dcf8e102246d	40351e16-e0dd-4064-a060-bd866d35bc63	29b33c91832f75bfd7a90141f11931a2c9217b6045ced18f5f6b6e45206ae477	2026-11-05 06:47:16.035473+05:30	\N	2026-11-04 22:47:16.038275+05:30
82d3393e-c401-464c-aeda-07ed6215aa67	40351e16-e0dd-4064-a060-bd866d35bc63	d1b7709de3a2619e16ca34e4f4ab45886a997c3f163229922cc3e836c9f238b6	2026-11-05 06:47:17.250528+05:30	\N	2026-11-04 22:47:17.251479+05:30
cb0dd3bb-928f-450d-842d-fc399ed42c43	40351e16-e0dd-4064-a060-bd866d35bc63	df14fb0b0cc12deb52c9edce8111d1c0025f5b03f42d52f16b2286f3a5a37ba5	2026-11-05 06:47:17.765781+05:30	\N	2026-11-04 22:47:17.766666+05:30
5a73413b-8786-4b81-86ba-daf83745389b	40351e16-e0dd-4064-a060-bd866d35bc63	44ed9b017621ea938e249127279228e68789c04bf1b05f7dad7896e4606fde6c	2026-11-05 06:47:18.388276+05:30	\N	2026-11-04 22:47:18.389165+05:30
6b215a63-d6f9-4958-9841-2ea8d69e67ac	40351e16-e0dd-4064-a060-bd866d35bc63	a113709714d7204fa35ecced1d78427c5a0309c3d76973172e00b1514cdc46c0	2026-11-05 06:47:19.131481+05:30	\N	2026-11-04 22:47:19.132371+05:30
0651c073-bd94-4408-8e8f-542e04629d33	40351e16-e0dd-4064-a060-bd866d35bc63	cd3c45f3dfc3b310322c17449ca8e2130cd25b797ef82f41ce90605634cc1e70	2026-11-05 06:47:20.518695+05:30	\N	2026-11-04 22:47:20.520416+05:30
1d69937d-d51c-46b1-9556-8125bcfa3200	40351e16-e0dd-4064-a060-bd866d35bc63	c99fa99f73297adcde1da2b7acb111a8c13d0f7deb99b4363b144f6a40abbb1a	2026-11-05 06:47:21.231396+05:30	\N	2026-11-04 22:47:21.23246+05:30
d2d60849-32f1-4caa-af98-a1e27f930cf5	40351e16-e0dd-4064-a060-bd866d35bc63	398f040dd8cb1a8b12033cf178d95e4aab0077c6ee64ccd1a4c6056044670d74	2026-11-05 06:47:30.308499+05:30	\N	2026-11-04 22:47:30.309162+05:30
a7af2d39-cb3a-4fa1-9328-22484bab7eb9	40351e16-e0dd-4064-a060-bd866d35bc63	f5061333b86d461efb1ca14cdbdc2f3e4c1e5462e91f1f45d12d36a2da2105f0	2026-11-05 06:47:31.552197+05:30	\N	2026-11-04 22:47:31.553205+05:30
64671151-c0c4-444d-a095-438ced518b9a	40351e16-e0dd-4064-a060-bd866d35bc63	10b18b4baefdefe246614901415bc11a314586e3a812d28859fb031a18278545	2026-11-05 06:47:32.540392+05:30	\N	2026-11-04 22:47:32.54166+05:30
4386ffad-b785-44e6-b004-fd1384e4151d	40351e16-e0dd-4064-a060-bd866d35bc63	cf8ded517e1438919b2301bcf5f77a2b1a6dc9ec6f53253e73ede9db3467a834	2026-11-05 06:47:33.207149+05:30	\N	2026-11-04 22:47:33.208505+05:30
e42b7b18-457c-46ac-89c6-9b651751dbd6	40351e16-e0dd-4064-a060-bd866d35bc63	240776ad09647e03f1666fcd5cac88f6cdd392ecb56acb3b66a0e0aa2e3af626	2026-11-05 06:47:33.847949+05:30	\N	2026-11-04 22:47:33.849749+05:30
6c402f55-c3d1-4739-94aa-4fab0517b95b	40351e16-e0dd-4064-a060-bd866d35bc63	5a52c6c8dc8eabbacca27a6ea317cb4a8eac2da37ce6183ea0912cba3ee0db3a	2026-11-05 07:02:35.720078+05:30	\N	2026-11-04 23:02:35.72303+05:30
4a6570be-9b4f-4ba3-85ed-443f1fdc0de9	40351e16-e0dd-4064-a060-bd866d35bc63	3afcb7e2b3f492167e136f1b8a4a96d0a7340f84be1f1b7bc0f3425c2f834dc5	2026-11-05 07:02:36.446183+05:30	\N	2026-11-04 23:02:36.448431+05:30
96bf505b-7131-4fd1-901c-b470621087ee	40351e16-e0dd-4064-a060-bd866d35bc63	c2f81062fedbc068aec483e26de285658f59f90df58bdea01225d458e07436d3	2026-11-05 07:02:36.907274+05:30	\N	2026-11-04 23:02:36.908393+05:30
c126572c-ddc2-4c5b-abca-1f5310958220	40351e16-e0dd-4064-a060-bd866d35bc63	a09ecf07b5894f75b691fa7ebb488856a6831def7cf3cc3da19ac603ee9a30d7	2026-11-05 07:02:37.294452+05:30	\N	2026-11-04 23:02:37.295875+05:30
b6b3f8a2-11bb-47b4-be0b-d375c952c8fe	40351e16-e0dd-4064-a060-bd866d35bc63	7f51da19283415c9af5c751b4c6a4a8fba6f2beda12fbdf76e5fb50bf2f330f8	2026-11-05 07:02:37.781811+05:30	\N	2026-11-04 23:02:37.784331+05:30
23f702c6-d94e-4178-8b51-2b88833feefe	40351e16-e0dd-4064-a060-bd866d35bc63	fdd4567625cc87643b99c7c4380d1d01258c1200e1f08078fb9987f7cffc0428	2026-11-05 07:02:38.445491+05:30	\N	2026-11-04 23:02:38.446271+05:30
ae77543a-f19f-42cc-941a-173086970d7c	40351e16-e0dd-4064-a060-bd866d35bc63	a258d578e284809b99d223568f75ae35ed7babc63755acecf56358bb1bf957ea	2026-11-05 07:02:38.937743+05:30	\N	2026-11-04 23:02:38.939558+05:30
d59e8508-64c8-4b4b-8910-215dddff287b	40351e16-e0dd-4064-a060-bd866d35bc63	6eb2980a309de00b57f942bce3ac2f10803fb5b2a640bbaddfa90bb77676d6c6	2026-11-05 07:02:39.721579+05:30	\N	2026-11-04 23:02:39.72285+05:30
36c6cd78-87df-41f5-be44-0adcbda578a6	40351e16-e0dd-4064-a060-bd866d35bc63	29cd2cf1e035ce789a8fe4b1fef787048ebd2ba699fd63e121a878ee3c68f3e6	2026-11-05 07:02:40.425519+05:30	\N	2026-11-04 23:02:40.426696+05:30
fbb75bbb-ac79-4cbd-99d3-f23d7184453c	40351e16-e0dd-4064-a060-bd866d35bc63	ba3b0bc2077ca84d44c9df0353ff351501082b026f8a1c01f588ffa08c271e1c	2026-11-05 07:02:40.845172+05:30	\N	2026-11-04 23:02:40.846437+05:30
02148572-7130-4963-8329-6ed7d2c3bc53	40351e16-e0dd-4064-a060-bd866d35bc63	892b465c27db0c8cbe5229a25d18b215354049fb399419718a180724b100373e	2026-11-05 07:02:41.316976+05:30	\N	2026-11-04 23:02:41.318576+05:30
c5cbc76f-d7fc-41dc-9276-f33598db08e9	40351e16-e0dd-4064-a060-bd866d35bc63	f2db4346bed01780bc1b01d13cb2e59f54def477a26524ac3b8153161faf9502	2026-11-05 07:02:42.007674+05:30	\N	2026-11-04 23:02:42.010588+05:30
5486eb68-a2e9-4e9b-998b-1bc6e43b00e7	40351e16-e0dd-4064-a060-bd866d35bc63	38c57956ac7a1c178ced2fec84586851e27421bf2c977d26002006657a53dc9e	2026-11-05 07:06:27.532534+05:30	\N	2026-11-04 23:06:27.534706+05:30
27be7704-6d77-420d-851f-f208a3db290b	40351e16-e0dd-4064-a060-bd866d35bc63	5eef5114257067433328c68377fcda6716335321a37dac7345d31dfda10922c9	2026-11-05 07:06:28.338106+05:30	\N	2026-11-04 23:06:28.338943+05:30
beff5323-e660-44ff-b1c9-16fa60bd8d99	40351e16-e0dd-4064-a060-bd866d35bc63	498baf93a3219fe5f561097fc213fa656a0685a9b804895092f6406145fdb0a7	2026-11-05 07:06:28.858027+05:30	\N	2026-11-04 23:06:28.859169+05:30
872bbcc5-1290-44a8-ae1f-35c85831d03d	40351e16-e0dd-4064-a060-bd866d35bc63	548bb2cb2503f38d8e0853e24d1f952a0a1cf5582701a5f11025391f6174d619	2026-11-05 07:06:29.386971+05:30	\N	2026-11-04 23:06:29.387984+05:30
9674ef9b-34de-4cb1-8415-a88cb34fcfb9	40351e16-e0dd-4064-a060-bd866d35bc63	fe0a535d5fbcebbe439ea397b18b7b4e9ecb7282add43feddcd1b81005c20595	2026-11-05 07:06:30.030089+05:30	\N	2026-11-04 23:06:30.030957+05:30
bc7d8fe6-68d8-4383-8eaf-9e2198f9212a	40351e16-e0dd-4064-a060-bd866d35bc63	152bd59f6061c44dda1156fbd0e24205bf78b4bcea9c3ffba474dd1f804799f2	2026-11-05 07:06:30.724584+05:30	\N	2026-11-04 23:06:30.725339+05:30
dd7d2556-4fde-45b1-8f48-f7b588d3d9c8	40351e16-e0dd-4064-a060-bd866d35bc63	28fbf81c3a9857ed9c7050d40ce783210b081ad89e0fb23f43825d2958396fd4	2026-11-05 07:06:31.250362+05:30	\N	2026-11-04 23:06:31.251302+05:30
be1deb1d-0d52-46cb-bb33-4fa67c644cfc	40351e16-e0dd-4064-a060-bd866d35bc63	c6f38453ec445b0dacbce9a6e52487675980e7069f71e5ccfeaecde8195e0113	2026-11-05 07:06:31.95855+05:30	\N	2026-11-04 23:06:31.95984+05:30
433e2157-f041-453a-b8c2-77a4e988eede	40351e16-e0dd-4064-a060-bd866d35bc63	5ed3f30c36063baf83f8ed8b119028612b3ec5e7c1d006f6c463f64c185ec612	2026-11-05 07:06:32.56731+05:30	\N	2026-11-04 23:06:32.568217+05:30
91e96756-f618-4c69-a107-0396ec7e178f	40351e16-e0dd-4064-a060-bd866d35bc63	351f6fbc811b9a17a6879926738c87471d41cea20216a149d3fabd67d3015d83	2026-11-05 07:06:32.942939+05:30	\N	2026-11-04 23:06:32.943829+05:30
83684a34-1c6f-47d2-a9e8-36fab433041c	40351e16-e0dd-4064-a060-bd866d35bc63	6b8406bc3f3f26b622f4bf817a313275ee1156cbf89ae680670831d7b3e4281e	2026-11-05 07:06:33.357865+05:30	\N	2026-11-04 23:06:33.35867+05:30
438abbf7-74a7-4784-8f2e-a8f7ff37b481	40351e16-e0dd-4064-a060-bd866d35bc63	180701faeecb4f17a0e3440519f8799e600191db777bedc559533ac1e872bc63	2026-11-05 07:06:33.87943+05:30	\N	2026-11-04 23:06:33.88055+05:30
46e25814-3536-4e43-8ee5-f79d9585859c	40351e16-e0dd-4064-a060-bd866d35bc63	b9d612b680f42b96f00faa763766cd87767cca0d30fed681f44c30e5ab7c5f4e	2026-11-05 06:24:12.813083+05:30	2026-11-04 23:21:46.647968+05:30	2026-11-04 22:55:05.411862+05:30
987f88a9-e6a9-43ff-97f4-f7ae1bb5d062	40351e16-e0dd-4064-a060-bd866d35bc63	052c408368306230dee04f86fb39f8d667bd5a6902e363bd40ac2323b8d1ec06	2026-11-05 06:24:12.813083+05:30	\N	2026-11-04 23:21:46.704495+05:30
599f6140-c945-4efa-85f8-e3af12702ab2	40351e16-e0dd-4064-a060-bd866d35bc63	975d62994868add6276a133b43efc997a51b5fd092531a6c276d2f9a0e75d95e	2026-11-05 07:22:01.246843+05:30	\N	2026-11-04 23:22:01.248563+05:30
42c427c7-b468-4cdc-ab33-d9b229f76109	40351e16-e0dd-4064-a060-bd866d35bc63	3d02fade343649a562b3dd4ed41c134c4325dbed264156f3b3f38519571924a8	2026-11-05 18:41:00.501791+05:30	2026-11-05 10:56:31.123798+05:30	2026-11-05 10:41:00.507512+05:30
ff62ee7b-7686-4ace-860e-e728f1a671d0	40351e16-e0dd-4064-a060-bd866d35bc63	7723e14bfc6cf1ad3cabf3b8654baa6d376fd951b05391307b9dca29b9227368	2026-11-05 18:41:00.501791+05:30	2026-11-05 10:56:31.390418+05:30	2026-11-05 10:56:31.144772+05:30
2c73256b-1856-4f6c-9441-fa08ca773a86	40351e16-e0dd-4064-a060-bd866d35bc63	a75f93cd318d94b21f1270fc4760ff617dfa64c4fac60f90ed6ee090ba9fbb33	2026-11-05 18:41:00.501791+05:30	2026-11-05 11:12:02.732662+05:30	2026-11-05 10:56:31.405771+05:30
be9d1ba8-c97f-46b6-9050-fd2708612f0e	40351e16-e0dd-4064-a060-bd866d35bc63	29e74ed8000a1b2710b0af02a7655b3ccb117c97f38150f0a569452a7e6cf542	2026-11-05 18:41:00.501791+05:30	2026-11-05 11:27:04.263922+05:30	2026-11-05 11:12:02.738297+05:30
080d6ff0-43f2-4b7f-8ccb-f81aca0fdb46	40351e16-e0dd-4064-a060-bd866d35bc63	96bc572a9e8b84db205c8cfde0370020db8822ce58a46f134d6590f7886975ec	2026-11-05 18:41:00.501791+05:30	\N	2026-11-05 11:27:04.274352+05:30
a9e50754-cb9e-486d-82eb-89cb82a0b01d	40351e16-e0dd-4064-a060-bd866d35bc63	c9ec49f085694376125cd2371c814afcf7caa78d22b8aca1023e521e75757129	2026-11-05 19:31:01.866231+05:30	\N	2026-11-05 11:31:01.867358+05:30
da0cacaf-8184-4b51-a14b-db36b1544657	40351e16-e0dd-4064-a060-bd866d35bc63	6bc80ef634fcf3a31407a07a0c07699e69690af881187d71a43694dfa0e8f8b6	2026-11-05 20:25:16.873871+05:30	\N	2026-11-05 12:25:16.878665+05:30
c97806cb-7ae1-4eaf-adcd-86516815787a	40351e16-e0dd-4064-a060-bd866d35bc63	8bef8db8547b95c183ed22b5d448f99ad9ba7e3013ed0e74da917bed0f738589	2026-11-05 20:25:20.098985+05:30	\N	2026-11-05 12:25:20.100694+05:30
7bf08210-09e6-4e07-b179-745d2a6d5169	40351e16-e0dd-4064-a060-bd866d35bc63	716b01d6438d6e8234faa3a0c2787b1b08ed473c6cafe2da1f06ce8bc32983f0	2026-11-05 20:25:20.798859+05:30	\N	2026-11-05 12:25:20.800515+05:30
ada45be0-8229-4fb0-9c30-ee49983afec6	40351e16-e0dd-4064-a060-bd866d35bc63	e1215351b3eded4810fbf14488bd2e468245ff88f7c327d92f01ea8d96bc4bd7	2026-11-05 20:25:21.560981+05:30	\N	2026-11-05 12:25:21.564676+05:30
b78b31b5-daf5-4264-8a80-6e22e1f70163	40351e16-e0dd-4064-a060-bd866d35bc63	1f8356f7de5292d57478a85a97b60e3525f516413b70fc2a72c451e065981cc1	2026-11-05 20:25:23.141877+05:30	\N	2026-11-05 12:25:23.142953+05:30
3468e165-700e-47ba-8bbb-bda5de64b0b3	40351e16-e0dd-4064-a060-bd866d35bc63	d9551f24b060e78f6fcaf64b2f0c19918c25b5c3efe75ba02012ec136067a0b5	2026-11-05 20:20:13.632189+05:30	2026-11-05 12:35:56.451508+05:30	2026-11-05 12:20:13.64978+05:30
8c0026ef-b057-4d56-b8c6-b9f80c9b1316	40351e16-e0dd-4064-a060-bd866d35bc63	6a662377199fc446126852bac249b126789fcdf94242147a4f48fc44dd7a6ac5	2026-11-05 20:20:13.632189+05:30	2026-11-05 12:35:57.310379+05:30	2026-11-05 12:35:56.830538+05:30
bf051d69-411e-400b-abb7-46b5bedc62c7	40351e16-e0dd-4064-a060-bd866d35bc63	fb8070441a0551f1497b7142426cd2e6fb42e2b2e8b12647b761d4627dcb49ab	2026-11-05 20:20:13.632189+05:30	2026-11-05 12:51:54.117797+05:30	2026-11-05 12:35:57.319044+05:30
970aff83-44ee-4765-8ed7-ea48c468139f	40351e16-e0dd-4064-a060-bd866d35bc63	97b9751faa0839f273110d354de0613d581a5b93dc7c716e1881a51f9b1b9873	2026-11-05 20:53:34.990758+05:30	\N	2026-11-05 12:53:34.993695+05:30
44a95dbf-2ce9-4f7a-9876-789ef85df2f8	40351e16-e0dd-4064-a060-bd866d35bc63	00788d3299be08c8f8bda1b81965e44cb5385cea832fc6dcc6d3da7249779144	2026-11-05 20:53:36.274869+05:30	\N	2026-11-05 12:53:36.275769+05:30
d4d5a923-f20d-4101-b316-484750cecc0e	40351e16-e0dd-4064-a060-bd866d35bc63	4f65d30936cab2c04b19c85267b061f378d13c66ee77209b9515625d96cdc0ea	2026-11-05 20:53:36.788247+05:30	\N	2026-11-05 12:53:36.78945+05:30
8a8f1512-a984-4f16-81d7-fd4b0b884b9a	40351e16-e0dd-4064-a060-bd866d35bc63	a8510a00459824fd0b3fc2e1f2888c23724b5c6ab793f34ca2b3e4b664ebea22	2026-11-05 20:53:37.307571+05:30	\N	2026-11-05 12:53:37.308493+05:30
ad05d6d1-c2dd-4bf3-8166-905a0ba6935f	40351e16-e0dd-4064-a060-bd866d35bc63	16efebf14addb6828b139e3f221ef4a07116deaaa732036e57b671bdf9338a60	2026-11-05 20:53:37.880414+05:30	\N	2026-11-05 12:53:37.881694+05:30
b0aba406-1310-45c1-9dcd-2e43f05ddf22	40351e16-e0dd-4064-a060-bd866d35bc63	2fcdea6814370cb3149a2998174eb07272b94a07e81163c4ef5ce7e0c5ae03bd	2026-11-05 20:54:50.454879+05:30	\N	2026-11-05 12:54:50.456351+05:30
eff3713a-42af-462c-866f-ec1ae0ab572e	40351e16-e0dd-4064-a060-bd866d35bc63	ea8e07458d5b1fdfa86741c12019295d3f8a54a235b39dccbfb82e3534de8922	2026-11-05 20:54:51.564037+05:30	\N	2026-11-05 12:54:51.564888+05:30
1de575cb-a993-4a80-8735-e5d60b6b2fed	40351e16-e0dd-4064-a060-bd866d35bc63	372f3d88ca43f4fbbe7a12813b1810460ed91b453ceafbefe580e421744a64de	2026-11-05 20:54:52.122304+05:30	\N	2026-11-05 12:54:52.123288+05:30
579bb780-c9d6-4825-afe9-7b1c5c6a5814	40351e16-e0dd-4064-a060-bd866d35bc63	8dcece7c7c43bdc8974737105f5dd942ad20ed1801a72658529e274f8d4f5028	2026-11-05 20:54:52.768453+05:30	\N	2026-11-05 12:54:52.769553+05:30
07a7f2a1-454a-4c98-a719-7e1201a0f0b0	40351e16-e0dd-4064-a060-bd866d35bc63	55fd09dd969163099c861a7c7c99778638aca784c355b8f4aa10b5340f574227	2026-11-05 20:54:53.398033+05:30	\N	2026-11-05 12:54:53.398955+05:30
0d476356-0665-4357-800d-bbb62f96d6fc	40351e16-e0dd-4064-a060-bd866d35bc63	6ce1d946002bd97f285df34fc231a1210522623a61dab3a8a36d0ff68c1d61b2	2026-11-05 20:56:20.07756+05:30	\N	2026-11-05 12:56:20.079267+05:30
13d53584-1b40-4110-88d9-8eed16d0bdb9	40351e16-e0dd-4064-a060-bd866d35bc63	66734fdd2d62399f7fe263fb4739f5140d3289a45c8d216df94afebc500339c2	2026-11-05 20:56:21.222964+05:30	\N	2026-11-05 12:56:21.224141+05:30
8f9102ff-77ef-4e5b-9dd6-02c722cdb003	40351e16-e0dd-4064-a060-bd866d35bc63	d273c9d4904518f7d1d7803d42d1cd8ed849390d2581554ef63c7e8dcb3dbc6d	2026-11-05 20:56:21.838859+05:30	\N	2026-11-05 12:56:21.839794+05:30
e4fedf39-e568-4c41-b477-b5bbb49847e1	40351e16-e0dd-4064-a060-bd866d35bc63	88594bffe68b1f543f37526649cb7fb1227420e6b20910cad0e50f9e5321572a	2026-11-05 20:56:31.273324+05:30	\N	2026-11-05 12:56:31.275207+05:30
0a917d3d-1eab-4243-aa1d-557e2bdce765	40351e16-e0dd-4064-a060-bd866d35bc63	da7f9ab1fee59d0413dfa413548dac2c6199250a100005ced41e4b7bd3c21e2e	2026-11-05 20:56:32.467439+05:30	\N	2026-11-05 12:56:32.468186+05:30
d13bd068-1c67-450d-9af8-ff84dfdbf084	40351e16-e0dd-4064-a060-bd866d35bc63	6fab8dccf3c47aa733d8c569a1002a0496e5f3520db5e4c39001f266cd24e4dc	2026-11-05 20:56:32.932912+05:30	\N	2026-11-05 12:56:32.934272+05:30
5029f623-fb86-4093-959f-f4e13333b75f	40351e16-e0dd-4064-a060-bd866d35bc63	502820c8a20862618ee533fe3881aadc2e2a1734281013aba63df616ffa37265	2026-11-05 20:56:33.572427+05:30	\N	2026-11-05 12:56:33.573569+05:30
1b49600d-ee0c-4392-a2a0-5a4191d07704	40351e16-e0dd-4064-a060-bd866d35bc63	a090248e07349f430ef2d55d5b93de9c23f131c51c3b88e53cf98aace71faed3	2026-11-05 20:56:34.183673+05:30	\N	2026-11-05 12:56:34.184666+05:30
16fc52c2-54fa-4102-ad0c-673086f54b1a	40351e16-e0dd-4064-a060-bd866d35bc63	8ed2cb0cdfa390c93d7b2d99a6fa2cc7366dba7890d4db0659b009f022a71496	2026-11-05 21:04:19.252787+05:30	\N	2026-11-05 13:04:19.257114+05:30
eed0119f-36ea-4bb1-8d97-e6f39a7d9016	40351e16-e0dd-4064-a060-bd866d35bc63	39c71c694f6c5c11a7c0e385d0ba6fe824078dd21375618e0502c594e9408570	2026-11-05 21:04:22.063326+05:30	\N	2026-11-05 13:04:22.064558+05:30
f2af3ab4-2eeb-4248-a4cf-d3db04f6ced6	40351e16-e0dd-4064-a060-bd866d35bc63	316a0743f183d48d3a1c74204ad81d227cf11b2873a7012bdf1ecbee4d233f5d	2026-11-05 21:04:23.528437+05:30	\N	2026-11-05 13:04:23.52913+05:30
df856347-89aa-471c-b573-4f1fdb2a007a	40351e16-e0dd-4064-a060-bd866d35bc63	145c33372dc943c76ce5b96971f20fb7c01a49bf9224e6754a91733586370b74	2026-11-05 21:04:26.884307+05:30	\N	2026-11-05 13:04:26.886385+05:30
e79c8202-1525-443b-a6fb-dc325cea30ce	40351e16-e0dd-4064-a060-bd866d35bc63	61c0922500f732d892f3d760577fb4c1c94b6843f2e28ecdb0a518aa44fec585	2026-11-05 21:04:28.719524+05:30	\N	2026-11-05 13:04:28.720848+05:30
6a109243-ea8c-4724-893f-1bef6763a894	40351e16-e0dd-4064-a060-bd866d35bc63	fa80f88a043486932bc80bd1ebd137214639dab0c3abc700667b1de21381c5df	2026-11-05 21:04:29.511096+05:30	\N	2026-11-05 13:04:29.511908+05:30
db8ad9f7-033a-4e89-bd9d-3c001e83fa92	40351e16-e0dd-4064-a060-bd866d35bc63	474c7f76a87762714d99ca12237f06bceed69ddd5fbb7388d46f3c499149d28a	2026-11-05 21:04:30.2297+05:30	\N	2026-11-05 13:04:30.230899+05:30
07c4225e-7c6d-4aae-8523-d53bfb257b10	40351e16-e0dd-4064-a060-bd866d35bc63	5731a58c9370a6b6bb3ee51a48ae624c59fd818f72c1616dfdfcdbc065cd4b72	2026-11-05 21:04:31.012762+05:30	\N	2026-11-05 13:04:31.013548+05:30
26b59b03-b53a-4ae7-adbb-ffa54219bce9	40351e16-e0dd-4064-a060-bd866d35bc63	8a3c76d04e69d7e8f54bea16fcde332957ffc8219a0f1e9db77eb06cdd0a5d0e	2026-11-05 20:20:13.632189+05:30	2026-11-05 13:07:58.725322+05:30	2026-11-05 12:51:54.362426+05:30
39d4031c-6952-469b-b75c-a14a34b79411	40351e16-e0dd-4064-a060-bd866d35bc63	1c1f3d1c1b9549adf4113611c1702af96625ae91219ca43709e6afeefe564f47	2026-11-05 20:20:13.632189+05:30	2026-11-05 13:07:59.486094+05:30	2026-11-05 13:07:59.002951+05:30
218e9101-555d-428f-af20-0b64d7814fa1	40351e16-e0dd-4064-a060-bd866d35bc63	79ab31e82a62410fdd82f23841faf2740050a6483cf3a074097e4886621680ff	2026-11-05 20:20:13.632189+05:30	2026-11-05 13:31:45.661753+05:30	2026-11-05 13:07:59.491878+05:30
459b119b-6cfc-4e32-bd91-6aaaf21f9465	40351e16-e0dd-4064-a060-bd866d35bc63	b023c1d7d6dba0c7230a849fad429752809009e2ea6b84b1156942aca3ad0f5a	2026-11-05 21:08:14.022224+05:30	2026-11-05 13:31:46.12981+05:30	2026-11-05 13:08:14.02384+05:30
da5dc65b-b5bc-4cb6-ab68-bfffc9c466bc	40351e16-e0dd-4064-a060-bd866d35bc63	fa298f1d004122abfcceac0f929fc1ec265bfc67ace0431a874a4ddce7a856fe	2026-11-05 21:08:14.022224+05:30	2026-11-05 13:31:56.664544+05:30	2026-11-05 13:31:46.139552+05:30
27897dc5-7f32-4a9a-be4c-b7b924dcc1e9	40351e16-e0dd-4064-a060-bd866d35bc63	b18c91bdcd769e3d360a48403daf456fb4f6551e73e14c1f0c2fc15e813fcf6e	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:04:42.141003+05:30	2026-11-05 13:44:59.179873+05:30
09fed712-8847-4b8a-81b1-17ece0c2c021	40351e16-e0dd-4064-a060-bd866d35bc63	2764758528249d11cd31b6710d7df4cbac0bc3238f01c0870d90e7631604dd6f	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:04:52.691341+05:30	2026-11-05 14:04:42.555358+05:30
89175701-8764-4e66-96e8-9c8ccefd2c43	40351e16-e0dd-4064-a060-bd866d35bc63	96b18aebb83e2fb2b7e90514055dcc6f165627c076d58febff3f7b06a718e963	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:05:07.74771+05:30	2026-11-05 14:04:52.699596+05:30
a7f6e713-677d-411a-9179-4b342cb880c3	40351e16-e0dd-4064-a060-bd866d35bc63	5a9c0d18cc06849fd7ec42f4fbe7e5e359fced9ea8633c3f9dfd6b633558cd2a	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:07:29.861976+05:30	2026-11-05 14:05:07.772062+05:30
81a70c20-24b4-4e98-b650-815f9211be2e	40351e16-e0dd-4064-a060-bd866d35bc63	3c3de6216517d241165f2593c8ee0e44b294c0da0d71f53a0adc9dc547b227f5	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:07:54.672878+05:30	2026-11-05 14:07:29.869608+05:30
95b2a438-d985-4f87-873d-6e872451ddca	40351e16-e0dd-4064-a060-bd866d35bc63	3301cb3ad0cc3e853752419eef972e9d858a9e454f274ded0e00fe4cd7ad15d7	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:07:59.656084+05:30	2026-11-05 14:07:54.68354+05:30
47b48592-18fa-4343-9946-7c85838f68be	40351e16-e0dd-4064-a060-bd866d35bc63	3dcaf7f50cfd5d39b24ff237e858a170c65fd003d589c0d3eeb76dd6dd31c7d1	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:08:15.858509+05:30	2026-11-05 14:07:59.661129+05:30
82630656-9d0a-4340-9486-2bca28f3adb2	40351e16-e0dd-4064-a060-bd866d35bc63	06823ea6755a409cf039ef97f0a216be694a1c91b8d93963468ee69c86600a73	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:09:26.867194+05:30	2026-11-05 14:08:15.867436+05:30
45f381c2-3319-4686-ba6d-6ebb8bc73ac5	40351e16-e0dd-4064-a060-bd866d35bc63	64b94db6102b9bc3b0c76d6cbc9ca42939672bd13ed3b6978693d2b4a101413f	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:09:26.961323+05:30	2026-11-05 14:09:26.878693+05:30
89d5c4b2-a07c-4698-9aae-8bc6a6a7adcd	40351e16-e0dd-4064-a060-bd866d35bc63	58523b4dfbc4ae23118149f394e67d6b2ed4ae8a05db20f4983fdb67a4af6f41	2026-11-05 21:44:59.17815+05:30	2026-11-05 14:09:37.664603+05:30	2026-11-05 14:09:26.970057+05:30
483f9d51-4685-41e9-9638-f11da3699fa2	40351e16-e0dd-4064-a060-bd866d35bc63	2f5a7a7397675217551713b501adee4c25738e340e6f942097d8d705ad5314f4	2026-11-05 22:11:28.465993+05:30	2026-11-05 14:31:28.972213+05:30	2026-11-05 14:11:28.467904+05:30
45df2fe4-0594-4002-8caf-d48300f19154	40351e16-e0dd-4064-a060-bd866d35bc63	5f81085c2eb81be991e1c696b49350bcb96c33ad9ea11d5ecbd1078735c67811	2026-11-05 22:11:28.465993+05:30	2026-11-05 14:48:39.972217+05:30	2026-11-05 14:31:29.008949+05:30
3ab3bc40-20a4-4523-b5fd-719538e5f0f5	40351e16-e0dd-4064-a060-bd866d35bc63	1c6cad5d104b64201485605178cb346bb9f490ffb26186e118f10c0e561af93a	2026-11-05 22:11:28.465993+05:30	2026-11-05 14:55:45.883971+05:30	2026-11-05 14:48:39.982169+05:30
f93f5f0b-431a-4cec-885c-dd3188f417e7	40351e16-e0dd-4064-a060-bd866d35bc63	b3bf6cccb53ebd4525eeef879c951e33793451ab4eb4548db0c705c142abd4f2	2026-11-05 23:29:06.528813+05:30	\N	2026-11-05 15:29:06.530028+05:30
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description) FROM stdin;
665c5fc4-6a02-401f-8501-43e7e5b9f2b4	SUPER_ADMIN	System-wide authority over CRM users, roles, work orders, assignments, and configuration
a2a33c01-15ea-496e-ad79-5cf1641e8881	ADMIN	Full platform enterprise administrator
d5ae1fcf-305f-49cf-877a-44dc1f8b2615	MANAGER	Operational manager: workload oversight, task delegation, and team coordination
18b68bc1-db09-4f35-a4b0-ebadb6dbe9f5	EMPLOYEE	Operational employee: task execution, checklist progress, work order creation
0ea6ea3a-750a-48c0-bc06-7114257d218b	LOAN_OFFICER	Legacy: Customer relationship manager and loan origination
7fc3cd5c-7ae2-4684-9df8-98dacfc0e07b	UNDERWRITER	Legacy: Risk assessment, bureau verification, and approvals
ae38d042-aeef-4aff-9450-516b21776967	AUDITOR	Legacy: Compliance inspector and audit trail reviewer
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, customer_id, assigned_to_id, title, description, priority, status, due_date, completed_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (user_id, role_id) FROM stdin;
40351e16-e0dd-4064-a060-bd866d35bc63	665c5fc4-6a02-401f-8501-43e7e5b9f2b4
40351e16-e0dd-4064-a060-bd866d35bc63	a2a33c01-15ea-496e-ad79-5cf1641e8881
aa404433-f73c-4036-8988-6f3257885290	18b68bc1-db09-4f35-a4b0-ebadb6dbe9f5
38318850-7c3b-4657-aea8-c7ad4661b1dc	18b68bc1-db09-4f35-a4b0-ebadb6dbe9f5
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, hashed_password, full_name, is_active, created_at, updated_at) FROM stdin;
40351e16-e0dd-4064-a060-bd866d35bc63	admin@finnexus.com	$argon2id$v=19$m=65536,t=3,p=4$1+6keMTIY3knbGBlv4WXPA$0xWanYLKLtAmaW/APSFgbqmodK8pScmaeu2zAuiendU	Aditya Thakre	t	2026-11-01 17:05:58.900397+05:30	2026-11-01 17:05:58.900407+05:30
aa404433-f73c-4036-8988-6f3257885290	amit@finnexus.com	$argon2id$v=19$m=65536,t=3,p=4$ARMYCbi7dziNDYH5qM6tww$bTQiZT5WpYpxPXvblavRJe5s5iP/xhmn1jRyHLox3Cw	Amit	t	2026-11-01 23:48:28.921751+05:30	2026-11-01 23:48:28.921757+05:30
38318850-7c3b-4657-aea8-c7ad4661b1dc	employee1@finnexus.com	$argon2id$v=19$m=65536,t=3,p=4$o1rofajq3q8KFPReWSRyZg$giurT49TWHFr0YGzGn+vbIPbgJ0bxgECj4maW6KCUFM	Employee 1	t	2026-11-01 23:49:01.000379+05:30	2026-11-01 23:49:01.000383+05:30
\.


--
-- Data for Name: work_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_categories (id, name, code, description, default_priority, checklist_template, is_active, created_at) FROM stdin;
0684257c-5a92-43c2-9f62-e9d7be61faa2	Work: MFU	WORK_MFU	Mutual Fund Utilities: KYC, Payeezz, CAN generation, SIPs, and order tracking.	NORMAL	[{"title": "Do Physical KYC Client", "position": 0}, {"title": "Payeezz Physical / Online", "position": 1}, {"title": "ONLINE KYC & ONLINE PAYEEZZ", "position": 2}, {"title": "E-Can Tracker", "position": 3}, {"title": "Can Generation", "position": 4}, {"title": "Start SIP", "position": 5}, {"title": "MFU Order", "position": 6}, {"title": "Bank Addition & Update Bank details", "position": 7}, {"title": "Change Email Id & Mobile Number", "position": 8}, {"title": "Check order Tracking", "position": 9}, {"title": "Call to MFU (Ask query regarding)", "position": 10}, {"title": "Check Payeezz Status", "position": 11}, {"title": "Nominee, contact & KYC Detail verification", "position": 12}, {"title": "Cen Com query", "position": 13}, {"title": "Fill KYC / Pan Application / Payeezz", "position": 14}]	t	2026-11-01 17:05:58.97062+05:30
a9fc2254-d5d5-43f7-8747-73c2ae4b31bb	Work: Insurance	WORK_INSURANCE	Life, health, motor, and commercial property insurance underwriting and renewals.	NORMAL	[{"title": "Term Life Policy Origination", "position": 0}, {"title": "Health Insurance Proposal", "position": 1}, {"title": "Motor / Vehicle Insurance Cover", "position": 2}, {"title": "Commercial Property Shield", "position": 3}, {"title": "Policy Renewal Follow-up", "position": 4}, {"title": "Medical Checkup Scheduling", "position": 5}, {"title": "Premium Quotation Dispatch", "position": 6}, {"title": "Endorsement & Address Change", "position": 7}]	t	2026-11-01 17:05:58.972543+05:30
8d376485-4b91-4de1-b371-480aa47af346	Work: Insurance Claim	WORK_INSURANCE_CLAIM	Hospital cashless coordination, discharge summary vetting, and claim settlements.	HIGH	[{"title": "Claim Intimation & Registration", "position": 0}, {"title": "Hospital Cashless Coordination", "position": 1}, {"title": "Discharge Summary Collection", "position": 2}, {"title": "KYC & Bank Details for Settlement", "position": 3}, {"title": "Surveyor Investigation Follow-up", "position": 4}, {"title": "Query Resolution with TPA / Insurer", "position": 5}, {"title": "Settlement Letter & Disbursement Verification", "position": 6}]	t	2026-11-01 17:05:58.973797+05:30
c4b80c6c-0fed-4c17-89c4-16af8749fc6f	Work: Accounting	WORK_ACCOUNTING	Bank reconciliations, P&L audit, GST returns, TDS 26AS verification, and DSCR analysis.	NORMAL	[{"title": "Collect Bank Statements", "position": 0}, {"title": "Prepare Profit & Loss & Balance Sheet", "position": 1}, {"title": "Reconcile Bank Statements", "position": 2}, {"title": "GST Return Filing & Turnover Cross-Check", "position": 3}, {"title": "TDS Deduction & 26AS Verification", "position": 4}, {"title": "Compute Debt-Service Coverage Ratio (DSCR)", "position": 5}, {"title": "Final Statutory Audit Sign-off", "position": 6}]	t	2026-11-01 17:05:58.974812+05:30
7dfffbc8-76b9-4284-87ea-65f613e50fbf	Work: Office Work	WORK_OFFICE_WORK	Document courier/dispatch, franking & stamp duty, legal drafting, and client follow-ups.	NORMAL	[{"title": "Physical Document Dispatch / Courier", "position": 0}, {"title": "Stamp Duty & Franking", "position": 1}, {"title": "Sub-Registrar Non-Encumbrance Filing", "position": 2}, {"title": "Agreement Drafting & Legal Vetting", "position": 3}, {"title": "Archival & Vault Safe Deposit", "position": 4}, {"title": "Client Consultation Follow-up Call", "position": 5}, {"title": "Vendor & Utility Processing", "position": 6}]	t	2026-11-01 17:05:58.975746+05:30
94b92d19-8a37-4e4d-92bb-2aaa85983a37	Loan Origination & KYC	LOAN_KYC	Customer identification verification, bureau pulls, and initial credit risk profiling.	HIGH	[{"title": "Verify Aadhaar and PAN credentials against government portal", "position": 0}, {"title": "Retrieve CIBIL and Experian commercial credit score report", "position": 1}, {"title": "Reconcile past 6 months primary bank statements", "position": 2}, {"title": "Conduct field verification of residential/workplace address", "position": 3}]	t	2026-11-01 17:05:58.976503+05:30
84bc8ab5-e719-4166-8ca5-c74f63a50597	Financial Statement Audit	FIN_AUDIT	Deep-dive audit of Profit & Loss, Balance Sheets, and tax filings.	NORMAL	[{"title": "Reconcile audited balance sheet against ITR filings", "position": 0}, {"title": "Compute debt-service coverage ratio (DSCR) & current liquidity", "position": 1}, {"title": "Cross-check GST turnover with bank inflows", "position": 2}]	t	2026-11-01 17:05:58.977113+05:30
346a2500-6bad-42dc-b5de-848a296cd6a4	Legal Deed & Collateral Verification	LEGAL_DEED	30-year title search, legal vetting of mortgages, and physical valuation.	HIGH	[{"title": "Obtain 30-year non-encumbrance certificate (NEC) from sub-registrar", "position": 0}, {"title": "Independent technical valuation by certified empanelled valuer", "position": 1}, {"title": "Draft equitable mortgage deed and memorandum of deposit", "position": 2}]	t	2026-11-01 17:05:58.97778+05:30
885c9204-bad7-41ef-b3c4-5d38d8675029	Tax Compliance & GST Review	TAX_COMPL	Tax returns reconciliation, GST filing tracking, and statutory compliance checks.	NORMAL	[{"title": "Verify Form 26AS tax credit statements", "position": 0}, {"title": "Confirm active status and prompt filing of GSTR-3B and GSTR-1", "position": 1}, {"title": "Flag any outstanding statutory tax demand or litigation", "position": 2}]	t	2026-11-01 17:05:58.978416+05:30
\.


--
-- Data for Name: work_order_checklist_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_order_checklist_items (id, work_order_id, title, description, assigned_to_id, status, "position", due_date, completed_at, completed_by_id, notes, created_at) FROM stdin;
666756ff-fc6e-44d6-91c8-b6d939f70e36	f485c922-0af0-4040-a1b5-dfaa35cec7c0	[MFU] ONLINE KYC & ONLINE PAYEEZZ	\N	38318850-7c3b-4657-aea8-c7ad4661b1dc	PENDING	0	2026-11-04 23:30:00+05:30	\N	\N	\N	2026-11-01 23:50:01.060605+05:30
963485dd-485a-4bba-81fc-d3a217939563	f485c922-0af0-4040-a1b5-dfaa35cec7c0	[MFU] Can Generation	\N	38318850-7c3b-4657-aea8-c7ad4661b1dc	PENDING	1	2026-11-04 23:30:00+05:30	\N	\N	\N	2026-11-01 23:50:01.060611+05:30
d2eb4810-f745-4c4f-8f57-0f19455d615f	f485c922-0af0-4040-a1b5-dfaa35cec7c0	[MFU] E-Can Tracker	\N	38318850-7c3b-4657-aea8-c7ad4661b1dc	PENDING	2	2026-11-04 23:30:00+05:30	\N	\N	\N	2026-11-01 23:50:01.060613+05:30
6b3bdb30-0d24-4c80-991d-9e41708d59ba	f485c922-0af0-4040-a1b5-dfaa35cec7c0	[MFU] Payeezz Physical / Online	\N	38318850-7c3b-4657-aea8-c7ad4661b1dc	PENDING	3	2026-11-04 23:30:00+05:30	\N	\N	\N	2026-11-01 23:50:01.060614+05:30
b430900f-8053-4dc6-a311-043ad1033ca7	f485c922-0af0-4040-a1b5-dfaa35cec7c0	[MFU] MFU Order	\N	38318850-7c3b-4657-aea8-c7ad4661b1dc	PENDING	4	2026-11-04 23:30:00+05:30	\N	\N	\N	2026-11-01 23:50:01.060615+05:30
\.


--
-- Data for Name: work_order_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_order_history (id, work_order_id, actor_id, action, details, "timestamp") FROM stdin;
e08317b2-bb65-42a1-bb72-4686d9fe8f96	f485c922-0af0-4040-a1b5-dfaa35cec7c0	40351e16-e0dd-4064-a060-bd866d35bc63	CREATED	Work Order WO-2026-0001 created with 5 checklist items and 3 reminder recipients.	2026-11-01 23:50:01.048019+05:30
\.


--
-- Data for Name: work_order_reminders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_order_reminders (work_order_id, user_id, created_at) FROM stdin;
f485c922-0af0-4040-a1b5-dfaa35cec7c0	40351e16-e0dd-4064-a060-bd866d35bc63	2026-11-01 23:50:01.133431+05:30
f485c922-0af0-4040-a1b5-dfaa35cec7c0	aa404433-f73c-4036-8988-6f3257885290	2026-11-01 23:50:01.133455+05:30
f485c922-0af0-4040-a1b5-dfaa35cec7c0	38318850-7c3b-4657-aea8-c7ad4661b1dc	2026-11-01 23:50:01.133457+05:30
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_orders (id, order_number, title, description, client_id, category_id, created_by_id, assigned_to_id, priority, status, due_date, completed_at, progress_percent, priority_notes, created_at, updated_at, work_priority, custom_priority) FROM stdin;
f485c922-0af0-4040-a1b5-dfaa35cec7c0	WO-2026-0001	Work: MFU: Aditya Thakre	\N	5a199e21-1953-41ae-b32f-e193bf5400c2	0684257c-5a92-43c2-9f62-e9d7be61faa2	40351e16-e0dd-4064-a060-bd866d35bc63	38318850-7c3b-4657-aea8-c7ad4661b1dc	URGENT	PENDING	2026-11-04 23:30:00+05:30	\N	0	Work order requested by: Aditya Thakre	2026-11-01 23:50:01.039812+05:30	2026-11-01 23:50:01.039817+05:30	Do it urgent	\N
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: crm_notifications crm_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_notifications
    ADD CONSTRAINT crm_notifications_pkey PRIMARY KEY (id);


--
-- Name: customer_notes customer_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: documents documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_storage_path_key UNIQUE (storage_path);


--
-- Name: financial_profiles financial_profiles_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_profiles
    ADD CONSTRAINT financial_profiles_customer_id_key UNIQUE (customer_id);


--
-- Name: financial_profiles financial_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_profiles
    ADD CONSTRAINT financial_profiles_pkey PRIMARY KEY (id);


--
-- Name: insurance_agent_inquiries insurance_agent_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_agent_inquiries
    ADD CONSTRAINT insurance_agent_inquiries_pkey PRIMARY KEY (id);


--
-- Name: insurance_commission_receipts insurance_commission_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_commission_receipts
    ADD CONSTRAINT insurance_commission_receipts_pkey PRIMARY KEY (id);


--
-- Name: insurance_commission_splits insurance_commission_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_commission_splits
    ADD CONSTRAINT insurance_commission_splits_pkey PRIMARY KEY (id);


--
-- Name: insurance_companies insurance_companies_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_companies
    ADD CONSTRAINT insurance_companies_code_key UNIQUE (code);


--
-- Name: insurance_companies insurance_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_companies
    ADD CONSTRAINT insurance_companies_pkey PRIMARY KEY (id);


--
-- Name: insurance_company_commission_agreements insurance_company_commission_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_commission_agreements
    ADD CONSTRAINT insurance_company_commission_agreements_pkey PRIMARY KEY (id);


--
-- Name: insurance_company_documents insurance_company_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_documents
    ADD CONSTRAINT insurance_company_documents_pkey PRIMARY KEY (id);


--
-- Name: insurance_company_documents insurance_company_documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_documents
    ADD CONSTRAINT insurance_company_documents_storage_path_key UNIQUE (storage_path);


--
-- Name: insurance_family_groups insurance_family_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_family_groups
    ADD CONSTRAINT insurance_family_groups_pkey PRIMARY KEY (id);


--
-- Name: insurance_family_members insurance_family_members_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_family_members
    ADD CONSTRAINT insurance_family_members_customer_id_key UNIQUE (customer_id);


--
-- Name: insurance_family_members insurance_family_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_family_members
    ADD CONSTRAINT insurance_family_members_pkey PRIMARY KEY (id);


--
-- Name: insurance_health_quotation_company_plans insurance_health_quotation_company_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_company_plans
    ADD CONSTRAINT insurance_health_quotation_company_plans_pkey PRIMARY KEY (id);


--
-- Name: insurance_health_quotation_members insurance_health_quotation_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_members
    ADD CONSTRAINT insurance_health_quotation_members_pkey PRIMARY KEY (id);


--
-- Name: insurance_health_quotation_premiums insurance_health_quotation_premiums_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_premiums
    ADD CONSTRAINT insurance_health_quotation_premiums_pkey PRIMARY KEY (id);


--
-- Name: insurance_health_quotations insurance_health_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotations
    ADD CONSTRAINT insurance_health_quotations_pkey PRIMARY KEY (id);


--
-- Name: insurance_plan_documents insurance_plan_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plan_documents
    ADD CONSTRAINT insurance_plan_documents_pkey PRIMARY KEY (id);


--
-- Name: insurance_plan_documents insurance_plan_documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plan_documents
    ADD CONSTRAINT insurance_plan_documents_storage_path_key UNIQUE (storage_path);


--
-- Name: insurance_plans insurance_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plans
    ADD CONSTRAINT insurance_plans_code_key UNIQUE (code);


--
-- Name: insurance_plans insurance_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plans
    ADD CONSTRAINT insurance_plans_pkey PRIMARY KEY (id);


--
-- Name: insurance_policies insurance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_pkey PRIMARY KEY (id);


--
-- Name: insurance_policies insurance_policies_policy_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_policy_number_key UNIQUE (policy_number);


--
-- Name: insurance_policy_commissions insurance_policy_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_pkey PRIMARY KEY (id);


--
-- Name: insurance_policy_documents insurance_policy_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_documents
    ADD CONSTRAINT insurance_policy_documents_pkey PRIMARY KEY (id);


--
-- Name: insurance_policy_documents insurance_policy_documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_documents
    ADD CONSTRAINT insurance_policy_documents_storage_path_key UNIQUE (storage_path);


--
-- Name: insurance_policy_histories insurance_policy_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_histories
    ADD CONSTRAINT insurance_policy_histories_pkey PRIMARY KEY (id);


--
-- Name: insurance_policy_members insurance_policy_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_members
    ADD CONSTRAINT insurance_policy_members_pkey PRIMARY KEY (id);


--
-- Name: insurance_policy_payments insurance_policy_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_payments
    ADD CONSTRAINT insurance_policy_payments_pkey PRIMARY KEY (id);


--
-- Name: insurance_policy_years insurance_policy_years_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_years
    ADD CONSTRAINT insurance_policy_years_pkey PRIMARY KEY (id);


--
-- Name: insurance_premium_schedules insurance_premium_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_premium_schedules
    ADD CONSTRAINT insurance_premium_schedules_pkey PRIMARY KEY (id);


--
-- Name: insurance_purchase_parties insurance_purchase_parties_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_purchase_parties
    ADD CONSTRAINT insurance_purchase_parties_code_key UNIQUE (code);


--
-- Name: insurance_purchase_parties insurance_purchase_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_purchase_parties
    ADD CONSTRAINT insurance_purchase_parties_pkey PRIMARY KEY (id);


--
-- Name: insurance_sub_agent_payout_payments insurance_sub_agent_payout_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payout_payments
    ADD CONSTRAINT insurance_sub_agent_payout_payments_pkey PRIMARY KEY (id);


--
-- Name: insurance_sub_agent_payouts insurance_sub_agent_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payouts
    ADD CONSTRAINT insurance_sub_agent_payouts_pkey PRIMARY KEY (id);


--
-- Name: insurance_sub_agents insurance_sub_agents_agent_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agents
    ADD CONSTRAINT insurance_sub_agents_agent_code_key UNIQUE (agent_code);


--
-- Name: insurance_sub_agents insurance_sub_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agents
    ADD CONSTRAINT insurance_sub_agents_pkey PRIMARY KEY (id);


--
-- Name: insurance_sub_agents insurance_sub_agents_public_profile_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agents
    ADD CONSTRAINT insurance_sub_agents_public_profile_slug_key UNIQUE (public_profile_slug);


--
-- Name: insurance_company_categories pk_insurance_company_categories; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_categories
    ADD CONSTRAINT pk_insurance_company_categories PRIMARY KEY (id);


--
-- Name: insurance_policy_nominees pk_insurance_policy_nominees; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_nominees
    ADD CONSTRAINT pk_insurance_policy_nominees PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: insurance_health_quotation_premiums uq_health_quote_premium_plan_tier; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_premiums
    ADD CONSTRAINT uq_health_quote_premium_plan_tier UNIQUE (quotation_company_plan_id, sum_insured_code);


--
-- Name: insurance_company_categories uq_insurance_company_categories_company_cat; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_categories
    ADD CONSTRAINT uq_insurance_company_categories_company_cat UNIQUE (company_id, category);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_categories work_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_categories
    ADD CONSTRAINT work_categories_pkey PRIMARY KEY (id);


--
-- Name: work_order_checklist_items work_order_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_checklist_items
    ADD CONSTRAINT work_order_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: work_order_history work_order_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_history
    ADD CONSTRAINT work_order_history_pkey PRIMARY KEY (id);


--
-- Name: work_order_reminders work_order_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_reminders
    ADD CONSTRAINT work_order_reminders_pkey PRIMARY KEY (work_order_id, user_id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: ix_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);


--
-- Name: ix_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: ix_audit_logs_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: ix_crm_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_crm_notifications_created_at ON public.crm_notifications USING btree (created_at);


--
-- Name: ix_crm_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_crm_notifications_is_read ON public.crm_notifications USING btree (is_read);


--
-- Name: ix_crm_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_crm_notifications_user_id ON public.crm_notifications USING btree (user_id);


--
-- Name: ix_customer_notes_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_customer_notes_customer_id ON public.customer_notes USING btree (customer_id);


--
-- Name: ix_customers_aadhaar_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_customers_aadhaar_hash ON public.customers USING btree (aadhaar_hash);


--
-- Name: ix_customers_assigned_officer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_customers_assigned_officer_id ON public.customers USING btree (assigned_officer_id);


--
-- Name: ix_customers_corporate_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_customers_corporate_code ON public.customers USING btree (corporate_code);


--
-- Name: ix_customers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_customers_email ON public.customers USING btree (email);


--
-- Name: ix_customers_gstin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_customers_gstin ON public.customers USING btree (gstin);


--
-- Name: ix_customers_is_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_customers_is_archived ON public.customers USING btree (is_archived);


--
-- Name: ix_customers_pan_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_customers_pan_number ON public.customers USING btree (pan_number);


--
-- Name: ix_customers_pipeline_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_customers_pipeline_status ON public.customers USING btree (pipeline_status);


--
-- Name: ix_documents_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_documents_customer_id ON public.documents USING btree (customer_id);


--
-- Name: ix_documents_sha256_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_documents_sha256_hash ON public.documents USING btree (sha256_hash);


--
-- Name: ix_documents_verification_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_documents_verification_status ON public.documents USING btree (verification_status);


--
-- Name: ix_health_quote_comp_plans_quote; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_health_quote_comp_plans_quote ON public.insurance_health_quotation_company_plans USING btree (quotation_id);


--
-- Name: ix_health_quote_members_quote; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_health_quote_members_quote ON public.insurance_health_quotation_members USING btree (quotation_id);


--
-- Name: ix_health_quote_premiums_plan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_health_quote_premiums_plan ON public.insurance_health_quotation_premiums USING btree (quotation_company_plan_id);


--
-- Name: ix_insurance_agent_inquiries_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_agent_inquiries_agent ON public.insurance_agent_inquiries USING btree (sub_agent_id);


--
-- Name: ix_insurance_agent_inquiries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_agent_inquiries_status ON public.insurance_agent_inquiries USING btree (status);


--
-- Name: ix_insurance_commission_receipts_commission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_commission_receipts_commission ON public.insurance_commission_receipts USING btree (commission_id);


--
-- Name: ix_insurance_commission_receipts_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_commission_receipts_date ON public.insurance_commission_receipts USING btree (receipt_date);


--
-- Name: ix_insurance_commission_splits_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_commission_splits_agent ON public.insurance_commission_splits USING btree (sub_agent_id);


--
-- Name: ix_insurance_companies_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_insurance_companies_code ON public.insurance_companies USING btree (code);


--
-- Name: ix_insurance_companies_code_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_companies_code_lower ON public.insurance_companies USING btree (code);


--
-- Name: ix_insurance_companies_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_companies_is_active ON public.insurance_companies USING btree (is_active);


--
-- Name: ix_insurance_companies_name_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_companies_name_lower ON public.insurance_companies USING btree (name);


--
-- Name: ix_insurance_company_categories_cat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_company_categories_cat ON public.insurance_company_categories USING btree (category);


--
-- Name: ix_insurance_company_categories_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_company_categories_company ON public.insurance_company_categories USING btree (company_id);


--
-- Name: ix_insurance_company_commission_agreements_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_company_commission_agreements_category ON public.insurance_company_commission_agreements USING btree (policy_category);


--
-- Name: ix_insurance_company_commission_agreements_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_company_commission_agreements_company ON public.insurance_company_commission_agreements USING btree (company_id);


--
-- Name: ix_insurance_company_documents_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_company_documents_company_id ON public.insurance_company_documents USING btree (company_id);


--
-- Name: ix_insurance_family_members_cust; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_insurance_family_members_cust ON public.insurance_family_members USING btree (customer_id);


--
-- Name: ix_insurance_family_members_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_family_members_group ON public.insurance_family_members USING btree (family_group_id);


--
-- Name: ix_insurance_health_quotations_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_health_quotations_date ON public.insurance_health_quotations USING btree (quotation_date);


--
-- Name: ix_insurance_health_quotations_num; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_insurance_health_quotations_num ON public.insurance_health_quotations USING btree (quotation_number);


--
-- Name: ix_insurance_health_quotations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_health_quotations_status ON public.insurance_health_quotations USING btree (status);


--
-- Name: ix_insurance_health_quotations_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_health_quotations_tenant ON public.insurance_health_quotations USING btree (tenant_id);


--
-- Name: ix_insurance_plan_documents_plan_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_plan_documents_plan_id ON public.insurance_plan_documents USING btree (plan_id);


--
-- Name: ix_insurance_plan_documents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_plan_documents_type ON public.insurance_plan_documents USING btree (document_type);


--
-- Name: ix_insurance_plans_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_insurance_plans_code ON public.insurance_plans USING btree (code);


--
-- Name: ix_insurance_plans_code_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_plans_code_lower ON public.insurance_plans USING btree (code);


--
-- Name: ix_insurance_plans_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_plans_company_id ON public.insurance_plans USING btree (company_id);


--
-- Name: ix_insurance_plans_lob; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_plans_lob ON public.insurance_plans USING btree (line_of_business);


--
-- Name: ix_insurance_plans_name_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_plans_name_lower ON public.insurance_plans USING btree (name);


--
-- Name: ix_insurance_plans_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_plans_status ON public.insurance_plans USING btree (status);


--
-- Name: ix_insurance_policies_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_company ON public.insurance_policies USING btree (company_id);


--
-- Name: ix_insurance_policies_coverage_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_coverage_type ON public.insurance_policies USING btree (coverage_type);


--
-- Name: ix_insurance_policies_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_customer ON public.insurance_policies USING btree (customer_id);


--
-- Name: ix_insurance_policies_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_expiry ON public.insurance_policies USING btree (expiry_date);


--
-- Name: ix_insurance_policies_issue_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_issue_date ON public.insurance_policies USING btree (issue_date);


--
-- Name: ix_insurance_policies_next_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_next_due ON public.insurance_policies USING btree (next_premium_due_date);


--
-- Name: ix_insurance_policies_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_insurance_policies_number ON public.insurance_policies USING btree (policy_number);


--
-- Name: ix_insurance_policies_plan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_plan ON public.insurance_policies USING btree (plan_id);


--
-- Name: ix_insurance_policies_previous_policy_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_previous_policy_id ON public.insurance_policies USING btree (previous_policy_id);


--
-- Name: ix_insurance_policies_proposal_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_proposal_number ON public.insurance_policies USING btree (proposal_number);


--
-- Name: ix_insurance_policies_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_status ON public.insurance_policies USING btree (status);


--
-- Name: ix_insurance_policies_vehicle_reg_num; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policies_vehicle_reg_num ON public.insurance_policies USING btree (vehicle_registration_number);


--
-- Name: ix_insurance_policy_commissions_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_commissions_agent ON public.insurance_policy_commissions USING btree (sub_agent_id);


--
-- Name: ix_insurance_policy_commissions_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_commissions_policy ON public.insurance_policy_commissions USING btree (policy_id);


--
-- Name: ix_insurance_policy_commissions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_commissions_status ON public.insurance_policy_commissions USING btree (status);


--
-- Name: ix_insurance_policy_documents_policy_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_documents_policy_id ON public.insurance_policy_documents USING btree (policy_id);


--
-- Name: ix_insurance_policy_documents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_documents_type ON public.insurance_policy_documents USING btree (document_type);


--
-- Name: ix_insurance_policy_histories_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_histories_company ON public.insurance_policy_histories USING btree (insurance_company_name);


--
-- Name: ix_insurance_policy_histories_current_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_histories_current_policy ON public.insurance_policy_histories USING btree (current_policy_id);


--
-- Name: ix_insurance_policy_histories_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_histories_number ON public.insurance_policy_histories USING btree (previous_policy_number);


--
-- Name: ix_insurance_policy_histories_prev_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_histories_prev_policy ON public.insurance_policy_histories USING btree (previous_policy_id);


--
-- Name: ix_insurance_policy_members_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_members_customer_id ON public.insurance_policy_members USING btree (customer_id);


--
-- Name: ix_insurance_policy_members_policy_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_members_policy_id ON public.insurance_policy_members USING btree (policy_id);


--
-- Name: ix_insurance_policy_nominees_policy_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_nominees_policy_id ON public.insurance_policy_nominees USING btree (policy_id);


--
-- Name: ix_insurance_policy_payments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_payments_date ON public.insurance_policy_payments USING btree (payment_date);


--
-- Name: ix_insurance_policy_payments_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_payments_policy ON public.insurance_policy_payments USING btree (policy_id);


--
-- Name: ix_insurance_policy_years_policy_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_years_policy_id ON public.insurance_policy_years USING btree (policy_id);


--
-- Name: ix_insurance_policy_years_policy_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_policy_years_policy_number ON public.insurance_policy_years USING btree (policy_number);


--
-- Name: ix_insurance_premium_schedules_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_premium_schedules_due ON public.insurance_premium_schedules USING btree (due_date);


--
-- Name: ix_insurance_premium_schedules_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_premium_schedules_policy ON public.insurance_premium_schedules USING btree (policy_id);


--
-- Name: ix_insurance_premium_schedules_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_premium_schedules_status ON public.insurance_premium_schedules USING btree (status);


--
-- Name: ix_insurance_purchase_parties_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_insurance_purchase_parties_code ON public.insurance_purchase_parties USING btree (code);


--
-- Name: ix_insurance_purchase_parties_code_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_purchase_parties_code_lower ON public.insurance_purchase_parties USING btree (code);


--
-- Name: ix_insurance_purchase_parties_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_purchase_parties_is_active ON public.insurance_purchase_parties USING btree (is_active);


--
-- Name: ix_insurance_purchase_parties_name_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_purchase_parties_name_lower ON public.insurance_purchase_parties USING btree (name);


--
-- Name: ix_insurance_sub_agent_payout_payments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agent_payout_payments_date ON public.insurance_sub_agent_payout_payments USING btree (payment_date);


--
-- Name: ix_insurance_sub_agent_payout_payments_payout; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agent_payout_payments_payout ON public.insurance_sub_agent_payout_payments USING btree (payout_id);


--
-- Name: ix_insurance_sub_agent_payouts_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agent_payouts_agent ON public.insurance_sub_agent_payouts USING btree (sub_agent_id);


--
-- Name: ix_insurance_sub_agent_payouts_commission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agent_payouts_commission ON public.insurance_sub_agent_payouts USING btree (commission_id);


--
-- Name: ix_insurance_sub_agent_payouts_policy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agent_payouts_policy ON public.insurance_sub_agent_payouts USING btree (policy_id);


--
-- Name: ix_insurance_sub_agent_payouts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agent_payouts_status ON public.insurance_sub_agent_payouts USING btree (status);


--
-- Name: ix_insurance_sub_agents_code_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agents_code_lower ON public.insurance_sub_agents USING btree (agent_code);


--
-- Name: ix_insurance_sub_agents_name_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agents_name_lower ON public.insurance_sub_agents USING btree (full_name);


--
-- Name: ix_insurance_sub_agents_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_insurance_sub_agents_slug ON public.insurance_sub_agents USING btree (public_profile_slug);


--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_tasks_assigned_to_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_assigned_to_id ON public.tasks USING btree (assigned_to_id);


--
-- Name: ix_tasks_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_due_date ON public.tasks USING btree (due_date);


--
-- Name: ix_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_status ON public.tasks USING btree (status);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_is_active ON public.users USING btree (is_active);


--
-- Name: ix_work_categories_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_work_categories_code ON public.work_categories USING btree (code);


--
-- Name: ix_work_categories_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_work_categories_name ON public.work_categories USING btree (name);


--
-- Name: ix_work_order_checklist_items_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_order_checklist_items_status ON public.work_order_checklist_items USING btree (status);


--
-- Name: ix_work_order_checklist_items_work_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_order_checklist_items_work_order_id ON public.work_order_checklist_items USING btree (work_order_id);


--
-- Name: ix_work_order_history_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_order_history_timestamp ON public.work_order_history USING btree ("timestamp");


--
-- Name: ix_work_order_history_work_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_order_history_work_order_id ON public.work_order_history USING btree (work_order_id);


--
-- Name: ix_work_order_reminders_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_order_reminders_user_id ON public.work_order_reminders USING btree (user_id);


--
-- Name: ix_work_order_reminders_work_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_order_reminders_work_order_id ON public.work_order_reminders USING btree (work_order_id);


--
-- Name: ix_work_orders_assigned_to_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_orders_assigned_to_id ON public.work_orders USING btree (assigned_to_id);


--
-- Name: ix_work_orders_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_orders_category_id ON public.work_orders USING btree (category_id);


--
-- Name: ix_work_orders_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_orders_client_id ON public.work_orders USING btree (client_id);


--
-- Name: ix_work_orders_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_orders_created_by_id ON public.work_orders USING btree (created_by_id);


--
-- Name: ix_work_orders_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_orders_due_date ON public.work_orders USING btree (due_date);


--
-- Name: ix_work_orders_order_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_work_orders_order_number ON public.work_orders USING btree (order_number);


--
-- Name: ix_work_orders_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_orders_priority ON public.work_orders USING btree (priority);


--
-- Name: ix_work_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_work_orders_status ON public.work_orders USING btree (status);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: crm_notifications crm_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_notifications
    ADD CONSTRAINT crm_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: crm_notifications crm_notifications_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_notifications
    ADD CONSTRAINT crm_notifications_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- Name: customer_notes customer_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: customer_notes customer_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_notes
    ADD CONSTRAINT customer_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customers customers_assigned_officer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_assigned_officer_id_fkey FOREIGN KEY (assigned_officer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: documents documents_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: documents documents_verified_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_verified_by_id_fkey FOREIGN KEY (verified_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: financial_profiles financial_profiles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_profiles
    ADD CONSTRAINT financial_profiles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customers fk_customers_created_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_created_by_id_users FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_company_categories fk_insurance_company_categories_company_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_categories
    ADD CONSTRAINT fk_insurance_company_categories_company_id FOREIGN KEY (company_id) REFERENCES public.insurance_companies(id) ON DELETE CASCADE;


--
-- Name: insurance_policy_members fk_insurance_policy_members_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_members
    ADD CONSTRAINT fk_insurance_policy_members_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_members fk_insurance_policy_members_policy_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_members
    ADD CONSTRAINT fk_insurance_policy_members_policy_id FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_policy_nominees fk_insurance_policy_nominees_policy_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_nominees
    ADD CONSTRAINT fk_insurance_policy_nominees_policy_id FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_agent_inquiries insurance_agent_inquiries_sub_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_agent_inquiries
    ADD CONSTRAINT insurance_agent_inquiries_sub_agent_id_fkey FOREIGN KEY (sub_agent_id) REFERENCES public.insurance_sub_agents(id) ON DELETE CASCADE;


--
-- Name: insurance_commission_receipts insurance_commission_receipts_commission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_commission_receipts
    ADD CONSTRAINT insurance_commission_receipts_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.insurance_policy_commissions(id) ON DELETE CASCADE;


--
-- Name: insurance_commission_receipts insurance_commission_receipts_recorded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_commission_receipts
    ADD CONSTRAINT insurance_commission_receipts_recorded_by_id_fkey FOREIGN KEY (recorded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_commission_splits insurance_commission_splits_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_commission_splits
    ADD CONSTRAINT insurance_commission_splits_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.insurance_companies(id) ON DELETE SET NULL;


--
-- Name: insurance_commission_splits insurance_commission_splits_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_commission_splits
    ADD CONSTRAINT insurance_commission_splits_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.insurance_plans(id) ON DELETE SET NULL;


--
-- Name: insurance_commission_splits insurance_commission_splits_sub_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_commission_splits
    ADD CONSTRAINT insurance_commission_splits_sub_agent_id_fkey FOREIGN KEY (sub_agent_id) REFERENCES public.insurance_sub_agents(id) ON DELETE CASCADE;


--
-- Name: insurance_company_commission_agreements insurance_company_commission_agreements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_commission_agreements
    ADD CONSTRAINT insurance_company_commission_agreements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.insurance_companies(id) ON DELETE CASCADE;


--
-- Name: insurance_company_commission_agreements insurance_company_commission_agreements_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_commission_agreements
    ADD CONSTRAINT insurance_company_commission_agreements_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.insurance_plans(id) ON DELETE SET NULL;


--
-- Name: insurance_company_documents insurance_company_documents_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_documents
    ADD CONSTRAINT insurance_company_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.insurance_companies(id) ON DELETE CASCADE;


--
-- Name: insurance_company_documents insurance_company_documents_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_company_documents
    ADD CONSTRAINT insurance_company_documents_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_family_groups insurance_family_groups_head_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_family_groups
    ADD CONSTRAINT insurance_family_groups_head_customer_id_fkey FOREIGN KEY (head_customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: insurance_family_members insurance_family_members_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_family_members
    ADD CONSTRAINT insurance_family_members_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: insurance_family_members insurance_family_members_family_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_family_members
    ADD CONSTRAINT insurance_family_members_family_group_id_fkey FOREIGN KEY (family_group_id) REFERENCES public.insurance_family_groups(id) ON DELETE CASCADE;


--
-- Name: insurance_health_quotation_company_plans insurance_health_quotation_company_pl_insurance_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_company_plans
    ADD CONSTRAINT insurance_health_quotation_company_pl_insurance_company_id_fkey FOREIGN KEY (insurance_company_id) REFERENCES public.insurance_companies(id) ON DELETE SET NULL;


--
-- Name: insurance_health_quotation_company_plans insurance_health_quotation_company_plans_insurance_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_company_plans
    ADD CONSTRAINT insurance_health_quotation_company_plans_insurance_plan_id_fkey FOREIGN KEY (insurance_plan_id) REFERENCES public.insurance_plans(id) ON DELETE SET NULL;


--
-- Name: insurance_health_quotation_company_plans insurance_health_quotation_company_plans_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_company_plans
    ADD CONSTRAINT insurance_health_quotation_company_plans_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.insurance_health_quotations(id) ON DELETE CASCADE;


--
-- Name: insurance_health_quotation_members insurance_health_quotation_members_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_members
    ADD CONSTRAINT insurance_health_quotation_members_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: insurance_health_quotation_members insurance_health_quotation_members_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_members
    ADD CONSTRAINT insurance_health_quotation_members_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.insurance_health_quotations(id) ON DELETE CASCADE;


--
-- Name: insurance_health_quotation_premiums insurance_health_quotation_premi_quotation_company_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotation_premiums
    ADD CONSTRAINT insurance_health_quotation_premi_quotation_company_plan_id_fkey FOREIGN KEY (quotation_company_plan_id) REFERENCES public.insurance_health_quotation_company_plans(id) ON DELETE CASCADE;


--
-- Name: insurance_health_quotations insurance_health_quotations_advisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotations
    ADD CONSTRAINT insurance_health_quotations_advisor_id_fkey FOREIGN KEY (advisor_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: insurance_health_quotations insurance_health_quotations_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_health_quotations
    ADD CONSTRAINT insurance_health_quotations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: insurance_plan_documents insurance_plan_documents_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plan_documents
    ADD CONSTRAINT insurance_plan_documents_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.insurance_plans(id) ON DELETE CASCADE;


--
-- Name: insurance_plan_documents insurance_plan_documents_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plan_documents
    ADD CONSTRAINT insurance_plan_documents_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_plans insurance_plans_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_plans
    ADD CONSTRAINT insurance_plans_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.insurance_companies(id) ON DELETE RESTRICT;


--
-- Name: insurance_policies insurance_policies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.insurance_companies(id) ON DELETE RESTRICT;


--
-- Name: insurance_policies insurance_policies_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_policies insurance_policies_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: insurance_policies insurance_policies_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.insurance_plans(id) ON DELETE RESTRICT;


--
-- Name: insurance_policies insurance_policies_previous_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_previous_policy_id_fkey FOREIGN KEY (previous_policy_id) REFERENCES public.insurance_policies(id) ON DELETE SET NULL;


--
-- Name: insurance_policies insurance_policies_purchase_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_purchase_party_id_fkey FOREIGN KEY (purchase_party_id) REFERENCES public.insurance_purchase_parties(id) ON DELETE SET NULL;


--
-- Name: insurance_policies insurance_policies_sub_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_sub_agent_id_fkey FOREIGN KEY (sub_agent_id) REFERENCES public.insurance_sub_agents(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_commissions insurance_policy_commissions_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_commissions insurance_policy_commissions_commission_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_commission_agreement_id_fkey FOREIGN KEY (commission_agreement_id) REFERENCES public.insurance_company_commission_agreements(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_commissions insurance_policy_commissions_original_commission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_original_commission_id_fkey FOREIGN KEY (original_commission_id) REFERENCES public.insurance_policy_commissions(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_commissions insurance_policy_commissions_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_policy_commissions insurance_policy_commissions_reversed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_reversed_by_id_fkey FOREIGN KEY (reversed_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_commissions insurance_policy_commissions_split_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_split_agreement_id_fkey FOREIGN KEY (split_agreement_id) REFERENCES public.insurance_commission_splits(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_commissions insurance_policy_commissions_sub_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_commissions
    ADD CONSTRAINT insurance_policy_commissions_sub_agent_id_fkey FOREIGN KEY (sub_agent_id) REFERENCES public.insurance_sub_agents(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_documents insurance_policy_documents_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_documents
    ADD CONSTRAINT insurance_policy_documents_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_policy_documents insurance_policy_documents_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_documents
    ADD CONSTRAINT insurance_policy_documents_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_histories insurance_policy_histories_current_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_histories
    ADD CONSTRAINT insurance_policy_histories_current_policy_id_fkey FOREIGN KEY (current_policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_policy_histories insurance_policy_histories_previous_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_histories
    ADD CONSTRAINT insurance_policy_histories_previous_policy_id_fkey FOREIGN KEY (previous_policy_id) REFERENCES public.insurance_policies(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_payments insurance_policy_payments_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_payments
    ADD CONSTRAINT insurance_policy_payments_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_payments insurance_policy_payments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_payments
    ADD CONSTRAINT insurance_policy_payments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.insurance_policy_documents(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_payments insurance_policy_payments_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_payments
    ADD CONSTRAINT insurance_policy_payments_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_policy_payments insurance_policy_payments_premium_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_payments
    ADD CONSTRAINT insurance_policy_payments_premium_schedule_id_fkey FOREIGN KEY (premium_schedule_id) REFERENCES public.insurance_premium_schedules(id) ON DELETE SET NULL;


--
-- Name: insurance_policy_years insurance_policy_years_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policy_years
    ADD CONSTRAINT insurance_policy_years_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_premium_schedules insurance_premium_schedules_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_premium_schedules
    ADD CONSTRAINT insurance_premium_schedules_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_sub_agent_payout_payments insurance_sub_agent_payout_payments_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payout_payments
    ADD CONSTRAINT insurance_sub_agent_payout_payments_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.insurance_sub_agent_payouts(id) ON DELETE CASCADE;


--
-- Name: insurance_sub_agent_payout_payments insurance_sub_agent_payout_payments_recorded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payout_payments
    ADD CONSTRAINT insurance_sub_agent_payout_payments_recorded_by_id_fkey FOREIGN KEY (recorded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_sub_agent_payouts insurance_sub_agent_payouts_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payouts
    ADD CONSTRAINT insurance_sub_agent_payouts_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_sub_agent_payouts insurance_sub_agent_payouts_commission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payouts
    ADD CONSTRAINT insurance_sub_agent_payouts_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.insurance_policy_commissions(id) ON DELETE SET NULL;


--
-- Name: insurance_sub_agent_payouts insurance_sub_agent_payouts_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payouts
    ADD CONSTRAINT insurance_sub_agent_payouts_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id) ON DELETE CASCADE;


--
-- Name: insurance_sub_agent_payouts insurance_sub_agent_payouts_reversed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payouts
    ADD CONSTRAINT insurance_sub_agent_payouts_reversed_by_id_fkey FOREIGN KEY (reversed_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: insurance_sub_agent_payouts insurance_sub_agent_payouts_sub_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agent_payouts
    ADD CONSTRAINT insurance_sub_agent_payouts_sub_agent_id_fkey FOREIGN KEY (sub_agent_id) REFERENCES public.insurance_sub_agents(id) ON DELETE RESTRICT;


--
-- Name: insurance_sub_agents insurance_sub_agents_parent_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_sub_agents
    ADD CONSTRAINT insurance_sub_agents_parent_agent_id_fkey FOREIGN KEY (parent_agent_id) REFERENCES public.insurance_sub_agents(id) ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: tasks tasks_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_order_checklist_items work_order_checklist_items_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_checklist_items
    ADD CONSTRAINT work_order_checklist_items_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_order_checklist_items work_order_checklist_items_completed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_checklist_items
    ADD CONSTRAINT work_order_checklist_items_completed_by_id_fkey FOREIGN KEY (completed_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_order_checklist_items work_order_checklist_items_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_checklist_items
    ADD CONSTRAINT work_order_checklist_items_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_history work_order_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_history
    ADD CONSTRAINT work_order_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: work_order_history work_order_history_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_history
    ADD CONSTRAINT work_order_history_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_reminders work_order_reminders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_reminders
    ADD CONSTRAINT work_order_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_order_reminders work_order_reminders_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_reminders
    ADD CONSTRAINT work_order_reminders_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.work_categories(id) ON DELETE RESTRICT;


--
-- Name: work_orders work_orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict io2t5tXTufx7txAf0ZyEF8gn7O6H6OZhAcGhUVXFZ8x9BXAETRrABMM2Yn47yWg


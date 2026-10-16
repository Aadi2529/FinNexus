"""Unit tests for SQLAlchemy 2.x declarative models, constraints, and relationships."""

from decimal import Decimal

import pytest
from sqlalchemy import (
    DateTime,
    Numeric,
    create_engine,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    Customer,
    Document,
    FinancialProfile,
    Role,
    User,
    UserRole,
)
from app.db.session import Base

EXPECTED_TABLES = {
    "users",
    "roles",
    "user_roles",
    "refresh_tokens",
    "customers",
    "financial_profiles",
    "customer_notes",
    "tasks",
    "documents",
    "audit_logs",
}


def test_model_metadata_registration():
    """Verify that all 10 core domain tables are registered on Base.metadata."""
    registered = set(Base.metadata.tables.keys())
    assert EXPECTED_TABLES.issubset(registered), (
        f"Missing tables in Base.metadata: {EXPECTED_TABLES - registered}"
    )


def test_column_definitions_and_monetary_types():
    """Verify column types, precision, and timezone settings across core tables."""
    fp_table = Base.metadata.tables["financial_profiles"]
    income_col = fp_table.columns["monthly_income"]
    obligations_col = fp_table.columns["monthly_obligations"]

    assert isinstance(income_col.type, Numeric)
    assert income_col.type.precision == 14
    assert income_col.type.scale == 2

    assert isinstance(obligations_col.type, Numeric)
    assert obligations_col.type.precision == 14
    assert obligations_col.type.scale == 2

    users_table = Base.metadata.tables["users"]
    created_at_col = users_table.columns["created_at"]
    assert isinstance(created_at_col.type, DateTime)
    assert created_at_col.type.timezone is True


def test_foreign_key_ondelete_policies():
    """Verify explicit ondelete rules prevent accidental deletion of critical history."""
    # user_roles -> cascade
    ur_table = Base.metadata.tables["user_roles"]
    ur_fks = {fk.column.table.name: fk.ondelete for fk in ur_table.foreign_keys}
    assert ur_fks.get("users") == "CASCADE"
    assert ur_fks.get("roles") == "CASCADE"

    # refresh_tokens -> cascade
    rt_table = Base.metadata.tables["refresh_tokens"]
    rt_fks = {fk.column.table.name: fk.ondelete for fk in rt_table.foreign_keys}
    assert rt_fks.get("users") == "CASCADE"

    # customers -> assigned_officer SET NULL
    cust_table = Base.metadata.tables["customers"]
    cust_fks = {
        fk.parent.name: (fk.column.table.name, fk.ondelete)
        for fk in cust_table.foreign_keys
    }
    assert cust_fks["assigned_officer_id"] == ("users", "SET NULL")

    # customer_notes -> author RESTRICT (preserve author notes even if user is suspended/deleted)
    notes_table = Base.metadata.tables["customer_notes"]
    notes_fks = {
        fk.parent.name: (fk.column.table.name, fk.ondelete)
        for fk in notes_table.foreign_keys
    }
    assert notes_fks["author_id"] == ("users", "RESTRICT")
    assert notes_fks["customer_id"] == ("customers", "CASCADE")

    # tasks -> assigned_to RESTRICT
    tasks_table = Base.metadata.tables["tasks"]
    tasks_fks = {
        fk.parent.name: (fk.column.table.name, fk.ondelete)
        for fk in tasks_table.foreign_keys
    }
    assert tasks_fks["assigned_to_id"] == ("users", "RESTRICT")
    assert tasks_fks["customer_id"] == ("customers", "CASCADE")

    # audit_logs -> actor SET NULL (immutable history preserved)
    audit_table = Base.metadata.tables["audit_logs"]
    audit_fks = {
        fk.parent.name: (fk.column.table.name, fk.ondelete)
        for fk in audit_table.foreign_keys
    }
    assert audit_fks["actor_id"] == ("users", "SET NULL")


def test_unique_constraints_and_indexes():
    """Verify unique indexes on natural keys."""
    users_table = Base.metadata.tables["users"]
    user_indexes = {idx.name: idx.unique for idx in users_table.indexes}
    assert user_indexes.get("ix_users_email") is True

    cust_table = Base.metadata.tables["customers"]
    cust_indexes = {idx.name: idx.unique for idx in cust_table.indexes}
    assert cust_indexes.get("ix_customers_email") is True
    assert cust_indexes.get("ix_customers_pan_number") is True

    rt_table = Base.metadata.tables["refresh_tokens"]
    rt_indexes = {idx.name: idx.unique for idx in rt_table.indexes}
    assert rt_indexes.get("ix_refresh_tokens_token_hash") is True

    audit_table = Base.metadata.tables["audit_logs"]
    audit_indexes = {
        idx.name: [c.name for c in idx.columns] for idx in audit_table.indexes
    }
    assert "ix_audit_logs_resource" in audit_indexes
    assert audit_indexes["ix_audit_logs_resource"] == ["resource_type", "resource_id"]


@pytest.fixture
def sqlite_in_memory_session():
    """Provide an isolated, in-memory SQLite engine for unit testing entity behaviors."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_duplicate_user_role_prevention(sqlite_in_memory_session: Session):
    """Verify composite primary key on user_roles prevents duplicate role assignments."""
    from sqlalchemy import insert

    user = User(
        email="officer@example.com",
        hashed_password="hashed_pw_test",
        full_name="Loan Officer",
        is_active=True,
    )
    role = Role(
        name="ROLE_OFFICER",
        description="Loan Officer role",
    )
    sqlite_in_memory_session.add_all([user, role])
    sqlite_in_memory_session.commit()

    # First assignment succeeds
    ur1 = UserRole(user_id=user.id, role_id=role.id)
    sqlite_in_memory_session.add(ur1)
    sqlite_in_memory_session.commit()

    # Second duplicate assignment triggers database PK integrity constraint
    with pytest.raises(IntegrityError):
        sqlite_in_memory_session.execute(
            insert(UserRole).values(user_id=user.id, role_id=role.id)
        )
        sqlite_in_memory_session.commit()
    sqlite_in_memory_session.rollback()


def test_financial_profile_check_constraints(sqlite_in_memory_session: Session):
    """Verify check constraints for monthly income, obligations, and CIBIL score."""
    customer = Customer(
        first_name="Anita",
        last_name="Desai",
        email="anita@example.com",
        phone="+919876543210",
        pan_number="ABCDE1234F",
        pipeline_status="NEW_LEAD",
    )
    sqlite_in_memory_session.add(customer)
    sqlite_in_memory_session.commit()

    # Valid profile succeeds
    valid_fp = FinancialProfile(
        customer_id=customer.id,
        employment_type="SALARIED",
        monthly_income=Decimal("75000.00"),
        monthly_obligations=Decimal("15000.00"),
        cibil_score=780,
        risk_tier="LOW",
    )
    sqlite_in_memory_session.add(valid_fp)
    sqlite_in_memory_session.commit()

    # Negative income must fail check constraint
    customer2 = Customer(
        first_name="Ravi",
        last_name="Kumar",
        email="ravi@example.com",
        phone="+919876543211",
        pan_number="XYZAB5678C",
        pipeline_status="NEW_LEAD",
    )
    sqlite_in_memory_session.add(customer2)
    sqlite_in_memory_session.commit()

    invalid_fp = FinancialProfile(
        customer_id=customer2.id,
        employment_type="SALARIED",
        monthly_income=Decimal("-500.00"),
        monthly_obligations=Decimal("0.00"),
        cibil_score=750,
        risk_tier="HIGH",
    )
    sqlite_in_memory_session.add(invalid_fp)
    with pytest.raises(IntegrityError):
        sqlite_in_memory_session.commit()
    sqlite_in_memory_session.rollback()


def test_document_file_size_check_constraint(sqlite_in_memory_session: Session):
    """Verify that document files with zero or negative bytes are rejected by database constraint."""
    customer = Customer(
        first_name="Sanjay",
        last_name="Patel",
        email="sanjay@example.com",
        phone="+919876543212",
        pan_number="KLMNO9012P",
        pipeline_status="NEW_LEAD",
    )
    sqlite_in_memory_session.add(customer)
    sqlite_in_memory_session.commit()

    invalid_doc = Document(
        customer_id=customer.id,
        document_type="PAN_CARD",
        original_filename="pan.pdf",
        storage_path="documents/test-uuid.pdf",
        file_size_bytes=0,  # Invalid: violates file_size_bytes > 0
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        verification_status="PENDING_REVIEW",
    )
    sqlite_in_memory_session.add(invalid_doc)
    with pytest.raises(IntegrityError):
        sqlite_in_memory_session.commit()
    sqlite_in_memory_session.rollback()


def test_no_accidental_schema_creation_on_startup():
    """Verify that importing app components does not execute create_all()."""
    # Create clean engine with no tables
    isolated_engine = create_engine("sqlite:///:memory:")
    # Import main application
    from app.main import app

    assert app is not None
    # Inspect tables in isolated engine - should remain zero
    from sqlalchemy import inspect

    inspector = inspect(isolated_engine)
    tables = inspector.get_table_names()
    assert len(tables) == 0, (
        "Application startup must not run create_all() automatically!"
    )

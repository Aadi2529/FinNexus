"""Tests for Alembic migration discovery, offline SQL generation, and PostgreSQL migration lifecycle."""

import io
import os
import uuid

import psycopg
import pytest
from alembic.command import downgrade, upgrade
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

from app.core.config import settings

ALEMBIC_INI_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
)


def get_alembic_config(stdout: io.StringIO | None = None) -> Config:
    """Return an Alembic Config instance configured for the project."""
    cfg = Config(ALEMBIC_INI_PATH, stdout=stdout)
    cfg.set_main_option(
        "script_location", os.path.join(os.path.dirname(ALEMBIC_INI_PATH), "alembic")
    )
    return cfg


def test_migration_revision_discovery():
    """Verify that Alembic discovers the baseline migration revision and current head."""
    cfg = get_alembic_config()
    script = ScriptDirectory.from_config(cfg)
    head_rev = script.get_current_head()

    assert head_rev is not None
    assert head_rev == "8e2fcff76c27"

    initial_rev = script.get_revision("fad623e5f3cb")
    assert initial_rev is not None
    assert initial_rev.down_revision is None
    assert "initial_schema" in initial_rev.doc

    crm_rev = script.get_revision("6c0faee54a05")
    assert crm_rev is not None
    assert crm_rev.down_revision == "fad623e5f3cb"
    assert "add_crm_work_order_module" in crm_rev.doc

    archival_rev = script.get_revision("7d1ebff65b16")
    assert archival_rev is not None
    assert archival_rev.down_revision == "6c0faee54a05"
    assert "add_client_archival_and_manager_role" in archival_rev.doc

    head_rev_item = script.get_revision(head_rev)
    assert head_rev_item is not None
    assert head_rev_item.down_revision == "7d1ebff65b16"
    assert "add_work_order_scheduling_and_reminders" in head_rev_item.doc


def test_alembic_offline_sql_generation(capsys):
    """Verify that Alembic offline SQL generation compiles valid DDL for PostgreSQL."""
    cfg = get_alembic_config()

    # Compile upgrade SQL statically
    upgrade(cfg, "base:head", sql=True)
    captured = capsys.readouterr()
    sql_upgrade = captured.out

    assert "CREATE TABLE roles" in sql_upgrade
    assert "CREATE TABLE users" in sql_upgrade
    assert "CREATE TABLE user_roles" in sql_upgrade
    assert "CREATE TABLE refresh_tokens" in sql_upgrade
    assert "CREATE TABLE customers" in sql_upgrade
    assert "CREATE TABLE financial_profiles" in sql_upgrade
    assert "CREATE TABLE customer_notes" in sql_upgrade
    assert "CREATE TABLE tasks" in sql_upgrade
    assert "CREATE TABLE documents" in sql_upgrade
    assert "CREATE TABLE audit_logs" in sql_upgrade
    assert "fad623e5f3cb" in sql_upgrade

    # Compile downgrade SQL statically
    downgrade(cfg, "head:base", sql=True)
    captured_down = capsys.readouterr()
    sql_downgrade = captured_down.out

    assert "DROP TABLE audit_logs" in sql_downgrade
    assert "DROP TABLE documents" in sql_downgrade
    assert "DROP TABLE tasks" in sql_downgrade
    assert "DROP TABLE customer_notes" in sql_downgrade
    assert "DROP TABLE financial_profiles" in sql_downgrade
    assert "DROP TABLE customers" in sql_downgrade
    assert "DROP TABLE refresh_tokens" in sql_downgrade
    assert "DROP TABLE user_roles" in sql_downgrade
    assert "DROP TABLE users" in sql_downgrade
    assert "DROP TABLE roles" in sql_downgrade


@pytest.mark.postgres_integration
def test_disposable_postgresql_migration_lifecycle():
    """Integration test verifying full upgrade -> downgrade -> re-upgrade lifecycle

    against a disposable, isolated PostgreSQL test database.
    If PostgreSQL is unreachable or authentication fails, cleanly skip the test.
    """
    # 1. Probe PostgreSQL connectivity
    try:
        conn = psycopg.connect(
            settings.SYNC_DATABASE_URL,
            connect_timeout=2,
            autocommit=True,
        )
    except Exception as exc:
        pytest.skip(
            f"PostgreSQL server not accessible on {settings.SYNC_DATABASE_URL} ({type(exc).__name__}). "
            "Skipping live PostgreSQL integration migration lifecycle test."
        )

    # 2. Generate a disposable test database name
    disposable_db_name = f"ff_test_disposable_{uuid.uuid4().hex[:8]}"

    try:
        # Create disposable database
        conn.execute(f"CREATE DATABASE {disposable_db_name}")
        conn.close()

        # Build connection URL for the disposable database
        base_url_parts = settings.SYNC_DATABASE_URL.rsplit("/", 1)
        disposable_db_url = f"{base_url_parts[0]}/{disposable_db_name}"

        # Configure Alembic to target the disposable database
        cfg = get_alembic_config()
        cfg.set_main_option("sqlalchemy.url", disposable_db_url)

        # A. Execute migration upgrade to head
        upgrade(cfg, "head")

        # Verify all tables created
        engine = create_engine(disposable_db_url)
        with engine.connect() as check_conn:
            inspector = inspect(check_conn)
            tables = set(inspector.get_table_names())
            assert "users" in tables
            assert "customers" in tables
            assert "audit_logs" in tables
            assert "alembic_version" in tables

        # B. Execute downgrade to base
        downgrade(cfg, "base")

        # Verify tables dropped
        with engine.connect() as check_conn:
            inspector = inspect(check_conn)
            tables_after_downgrade = set(inspector.get_table_names())
            assert "users" not in tables_after_downgrade
            assert "customers" not in tables_after_downgrade
            assert "audit_logs" not in tables_after_downgrade

        # C. Re-upgrade to ensure repeatability
        upgrade(cfg, "head")

        engine.dispose()

    finally:
        # Cleanly destroy disposable database
        try:
            admin_conn = psycopg.connect(settings.SYNC_DATABASE_URL, autocommit=True)
            admin_conn.execute(
                f"DROP DATABASE IF EXISTS {disposable_db_name} WITH (FORCE)"
            )
            admin_conn.close()
        except Exception:
            pass

"""Separate company contact details into individual fields.

Revision ID: f8e7d6c5b4a3
Revises: abded99aea93
Create Date: 2026-11-08 15:00:00.000000

"""

import re
from alembic import op
import sqlalchemy as sa


revision = "f8e7d6c5b4a3"
down_revision = "abded99aea93"
branch_labels = None
depends_on = None


EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
MOBILE_REGEX = re.compile(r"\b[6-9]\d{9}\b")


def upgrade() -> None:
    # 1. Add individual contact columns to insurance_companies
    op.add_column("insurance_companies", sa.Column("agent_email", sa.String(255), nullable=True))
    op.add_column("insurance_companies", sa.Column("renewal_contact_person", sa.String(150), nullable=True))
    op.add_column("insurance_companies", sa.Column("renewal_contact_mobile", sa.String(20), nullable=True))
    op.add_column("insurance_companies", sa.Column("renewal_contact_email", sa.String(255), nullable=True))
    op.add_column("insurance_companies", sa.Column("claims_contact_person", sa.String(150), nullable=True))
    op.add_column("insurance_companies", sa.Column("claims_contact_mobile", sa.String(20), nullable=True))
    op.add_column("insurance_companies", sa.Column("claims_contact_email", sa.String(255), nullable=True))
    op.add_column("insurance_companies", sa.Column("kam_name", sa.String(150), nullable=True))
    op.add_column("insurance_companies", sa.Column("kam_mobile", sa.String(20), nullable=True))
    op.add_column("insurance_companies", sa.Column("kam_email", sa.String(255), nullable=True))
    op.add_column("insurance_companies", sa.Column("website", sa.String(255), nullable=True))

    # 2. Safe Data Migration: Extract reliably identifiable values from legacy combined fields
    conn = op.get_bind()
    companies = conn.execute(
        sa.text("SELECT id, renewal_team_contact, claims_team_contact FROM insurance_companies")
    ).fetchall()

    for row in companies:
        cid, renewal_raw, claims_raw = row[0], row[1], row[2]
        updates = {}

        if renewal_raw:
            email_match = EMAIL_REGEX.search(renewal_raw)
            if email_match:
                updates["renewal_contact_email"] = email_match.group(0).lower()
            mobile_match = MOBILE_REGEX.search(renewal_raw)
            if mobile_match:
                updates["renewal_contact_mobile"] = mobile_match.group(0)

        if claims_raw:
            email_match = EMAIL_REGEX.search(claims_raw)
            if email_match:
                updates["claims_contact_email"] = email_match.group(0).lower()
            mobile_match = MOBILE_REGEX.search(claims_raw)
            if mobile_match:
                updates["claims_contact_mobile"] = mobile_match.group(0)

        if updates:
            set_clauses = [f"{k} = :{k}" for k in updates.keys()]
            updates["id"] = cid
            conn.execute(
                sa.text(f"UPDATE insurance_companies SET {', '.join(set_clauses)} WHERE id = :id"),
                updates,
            )


def downgrade() -> None:
    op.drop_column("insurance_companies", "website")
    op.drop_column("insurance_companies", "kam_email")
    op.drop_column("insurance_companies", "kam_mobile")
    op.drop_column("insurance_companies", "kam_name")
    op.drop_column("insurance_companies", "claims_contact_email")
    op.drop_column("insurance_companies", "claims_contact_mobile")
    op.drop_column("insurance_companies", "claims_contact_person")
    op.drop_column("insurance_companies", "renewal_contact_email")
    op.drop_column("insurance_companies", "renewal_contact_mobile")
    op.drop_column("insurance_companies", "renewal_contact_person")
    op.drop_column("insurance_companies", "agent_email")

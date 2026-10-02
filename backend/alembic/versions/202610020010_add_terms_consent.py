"""Record Terms/Privacy acceptance and age confirmation on users.

Existing users get NULLs, which the app treats as "must accept the current
terms" on their next launch.

Revision ID: 202610020010
Revises: 202607070009
Create Date: 2026-10-02
"""

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "202610020010"
down_revision: Optional[str] = "202607070009"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("terms_version", sa.String(length=32), nullable=True))
    op.add_column(
        "users",
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("age_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "age_confirmed_at")
    op.drop_column("users", "terms_accepted_at")
    op.drop_column("users", "terms_version")

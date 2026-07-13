"""Add a moderation status to content reports.

Revision ID: 202607070009
Revises: 202607030008
Create Date: 2026-07-07
"""

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "202607070009"
down_revision: Optional[str] = "202607030008"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column(
        "content_reports",
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="open",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "content_report_status",
        "content_reports",
        "status IN ('open', 'resolved', 'dismissed')",
    )


def downgrade() -> None:
    op.drop_constraint("content_report_status", "content_reports", type_="check")
    op.drop_column("content_reports", "status")

"""Add grade record comments.

Revision ID: 202606260004
Revises: 202606260003
Create Date: 2026-06-26
"""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606260004"
down_revision: Optional[str] = "202606260003"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("grade_records", sa.Column("comment", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("grade_records", "comment")

"""Record each device's app language so pushes are sent in it.

Existing tokens get NULL, which the server treats as Azerbaijani (the app
default); the app re-registers with its language on the next launch.

Revision ID: 202610020011
Revises: 202610020010
Create Date: 2026-10-02
"""

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "202610020011"
down_revision: Optional[str] = "202610020010"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("push_tokens", sa.Column("language", sa.String(length=8), nullable=True))


def downgrade() -> None:
    op.drop_column("push_tokens", "language")

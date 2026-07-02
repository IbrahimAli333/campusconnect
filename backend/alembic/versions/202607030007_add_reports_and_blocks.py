"""Add content reports and profile blocks for store-safety moderation.

Revision ID: 202607030007
Revises: 202606260006
Create Date: 2026-07-03
"""

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "202607030007"
down_revision: Optional[str] = "202606260006"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table(
        "content_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "reporter_profile_id",
            sa.Integer(),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_type", sa.String(length=30), nullable=False),
        sa.Column(
            "target_profile_id",
            sa.Integer(),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "target_opportunity_id",
            sa.Integer(),
            sa.ForeignKey("opportunities.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target_type IN ('profile', 'opportunity')",
            name="content_report_target_type",
        ),
        sa.CheckConstraint(
            "(target_type = 'profile' AND target_profile_id IS NOT NULL AND target_opportunity_id IS NULL)"
            " OR (target_type = 'opportunity' AND target_opportunity_id IS NOT NULL AND target_profile_id IS NULL)",
            name="content_report_target_consistency",
        ),
    )

    op.create_table(
        "profile_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "blocker_profile_id",
            sa.Integer(),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "blocked_profile_id",
            sa.Integer(),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "blocker_profile_id <> blocked_profile_id",
            name="profile_block_not_self",
        ),
        sa.UniqueConstraint(
            "blocker_profile_id",
            "blocked_profile_id",
            name="uq_profile_blocks_blocker_blocked",
        ),
    )


def downgrade() -> None:
    op.drop_table("profile_blocks")
    op.drop_table("content_reports")

"""Add member role for CampusConnect browsing accounts.

Revision ID: 202606260006
Revises: 202606260005
Create Date: 2026-06-28
"""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op


revision: str = "202606260006"
down_revision: Optional[str] = "202606260005"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'member', 'student', 'teacher', 'staff')",
    )
    op.drop_constraint(
        "ck_user_profiles_network_profile_role",
        "user_profiles",
        type_="check",
    )
    op.create_check_constraint(
        "ck_user_profiles_network_profile_role",
        "user_profiles",
        "role IN ('member', 'student', 'teacher', 'mentor', 'employer', 'admin')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_user_profiles_network_profile_role",
        "user_profiles",
        type_="check",
    )
    op.create_check_constraint(
        "ck_user_profiles_network_profile_role",
        "user_profiles",
        "role IN ('student', 'teacher', 'mentor', 'employer', 'admin')",
    )
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'student', 'teacher', 'staff')",
    )

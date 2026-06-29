"""Add CampusConnect networking tables.

Revision ID: 202606260005
Revises: 202606260004
Create Date: 2026-06-26
"""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606260005"
down_revision: Optional[str] = "202606260004"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("headline", sa.String(length=255), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("university", sa.String(length=255), nullable=True),
        sa.Column("faculty", sa.String(length=255), nullable=True),
        sa.Column("graduation_year", sa.Integer(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("visibility", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('student', 'teacher', 'mentor', 'employer', 'admin')",
            name="ck_user_profiles_network_profile_role",
        ),
        sa.CheckConstraint(
            "visibility IN ('public', 'university_only', 'private')",
            name="ck_user_profiles_network_profile_visibility",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_profiles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_profiles"),
        sa.UniqueConstraint("user_id", name="uq_user_profiles_user_id"),
    )
    op.create_table(
        "skills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_skills"),
        sa.UniqueConstraint("name", name="uq_skills_name"),
    )
    op.create_table(
        "opportunities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_profile_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("required_skills", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "type IN ('startup', 'research', 'internship', 'job', 'project')",
            name="ck_opportunities_opportunity_type",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'open', 'closed', 'archived')",
            name="ck_opportunities_opportunity_status",
        ),
        sa.ForeignKeyConstraint(
            ["owner_profile_id"],
            ["user_profiles.id"],
            name="fk_opportunities_owner_profile_id_user_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_opportunities"),
    )
    op.create_table(
        "resume_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=False),
        sa.Column("entry_type", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("organization", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "entry_type IN ('education', 'work', 'project', 'research', 'award', "
            "'certification')",
            name="ck_resume_entries_resume_entry_type",
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["user_profiles.id"],
            name="fk_resume_entries_profile_id_user_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_resume_entries"),
    )
    op.create_table(
        "user_skills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=False),
        sa.Column("skill_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "level IN ('beginner', 'intermediate', 'advanced', 'expert')",
            name="ck_user_skills_user_skill_level",
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["user_profiles.id"],
            name="fk_user_skills_profile_id_user_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["skill_id"],
            ["skills.id"],
            name="fk_user_skills_skill_id_skills",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_skills"),
        sa.UniqueConstraint(
            "profile_id", "skill_id", name="uq_user_skills_profile_skill"
        ),
    )
    op.create_table(
        "connection_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("requester_profile_id", sa.Integer(), nullable=False),
        sa.Column("receiver_profile_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'canceled')",
            name="ck_connection_requests_connection_request_status",
        ),
        sa.CheckConstraint(
            "requester_profile_id <> receiver_profile_id",
            name="ck_connection_requests_connection_request_not_self",
        ),
        sa.ForeignKeyConstraint(
            ["receiver_profile_id"],
            ["user_profiles.id"],
            name="fk_connection_requests_receiver_profile_id_user_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["requester_profile_id"],
            ["user_profiles.id"],
            name="fk_connection_requests_requester_profile_id_user_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_connection_requests"),
        sa.UniqueConstraint(
            "requester_profile_id",
            "receiver_profile_id",
            name="uq_connection_requests_requester_receiver",
        ),
    )
    op.create_table(
        "opportunity_applications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("opportunity_id", sa.Integer(), nullable=False),
        sa.Column("applicant_profile_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('submitted', 'reviewing', 'accepted', 'rejected', "
            "'withdrawn')",
            name="ck_opportunity_applications_opportunity_application_status",
        ),
        sa.ForeignKeyConstraint(
            ["applicant_profile_id"],
            ["user_profiles.id"],
            name="fk_opportunity_applications_applicant_profile_id_user_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["opportunities.id"],
            name="fk_opportunity_applications_opportunity_id_opportunities",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_opportunity_applications"),
        sa.UniqueConstraint(
            "opportunity_id",
            "applicant_profile_id",
            name="uq_opportunity_applications_opportunity_applicant",
        ),
    )
    op.create_table(
        "saved_opportunities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=False),
        sa.Column("opportunity_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["opportunities.id"],
            name="fk_saved_opportunities_opportunity_id_opportunities",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["user_profiles.id"],
            name="fk_saved_opportunities_profile_id_user_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_saved_opportunities"),
        sa.UniqueConstraint(
            "profile_id",
            "opportunity_id",
            name="uq_saved_opportunities_profile_opportunity",
        ),
    )


def downgrade() -> None:
    op.drop_table("saved_opportunities")
    op.drop_table("opportunity_applications")
    op.drop_table("connection_requests")
    op.drop_table("user_skills")
    op.drop_table("resume_entries")
    op.drop_table("opportunities")
    op.drop_table("skills")
    op.drop_table("user_profiles")

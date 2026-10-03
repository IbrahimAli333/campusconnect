"""Single-command pre-deploy entry point for Render.

Render's preDeployCommand is executed without a shell, so chained commands
(`a && b`) and quoted wrappers are not interpreted — the whole step must be
one executable. This module runs the two pre-deploy tasks in order:

1. `alembic upgrade head` (via the alembic API, using /app/alembic.ini)
2. in production, removal of the demo accounts (see remove_demo_accounts)
3. admin/reviewer account provisioning (see provision_admin_accounts)

Exits non-zero if any step fails so the deploy is aborted.
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import get_settings
from app.scripts.provision_admin_accounts import main as provision_main
from app.scripts.remove_demo_accounts import remove_demo_accounts


def remove_demo_accounts_in_production() -> list[str]:
    if not get_settings().is_production():
        return []
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        removed = remove_demo_accounts(db)
    for email in removed:
        print(f"Removed demo account: {email}")
    return removed


def main() -> int:
    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    config = Config(str(ini_path))
    # script_location in alembic.ini is relative to the working directory;
    # resolve it against the ini file's directory so this works from anywhere.
    config.set_main_option("script_location", str(ini_path.parent / "alembic"))
    command.upgrade(config, "head")
    remove_demo_accounts_in_production()
    return provision_main()


if __name__ == "__main__":
    sys.exit(main())

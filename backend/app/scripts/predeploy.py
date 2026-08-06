"""Single-command pre-deploy entry point for Render.

Render's preDeployCommand is executed without a shell, so chained commands
(`a && b`) and quoted wrappers are not interpreted — the whole step must be
one executable. This module runs the two pre-deploy tasks in order:

1. `alembic upgrade head` (via the alembic API, using /app/alembic.ini)
2. admin/reviewer account provisioning (see provision_admin_accounts)

Exits non-zero if either step fails so the deploy is aborted.
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.scripts.provision_admin_accounts import main as provision_main


def main() -> int:
    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    config = Config(str(ini_path))
    # script_location in alembic.ini is relative to the working directory;
    # resolve it against the ini file's directory so this works from anywhere.
    config.set_main_option("script_location", str(ini_path.parent / "alembic"))
    command.upgrade(config, "head")
    return provision_main()


if __name__ == "__main__":
    sys.exit(main())

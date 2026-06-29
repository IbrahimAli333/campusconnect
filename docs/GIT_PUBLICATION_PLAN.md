# CampusConnect Git Publication Plan

Date: 2026-06-29

## Current Git State Summary

- Branch: `main`
- GitHub remote: none configured
- Worktree: dirty, with modified tracked files and many untracked project files
- Tracked changes:
  - Modified: `.gitignore`, `App.tsx`, `package.json`, `package-lock.json`
  - Deleted: `app.json`
- Untracked project files currently recommended for review and commit:
  - `.env.example`
  - `.env.production.example`
  - `README.md`
  - `app.config.js`
  - `backend/`
  - `docs/`
  - `eas.json`
  - `render.yaml`
  - `scripts/`
  - `src/`
- Ignored/generated files currently present:
  - `.expo/`
  - `backend/.pytest_cache/`
  - `backend/.venv/`
  - `node_modules/`
  - `screenshots/`

## Recommended Commit Contents

Commit the application, backend, deployment configuration, documentation, and publication guardrails:

- `.gitignore`
- `App.tsx`
- `app.json` deletion
- `package.json`
- `package-lock.json`
- `.env.example`
- `.env.production.example`
- `README.md`
- `app.config.js`
- `backend/`
- `docs/`
- `eas.json`
- `render.yaml`
- `scripts/`
- `src/`

## Recommended Exclusions

Do not commit generated files, local-only runtime state, or credentials:

- `node_modules/`
- `.expo/`
- `backend/.venv/`
- `backend/.pytest_cache/`
- `screenshots/`
- Real environment files such as `.env`, `.env.preview`, `.env.production`, `.env.development`, and any other `.env.*` file that is not an example
- Local database files such as `*.db`, `*.sqlite`, and `*.sqlite3`
- Private keys, keystores, provisioning profiles, credential files, service account configs, and token files
- Build output and cache folders such as `dist/`, `web-build/`, `build/`, `.cache/`, `coverage/`, and `htmlcov/`
- OS/editor files such as `.DS_Store`, `.vscode/`, `.idea/`, and swap files

## Sensitive File Audit

- Actual `.env` files: none found in the commit-eligible file list.
- Example env files: present and commit-eligible. They contain localhost URLs or placeholder production values and must not be replaced with real secrets before commit.
- Database files: none found outside ignored/generated directories.
- Secret key files, keystores, provisioning profiles, EAS credential files, and token files: none found outside ignored/generated directories.
- Render/database URLs: `render.yaml` uses Render's managed database reference for the database connection string. Docs and examples contain placeholder Render/backend URLs only.
- EAS credentials: no local EAS credentials or tokens found. `eas.json` is configuration, not a credential.
- Screenshots: local QA artifacts exist under `screenshots/` and are now ignored. Keep them out of the publication commit unless a separate product-documentation decision explicitly includes selected images.

Warning: do not commit real database URLs, JWT secret keys, GitHub tokens, Render API keys, Expo/EAS tokens, session cookies, keystores, provisioning profiles, or local `.env` file contents.

## .gitignore Fixes Applied

The root `.gitignore` was expanded to cover:

- Broader local env variants while keeping `.env.example` and `.env.*.example` commit-eligible
- `backend/.venv` and other `.venv/` folders
- Local database files
- Expo/EAS private artifacts and native credential files
- OS/editor/cache/test/build output
- `screenshots/` QA artifacts

## Commands After User Approval

Run these only after the user approves the commit scope:

```sh
git status --short
git add .gitignore App.tsx app.json package.json package-lock.json .env.example .env.production.example README.md app.config.js backend docs eas.json render.yaml scripts src
git diff --cached --stat
git commit -m "Prepare CampusConnect for publication"
```

After the user creates or chooses the GitHub repository and provides the confirmed repository URL, add the remote:

```sh
git remote add origin <GITHUB_REPO_URL>
git remote -v
```

After the user confirms the remote URL is correct, push:

```sh
git push -u origin main
```

Do not create a GitHub repository, add a remote, commit, or push without explicit user approval.

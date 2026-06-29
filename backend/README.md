# Backend

FastAPI backend for CampusConnect, the university-based academic and
professional networking ecosystem.

CampusConnect supports professional student/teacher/mentor/employer profiles,
skills, portfolio/resume entries, research and startup opportunities,
internships, applications, saved opportunities, and connection requests. Legacy
academic tables and routes remain for compatibility and regression tests, but
they are not the current product surface.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Set these values in `.env`:

```bash
UNIVERSITY_PORTAL_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/university_portal"
UNIVERSITY_PORTAL_ENVIRONMENT="development"
UNIVERSITY_PORTAL_SECRET_KEY="replace-with-a-long-random-secret"
UNIVERSITY_PORTAL_ALGORITHM="HS256"
UNIVERSITY_PORTAL_ACCESS_TOKEN_EXPIRE_MINUTES=30
UNIVERSITY_PORTAL_CORS_ORIGINS=""
```

`UNIVERSITY_PORTAL_SECRET_KEY` must be changed before production. The app raises
an error if the default secret is used with
`UNIVERSITY_PORTAL_ENVIRONMENT=production`.

## Run

```bash
alembic upgrade head
python3 -m app.scripts.seed_dev
uvicorn app.main:app --reload
```

The dev seed creates Azerbaijani university-flavored CampusConnect profiles,
skills, portfolio/resume entries, and sample startup, research, internship, and
project opportunities. It is idempotent and refuses to run when `ENVIRONMENT` or
`UNIVERSITY_PORTAL_ENVIRONMENT` is `production`.

Local development credentials:

```text
member@example.edu / member-password
student@example.edu / student-password
teacher@example.edu / teacher-password
```

## First Admin

The bootstrap endpoint only works while the users table is empty. It returns
safe user data and never includes the password hash.

```bash
curl -X POST http://localhost:8000/api/v1/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.edu","password":"change-this-password","full_name":"First Admin"}'
```

After a user exists, the endpoint returns `409 Conflict`.

## Tests

```bash
python3 -m pytest
```

## Production

Use `.env.production.example` as the production variable checklist. The backend
includes a Dockerfile for hosted container platforms:

```bash
docker build -t campusconnect-api .
```

Run `alembic upgrade head` against the production database before starting the
API. Do not run `python3 -m app.scripts.seed_dev` in production.

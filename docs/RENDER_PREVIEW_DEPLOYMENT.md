# CampusConnect Render Preview Deployment Checklist

Last prepared: 2026-06-30

Scope: Render preview deployment preparation only. Do not deploy from this
checklist unless the coordinator explicitly approves deployment. Do not run EAS
builds, submit to stores, use external credentials, run the dev seed against
Render production, change app identifiers, change demo credentials, or upgrade
Expo SDK.

Expo SDK 54 remains acceptable for internal preview. SDK 56 review and upgrade
work is deferred to the production-store readiness track.

## Preflight Audit

Inspected files:

- `render.yaml`
- `backend/Dockerfile`
- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/app/api/v1/health.py`
- `docs/PUBLISHING.md`
- `docs/RELEASE_STATUS.md`

Local readiness findings:

- `render.yaml` defines one managed PostgreSQL database named
  `campusconnect-postgres` and one Docker web service named
  `campusconnect-api`.
- The internal preview Blueprint uses paid preview-compatible Render plans
  because the current automatic migration path depends on
  `preDeployCommand`, which is unsupported on free Render web services:
  `campusconnect-api` has `plan: starter` and `campusconnect-postgres` has
  `plan: basic-256mb`.
- The Blueprint schema validates against Render's public
  `https://render.com/schema/render.yaml.json` schema.
- The web service builds from `backend/Dockerfile` with `backend/` as Docker
  context.
- `backend/Dockerfile` starts Uvicorn with `--port ${PORT:-8000}`, so Render's
  injected `PORT` is honored and local Docker defaults to `8000`.
- `render.yaml` sets `preDeployCommand: alembic upgrade head`.
- `backend/alembic/env.py` replaces the static `alembic.ini` URL with
  `Settings.database_url`, so Render's generated database connection string is
  used for migrations.
- `Settings.normalize_database_url` converts Render-style
  `postgresql://...` URLs to `postgresql+psycopg://...`.
- `Settings.reject_default_secret_key_in_production` rejects the default secret
  key when `UNIVERSITY_PORTAL_ENVIRONMENT=production`.
- `app.scripts.seed_dev.ensure_not_production` refuses to run when
  `ENVIRONMENT` or `UNIVERSITY_PORTAL_ENVIRONMENT` is `prod` or `production`.
- Production CORS does not enable the development LAN regex. It allows only the
  comma-separated origins in `UNIVERSITY_PORTAL_CORS_ORIGINS`.
- Health endpoints exist:
  - `GET /health`
  - `GET /api/v1/health`
  - `GET /api/v1/health/db`

Preflight risks to keep visible:

- `UNIVERSITY_PORTAL_CORS_ORIGINS` is entered manually during Blueprint import.
  Leave it blank for mobile-only preview or use exact trusted `https://`
  browser origins. Do not enter `*`, local, emulator, or private LAN origins.
- The example URL `https://campusconnect-api.onrender.com` is only a URL-shape
  placeholder until Render confirms the actual service URL and hosted smoke
  tests pass.
- Hosted smoke tests, release test account provisioning, and role-flow testing
  require Render account access and are still blocked outside this local pass.
- A previous free-tier attempt failed because Render free web services do not
  support `preDeployCommand`; keeping automatic Alembic migrations requires a
  paid web service plan.
- Render is expected to show an estimated cost before the Blueprint is created.
  Review the estimate and get explicit user approval before deploying.
- The paid preview plans are for internal preview and stable demos only. They
  do not make this a production-store release.

## Required Render Blueprint Import Steps

Perform these steps only after explicit deployment approval:

1. Push the exact commit or branch intended for preview to the connected GitHub
   repository. Confirm it includes `render.yaml` and this checklist.
2. Open the Render dashboard.
3. Select **New +**.
4. Select **Blueprint**.
5. Connect the GitHub account or organization that owns the CampusConnect repo.
6. Select the repository containing this `render.yaml`.
7. Select the preview branch or commit approved by the coordinator.
8. Confirm Render detects the Blueprint file at repository root:
   `render.yaml`.
9. Review the generated resources before creating them:
   - Web service: `campusconnect-api` on the paid `starter` plan
   - PostgreSQL database: `campusconnect-postgres` on the paid `basic-256mb`
     plan
10. Review Render's estimated cost. Create the Blueprint only after the user
    explicitly approves the paid preview estimate.
11. When Render prompts for unsynced environment variables, enter
    `UNIVERSITY_PORTAL_CORS_ORIGINS`.
12. For mobile-only preview, leave `UNIVERSITY_PORTAL_CORS_ORIGINS` blank.
13. For a web preview, enter a comma-separated list of exact HTTPS browser
    origins, for example:

```text
https://preview.campusconnect.example
```

14. Create the Blueprint only after the generated services, cost estimate,
    variables, and branch are correct.
15. Wait for the database to provision and the API deploy to complete.
16. Do not start EAS preview builds at this stage.

## Required Environment Variables

The Blueprint sets these values on the `campusconnect-api` service:

```text
UNIVERSITY_PORTAL_APP_NAME=CampusConnect API
UNIVERSITY_PORTAL_API_V1_PREFIX=/api/v1
UNIVERSITY_PORTAL_DATABASE_URL=<from campusconnect-postgres connectionString>
UNIVERSITY_PORTAL_ENVIRONMENT=production
UNIVERSITY_PORTAL_SECRET_KEY=<Render generated value>
UNIVERSITY_PORTAL_ALGORITHM=HS256
UNIVERSITY_PORTAL_ACCESS_TOKEN_EXPIRE_MINUTES=60
UNIVERSITY_PORTAL_CORS_ORIGINS=<manual, unsynced value>
```

Required operator checks:

- `UNIVERSITY_PORTAL_DATABASE_URL` must come from `campusconnect-postgres`.
- `UNIVERSITY_PORTAL_ENVIRONMENT` must be `production`.
- `UNIVERSITY_PORTAL_SECRET_KEY` must be generated by Render or set to a
  strong secret. It must not be `change-this-secret-key-before-production`.
- `UNIVERSITY_PORTAL_CORS_ORIGINS` must be blank for mobile-only preview or a
  comma-separated list of exact trusted HTTPS browser origins.

## Expected Generated Services

Render should create:

```text
Database
  name: campusconnect-postgres
  plan: basic-256mb
  databaseName: campusconnect
  user: campusconnect
  public IP allow list: empty

Web service
  name: campusconnect-api
  plan: starter
  runtime: docker
  dockerfilePath: ./backend/Dockerfile
  dockerContext: ./backend
  healthCheckPath: /health
  preDeployCommand: alembic upgrade head
```

The API container should listen on Render's `PORT` variable:

```text
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

## Migration Behavior

Render runs this pre-deploy command before promoting a successful API deploy:

```bash
alembic upgrade head
```

The command runs inside the backend image. Although `backend/alembic.ini`
contains a local fallback URL, `backend/alembic/env.py` loads
`UNIVERSITY_PORTAL_DATABASE_URL` through `get_settings()` and calls
`config.set_main_option("sqlalchemy.url", settings.database_url)`.

Expected result:

- New deploy starts.
- Docker image builds.
- `alembic upgrade head` runs against `campusconnect-postgres`.
- If migrations fail, the API deploy should not be promoted.
- If migrations pass, Render promotes the new API instance.

Do not run:

```bash
python3 -m app.scripts.seed_dev
```

against Render production. The seed has a production guard, but preview data
must be provisioned through an approved release-account process.

## Confirm The Final HTTPS URL

After the first successful Render deploy:

1. Open the `campusconnect-api` service in Render.
2. Copy the public service URL from the service overview.
3. Confirm it is HTTPS and has no trailing slash in the value used for app
   configuration.
4. Save it as `BASE_URL` for smoke testing:

```bash
BASE_URL=https://<actual-campusconnect-api-host>.onrender.com
```

5. Use that exact URL for all smoke tests and for
   `EXPO_PUBLIC_API_URL=<final-render-url> npm run publish:check`.

Do not claim hosted smoke has passed until the copied URL responds successfully
to `/health`, `/api/v1/health`, and `/api/v1/health/db`.

## Smoke Test Curl Commands

Replace `<final-render-url>` with the full actual HTTPS URL copied from Render:

```bash
BASE_URL=<final-render-url>
```

Health checks:

```bash
curl -fsS "$BASE_URL/health"
curl -fsS "$BASE_URL/api/v1/health"
curl -fsS "$BASE_URL/api/v1/health/db"
```

Expected health output:

```json
{"status":"ok"}
{"status":"ok"}
{"status":"ok","database":"ok"}
```

Publish URL-shape check:

```bash
EXPO_PUBLIC_API_URL="$BASE_URL" npm run publish:check
```

Expected publish-check output:

```text
Publish check passed: <final-render-url>
```

Role login checks after release test accounts exist:

```bash
MEMBER_TOKEN=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.edu","password":"member-password"}' | jq -r .access_token)

STUDENT_TOKEN=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.edu","password":"student-password"}' | jq -r .access_token)

TEACHER_TOKEN=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.edu","password":"teacher-password"}' | jq -r .access_token)
```

Authenticated profile checks:

```bash
curl -fsS -H "Authorization: Bearer $MEMBER_TOKEN" "$BASE_URL/api/v1/network/me"
curl -fsS -H "Authorization: Bearer $STUDENT_TOKEN" "$BASE_URL/api/v1/network/me"
curl -fsS -H "Authorization: Bearer $TEACHER_TOKEN" "$BASE_URL/api/v1/network/me"
```

Role permission checks:

```bash
MEMBER_POST_STATUS=$(curl -sS -o /tmp/member-post-response.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/network/opportunities" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"project","title":"Member forbidden post smoke","description":"Member should not be allowed to post.","required_skills":[],"status":"open"}')
test "$MEMBER_POST_STATUS" = "403"

STUDENT_OPPORTUNITY_ID=$(curl -fsS -X POST "$BASE_URL/api/v1/network/opportunities" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"project","title":"Student preview project smoke","description":"Preview smoke project created by the student role.","required_skills":["React Native"],"status":"open"}' | jq -r .id)

STUDENT_RESEARCH_STATUS=$(curl -sS -o /tmp/student-research-response.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/network/opportunities" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"research","title":"Student forbidden research smoke","description":"Student should not be allowed to post research.","required_skills":[],"status":"open"}')
test "$STUDENT_RESEARCH_STATUS" = "403"

TEACHER_OPPORTUNITY_ID=$(curl -fsS -X POST "$BASE_URL/api/v1/network/opportunities" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"research","title":"Teacher preview research smoke","description":"Preview smoke research created by the teacher role.","required_skills":["Data Analysis"],"status":"open"}' | jq -r .id)

curl -fsS -X POST "$BASE_URL/api/v1/network/opportunities/$TEACHER_OPPORTUNITY_ID/apply" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"Preview smoke application from member role."}'

curl -fsS -H "Authorization: Bearer $TEACHER_TOKEN" \
  "$BASE_URL/api/v1/network/opportunities/$TEACHER_OPPORTUNITY_ID/applications"
```

Manual app smoke after curl checks pass:

```bash
EXPO_PUBLIC_API_URL="$BASE_URL" npm start
```

Then verify Member, Student, and Teacher flows from `docs/RELEASE_QA.md`
against the hosted backend.

## Provision Release Test Accounts

Required preview credentials must remain:

```text
Member:  member@example.edu / member-password
Student: student@example.edu / student-password
Teacher: teacher@example.edu / teacher-password
```

Do not use `python3 -m app.scripts.seed_dev` on Render production.

Preferred production-safe process:

1. Confirm migrations have completed.
2. Confirm `UNIVERSITY_PORTAL_ENVIRONMENT=production` on the Render service.
3. Use Render Shell for `campusconnect-api`.
4. Run an approved, reviewed one-off provisioning script that creates only the
   three release test users and their basic network profiles.
5. Record the provisioning command, timestamp, operator, and resulting user IDs
   in the coordinator handoff.

The current API has `/api/v1/auth/bootstrap-admin`, but it only creates the
first admin user when the database has no users. It does not provision the
Member, Student, and Teacher release accounts.

An approved one-off provisioning command can use the app ORM and password
hashing without importing or calling `seed_dev`:

```bash
python - <<'PY'
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User
from app.models.user_profile import UserProfile

ACCOUNTS = [
    {
        "email": "member@example.edu",
        "password": "member-password",
        "full_name": "Preview Member",
        "role": "member",
        "headline": "CampusConnect preview member",
    },
    {
        "email": "student@example.edu",
        "password": "student-password",
        "full_name": "Preview Student",
        "role": "student",
        "headline": "CampusConnect preview student",
    },
    {
        "email": "teacher@example.edu",
        "password": "teacher-password",
        "full_name": "Preview Teacher",
        "role": "teacher",
        "headline": "CampusConnect preview teacher",
    },
]

with SessionLocal() as db:
    for account in ACCOUNTS:
        user = db.scalar(select(User).where(User.email == account["email"]))
        if user is None:
            user = User(
                email=account["email"],
                hashed_password=hash_password(account["password"]),
                full_name=account["full_name"],
                role=account["role"],
                is_active=True,
            )
            db.add(user)
            db.flush()
        else:
            user.hashed_password = hash_password(account["password"])
            user.full_name = account["full_name"]
            user.role = account["role"]
            user.is_active = True

        profile = db.scalar(
            select(UserProfile).where(UserProfile.user_id == user.id)
        )
        if profile is None:
            profile = UserProfile(
                user_id=user.id,
                role=account["role"],
                headline=account["headline"],
                university="CampusConnect Preview University",
                faculty="Preview Faculty",
                location="Preview",
                visibility="public",
            )
            db.add(profile)
        else:
            profile.role = account["role"]
            profile.headline = account["headline"]
            profile.university = "CampusConnect Preview University"
            profile.faculty = "Preview Faculty"
            profile.location = "Preview"
            profile.visibility = "public"

    db.commit()

    for account in ACCOUNTS:
        user = db.scalar(select(User).where(User.email == account["email"]))
        print(f"{account['role']}: user_id={user.id} email={user.email}")
PY
```

This is release-account provisioning, not dev seeding. It does not create the
full local seed dataset, courses, grade records, opportunities, skills,
resume entries, or QA clutter. After provisioning, use the smoke commands above
to create temporary smoke-test opportunities through the API.

## Rollback Notes

API rollback:

- If the API deploy fails before promotion, keep the previous live deploy.
- If a promoted deploy is bad, use Render's service deploy history to redeploy
  the last known good deploy for `campusconnect-api`.
- Re-run health checks after rollback.

Database rollback:

- Alembic migrations are forward migrations. Do not assume API rollback reverses
  database changes.
- Before risky schema changes, create or confirm a database backup in Render.
- If a migration has already changed production preview data, coordinate a
  database restore or explicit Alembic downgrade plan before taking action.

Blueprint/resource rollback:

- For a failed first preview import with no data to preserve, delete the
  generated `campusconnect-api` and `campusconnect-postgres` resources only
  after coordinator approval.
- Do not delete the database if smoke tests, release accounts, or preview users
  have already generated data that needs to be retained.

## Output To Send Back To Coordinator

After an approved deployment and smoke test, send:

```text
Render preview deployment result:
- Git commit/branch deployed:
- Render Blueprint name:
- Web service name:
- Database name:
- Final HTTPS API URL:
- Render deploy ID or timestamp:
- Migration result:
- /health output:
- /api/v1/health output:
- /api/v1/health/db output:
- publish:check command and output:
- Release test account provisioning method:
- Release test account user IDs:
- Member smoke result:
- Student smoke result:
- Teacher smoke result:
- CORS value configured:
- Rollback point identified:
- Remaining blockers:
```

Until those values are filled with hosted results, internal preview remains
blocked by missing confirmed Render HTTPS backend URL and hosted smoke tests.

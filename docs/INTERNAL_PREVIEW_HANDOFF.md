# CampusConnect Internal Preview Handoff

Last prepared: 2026-06-30

Scope: final internal preview handoff only. Do not deploy Render, run EAS
builds, submit to stores, use external credentials, change app identifiers,
change demo credentials, add dependencies, or upgrade Expo SDK without explicit
approval.

Related runbooks:

- `docs/RENDER_PREVIEW_DEPLOYMENT.md`
- `docs/EAS_PREVIEW_BUILDS.md`
- `docs/RELEASE_QA.md`
- `docs/PUBLISHING.md`
- `docs/RELEASE_STATUS.md`

## Current Local Readiness

Local QA is ready for the internal preview path. The repo has the expected
Render Blueprint, EAS preview profile, publish URL guard, SDK 54 dependency
baseline, and backend test coverage. The Render Blueprint intentionally uses
free Render plans for the current internal preview: `campusconnect-api` has
`plan: free` and `campusconnect-postgres` has `plan: free`. The placeholder URL
`https://campusconnect-api.onrender.com` is valid only for HTTPS URL-shape
validation unless Render confirms it as the final service URL.

Expo SDK 54 is acceptable for internal preview after the hosted-backend and EAS
preview gates pass. SDK 56 review and upgrade work is deferred to the
production-store readiness track because SDK 56 changes the React Native, React,
Node, iOS, Android, and Xcode baselines.

## Remaining External Blockers

- Final Render HTTPS API URL is not confirmed.
- Render hosted health and database smoke tests have not run.
- Release test accounts have not been provisioned on the hosted backend.
- Hosted Member, Student, and Teacher role smoke tests have not passed.
- EAS project/account ownership and project ID have not been confirmed.
- EAS `preview` environment does not yet have a confirmed final
  `EXPO_PUBLIC_API_URL`.
- Android preview APK and iOS internal preview builds need explicit approval
  before they are started.
- Production store submission remains out of scope.

## Free Render Plan Caveats

The internal preview path uses Render free plans for now. The free web service
can sleep after idle traffic, so the first request after a quiet period can take
about a minute to wake.

Free Render Postgres is preview-only. It has capacity limits, no production
guarantees, no backups, and can expire, so do not rely on it for production data
or long-lived demo data. Paid plans can be selected later for stable demos or a
production-like preview.

## Do Not Proceed Until

Do not run Android or iOS EAS preview builds until all of these are true:

- Render deploy is complete from the approved branch or commit.
- The final public HTTPS API URL is copied from the Render service overview.
- `BASE_URL=<final-render-url>` has no trailing slash.
- `curl -fsS "$BASE_URL/health"` passes.
- `curl -fsS "$BASE_URL/api/v1/health"` passes.
- `curl -fsS "$BASE_URL/api/v1/health/db"` passes.
- `EXPO_PUBLIC_API_URL="$BASE_URL" npm run publish:check` passes.
- Release test accounts exist on the hosted backend through an approved
  production-safe process, not the dev seed.
- Hosted Member, Student, and Teacher smoke tests pass.
- EAS project ownership and project ID are confirmed.
- EAS `preview` environment uses the exact same final Render URL.
- The coordinator explicitly approves EAS preview builds.

## Render Deployment Order

1. Push the exact branch or commit approved for preview to the connected GitHub
   repository.
2. In Render, choose **New +** then **Blueprint**.
3. Connect or select the GitHub account or organization that owns the repo.
4. Select the CampusConnect repo and approved preview branch or commit.
5. Confirm Render detects `render.yaml` at the repository root.
6. Review generated resources before creating them:
   - Web service: `campusconnect-api` on the free plan
   - PostgreSQL database: `campusconnect-postgres` on the free plan
7. When prompted, set `UNIVERSITY_PORTAL_CORS_ORIGINS` to blank for mobile-only
   preview or a comma-separated list of exact trusted HTTPS browser origins.
8. Confirm `UNIVERSITY_PORTAL_DATABASE_URL` comes from
   `campusconnect-postgres`, `UNIVERSITY_PORTAL_ENVIRONMENT=production`, and
   `UNIVERSITY_PORTAL_SECRET_KEY` is generated or strong.
9. Create the Blueprint.
10. Wait for database provisioning, Docker image build, `alembic upgrade head`,
    and API deploy completion.
11. Copy the final public HTTPS service URL from the Render service overview.
12. Run the hosted smoke commands below before any EAS setup or builds proceed.

## Render Smoke Test Commands

Replace `<final-render-url>` with the exact HTTPS URL copied from Render:

```bash
BASE_URL=<final-render-url>
curl -fsS "$BASE_URL/health"
curl -fsS "$BASE_URL/api/v1/health"
curl -fsS "$BASE_URL/api/v1/health/db"
EXPO_PUBLIC_API_URL="$BASE_URL" npm run publish:check
```

Expected health output:

```json
{"status":"ok"}
{"status":"ok"}
{"status":"ok","database":"ok"}
```

Expected publish-check output:

```text
Publish check passed: <final-render-url>
```

After release test accounts exist, run login/profile API checks:

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

curl -fsS -H "Authorization: Bearer $MEMBER_TOKEN" "$BASE_URL/api/v1/network/me"
curl -fsS -H "Authorization: Bearer $STUDENT_TOKEN" "$BASE_URL/api/v1/network/me"
curl -fsS -H "Authorization: Bearer $TEACHER_TOKEN" "$BASE_URL/api/v1/network/me"
```

Run the full role smoke matrix in `docs/RELEASE_QA.md` against the hosted API.

## Hosted Role Smoke Requirements

Member:

- Sign in with `member@example.edu` / `member-password`.
- Browse Discover profiles and opportunity lists.
- Open profile and opportunity details.
- Save and apply to opportunities.
- Request a connection.
- Confirm Member cannot post opportunities or review applicants.

Student:

- Sign in with `student@example.edu` / `student-password`.
- Browse, save, apply, connect, and open detail views.
- Create Startup and Project opportunities.
- Confirm Student cannot create Research, Internship, or Job opportunities.
- Confirm Student-owned posts appear in My Posts and open as post details, not
  applicant review.

Teacher:

- Sign in with `teacher@example.edu` / `teacher-password`.
- Browse, save, apply, connect, and open detail views.
- Create Research opportunities.
- Confirm Teacher cannot create Startup, Project, Internship, or Job
  opportunities.
- Confirm Teacher-owned posts appear in My Posts and open applicant review.
- Review applicants and move applications through Reviewing, Accepted, and
  Rejected states.

All roles:

- Confirm profile editing, skills, resume entries, duplicate apply/save/connect
  handling, authenticated API behavior, and small iPhone-sized layout sanity
  pass against the hosted Render API.

## EAS Preview Setup Order

1. Confirm the final Render smoke tests and hosted role smoke tests have passed.
2. Confirm the local preflight commands pass with the final Render URL:

```bash
npm run typecheck
npm run doctor
cd backend && .venv/bin/python -m pytest
EXPO_PUBLIC_API_URL=<final-render-url> npm run publish:check
```

3. Log in to the expected Expo account:

```bash
npx eas login
```

4. Initialize or confirm the EAS project from the repo root:

```bash
npx eas init
```

5. Confirm the EAS project owner and project ID match the intended
   CampusConnect preview project.
6. Create or update the public preview environment variable:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value <final-render-url> --environment preview --visibility plaintext
```

If the variable already exists, update it in the Expo dashboard or with the EAS
CLI so the `preview` environment uses the exact same final Render URL used in
local `publish:check`.

7. Confirm iOS distribution strategy before building: registered ad hoc
   devices, Enterprise distribution, or a separately approved TestFlight path.
8. Get explicit approval to run EAS preview builds.

## Android Preview APK Command

Run only after every gate above passes and explicit approval is given:

```bash
EXPO_PUBLIC_API_URL=<final-render-url> npm run build:android:preview
```

Expected behavior:

- `npm run publish:check` runs first.
- EAS uses the `preview` profile.
- The Android artifact is an APK for internal installation.
- Install the APK and repeat hosted smoke tests against the Render API.

## iOS Internal Preview Command

Run only after every gate above passes, iOS device/Apple setup is complete, and
explicit approval is given:

```bash
EXPO_PUBLIC_API_URL=<final-render-url> npm run build:ios:preview
```

Expected behavior:

- `npm run publish:check` runs first.
- EAS uses the `preview` profile with internal distribution.
- For ad hoc distribution, only devices included in the provisioning profile at
  build time can install the app.
- Register new ad hoc devices before building, commonly with:

```bash
eas device:create
```

TestFlight caveat:

- The current `preview` profile is EAS internal distribution, not TestFlight.
- TestFlight requires Apple Developer and App Store Connect setup plus a
  separately approved submission path.
- Production App Store submission remains out of scope.

## Output Required After Render Deployment

The operator should send back:

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

## Output Required After EAS Preview Builds

The operator should send back:

```text
EAS internal preview build result:
- Git commit/branch built:
- Final Render HTTPS API URL used:
- EAS project account/owner:
- EAS project ID:
- EAS preview environment EXPO_PUBLIC_API_URL value confirmed:
- Android build command:
- Android build ID:
- Android artifact type:
- Android artifact/install URL:
- Android install smoke result:
- iOS build command or TestFlight path:
- iOS build ID:
- iOS distribution mechanism:
- iOS artifact/install URL or TestFlight build number:
- iOS registered device coverage, if ad hoc:
- iOS install smoke result:
- Member smoke result:
- Student smoke result:
- Teacher smoke result:
- Remaining blockers:
```

Until the Render and EAS result blocks contain real hosted outputs, internal
preview remains externally blocked.

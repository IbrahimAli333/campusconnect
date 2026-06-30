# CampusConnect Release Status

Last audited: 2026-06-30

Scope: final local verification after mobile preview polish. No deployment, EAS
build, store submission, app identifier change, demo credential change, or Expo
SDK upgrade was performed.

Operational runbooks:

- Render preview deployment: `docs/RENDER_PREVIEW_DEPLOYMENT.md`
- EAS internal preview builds: `docs/EAS_PREVIEW_BUILDS.md`
- Consolidated internal preview handoff: `docs/INTERNAL_PREVIEW_HANDOFF.md`

## Verdicts

### Local QA

Go for local QA sign-off. The inspected screenshots pass the requested mobile
and desktop visual gates, the required CLI checks pass, and browser-console
inspection completed successfully against local Chrome with no release-relevant
console, page, React, deprecated-style, or API failures.

### Internal Preview

No-go. The Render Blueprint is set to paid preview-compatible plans so the
backend can use Render's pre-deploy command for automatic Alembic migrations.
SDK 54 is acceptable for this path after Render's cost estimate is reviewed and
approved, the final Render HTTPS API URL is confirmed, reachable,
database-backed, and role-smoke-tested; `publish:check` must pass with that
exact URL, EAS preview environment variables must be configured, and hosted role
smoke tests must pass before creating preview builds.

### Production Store

No-go. Production store readiness remains separate from this internal preview
task and still needs store accounts, production EAS builds, submissions,
store-listing materials, privacy/support URLs, device testing, hosted-backend
smoke testing, and a planned SDK 56 upgrade review.

## Remaining Render Checklist

- Create/import the Render Blueprint from `render.yaml`.
- Confirm Render shows `campusconnect-api` on the paid `starter` web service
  plan and `campusconnect-postgres` on the paid `basic-256mb` PostgreSQL plan.
- Review Render's estimated cost and get explicit user approval before creating
  the Blueprint.
- Confirm the final public HTTPS API URL. The current
  `https://campusconnect-api.onrender.com` value has only been used as an
  HTTPS URL-shape/publish-guard check in this pass.
- Confirm production environment variables are set, including database URL,
  production environment, secret key, and CORS origins if a web origin is used.
- Confirm Alembic migrations run through the Render pre-deploy command.
- Smoke test `GET /health`, `GET /api/v1/health`, and
  `GET /api/v1/health/db` against the final Render URL.
- Provision release test accounts through the approved production data process;
  do not run the dev seed against Render production.
- Repeat Member, Student, and Teacher role smoke tests against the hosted API.
- Do not claim Render smoke passed until the confirmed hosted URL is reachable
  and tested.
- Keep the automatic migration path on a paid web service plan because Render
  free web services do not support `preDeployCommand`; the previous free-tier
  attempt failed on this limitation.
- Treat the paid Render deployment as internal preview only, separate from
  production store submission.

## Remaining EAS Preview Checklist

- Confirm the EAS project is initialized and accessible from the correct Expo
  account.
- Set `EXPO_PUBLIC_API_URL` in the EAS preview environment to the final Render
  HTTPS API URL.
- Run `EXPO_PUBLIC_API_URL=<final-render-url> npm run publish:check`.
- After explicit approval, create Android preview APK and iOS internal/TestFlight
  preview builds.
- Install preview builds and repeat role, opportunity, posting, applicant review,
  profile editing, and small-screen layout smoke tests against the Render API.

## SDK 54 Versus SDK 56

Current repo dependencies use Expo SDK 54 (`expo` `~54.0.35`), React Native
0.81.5, and React 19.1.0. The exact Expo SDK 56 reference documents SDK 56 as
targeting React Native 0.85, React 19.2.3, minimum Node.js 22.13.x, Android
`compileSdkVersion`/`targetSdkVersion` 36, iOS 16.4+, and Xcode 26.4+.

Recommendation: keep SDK 54 for internal preview once the hosted-backend and
EAS-preview gates are cleared. Defer SDK 56 to a separate production-store
readiness task because it changes the React Native, React, Node, iOS, Android,
and Xcode baseline. Before store submission, recheck current Apple and Google
store requirements and complete a focused SDK upgrade/test pass.

Reference checked before code changes:
https://docs.expo.dev/versions/v56.0.0/

## Screenshot QA Results

Latest screenshot set:
`screenshots/campusconnect-mobile-preview-polish/`.

- Mobile login first viewport is usable: role presets, email, password, sign-in,
  and API endpoint are reachable quickly.
- `CampusConnect` no longer wraps awkwardly in the mobile login screenshot.
- Request-access mode is clearly invite-based and does not present a real signup
  submit flow.
- Mobile Discover header and navigation are compact enough.
- Search and real profile cards appear early on mobile Discover.
- Student desktop Posts view shows professional seeded post titles and content,
  with no visible QA placeholder titles such as `sad`. Normal `Posted` date
  metadata remains on post cards.
- No obvious overlap, clipping, or unreadable text was visible in the inspected
  mobile and desktop screenshots.

## Verification Results

- `npm run typecheck`: passed.
- `npm run doctor`: passed, 18/18 Expo doctor checks.
- `cd backend && .venv/bin/python -m pytest`: passed, 101/101 tests.
- `EXPO_PUBLIC_API_URL=https://campusconnect-api.onrender.com npm run publish:check`:
  passed for HTTPS URL shape only. This is not a Render smoke-test pass.
- Browser-console check: passed locally with installed Google Chrome controlled
  through the Chrome DevTools Protocol. The in-app browser runtime still returned
  no available browser targets, so CDP was used as the non-invasive local browser
  fallback. Checked login, request-access mode, Member Discover, Student Posts,
  and Teacher Posts/applicant review. No console errors, page/runtime errors,
  failed API requests, React warnings indicating broken UI behavior, or
  deprecated-style warnings were found.

## Preview Build Gate

Do not create an Android preview APK or iOS internal/TestFlight build until all
of these are true:

- Final Render HTTPS backend URL is confirmed.
- Render `/health`, `/api/v1/health`, and `/api/v1/health/db` pass against the
  confirmed URL.
- Release test accounts exist on the hosted backend.
- `EXPO_PUBLIC_API_URL=<final-render-url> npm run publish:check` passes with
  the exact final URL.
- Member, Student, and Teacher smoke tests pass against the hosted backend.
- EAS preview environment uses the exact final Render URL.
- Explicit approval is given to run EAS preview builds.

# CampusConnect Release Status

Last audited: 2026-06-30

Scope: hosted Render preview status after API health smoke, release-test
provisioning, and hosted role smoke. No EAS build, store submission, app
identifier change, demo credential change, or Expo SDK upgrade was performed.

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

No-go until the EAS project/account setup is completed, the EAS preview
environment is confirmed with the final Render API URL, and explicit
preview-build approval is given. The backend is deployed at
`https://campusconnect-api-u7tq.onrender.com`; hosted health, release-test
account authentication, role smoke, and `publish:check` have passed. SDK 54
remains acceptable for internal preview after the EAS preview environment and
build-approval gates pass.

### Production Store

No-go. Production store readiness remains separate from this internal preview
task and still needs store accounts, production EAS builds, submissions,
store-listing materials, privacy/support URLs, device testing, hosted-backend
smoke testing, and a planned SDK 56 upgrade review.

## Hosted Render Status

- Final API URL: `https://campusconnect-api-u7tq.onrender.com`.
- Hosted health smoke passed:
  - `GET /health`: `200 OK`
  - `GET /api/v1/health`: `200 OK`
  - `GET /api/v1/health/db`: `200 OK`
- Release test accounts were provisioned through
  `backend/app/scripts/provision_release_preview.py`; do not run
  `backend/app/scripts/seed_dev.py` against Render production.
- Hosted login smoke passed for Member, Student, and Teacher release-test
  accounts.
- Hosted role smoke passed:
  - Member can read `network/me` as `member`, list profiles, list recommended
    profiles, list opportunities, save/apply/connect where applicable, and gets
    `403` for opportunity creation and applicant review.
  - Student can read `network/me` as `student`, list profiles/opportunities,
    create a Project opportunity, gets `403` for Research creation, and sees the
    owned post in My Posts.
  - Teacher can read `network/me` as `teacher`, create Research, gets `403` for
    Startup/Project creation, lists applicants for a Teacher-owned Research
    opportunity, and updates applicant review status.
- Treat the paid Render deployment as internal preview only, separate from
  production store submission.

Render Shell provisioning command:

```bash
UNIVERSITY_PORTAL_ALLOW_RELEASE_TEST_PROVISIONING=true \
python -m app.scripts.provision_release_preview --confirm-render-preview
```

## EAS Preview Environment Status

- Local `npx eas ...` does not resolve to the EAS CLI in this repo because
  `eas-cli` is not installed locally; the official `eas-cli` package was checked
  with `npx --yes eas-cli@latest`.
- EAS CLI checked: `eas-cli/20.5.0 darwin-arm64 node-v25.6.0`.
- EAS account status: not logged in. `npx --yes eas-cli@latest whoami` returned
  `Not logged in`.
- EAS project status: not confirmed. `project:info` requires an authenticated
  Expo account, and the repo does not currently contain local EAS project-link
  evidence such as `.eas/` or `extra.eas.projectId`.
- EAS preview `EXPO_PUBLIC_API_URL` status: not confirmed or set by this
  executor because no existing authenticated EAS session was available.
- Do not force login or create builds from automation. An authorized operator
  must complete the manual EAS setup from the repo root:

```bash
npx eas login
npx eas init
npx eas whoami
npx eas project:info
npx eas env:get preview --variable-name EXPO_PUBLIC_API_URL --variable-environment preview --format long
```

If the preview variable is missing, create it as a plaintext project variable:

```bash
npx eas env:create preview \
  --name EXPO_PUBLIC_API_URL \
  --value https://campusconnect-api-u7tq.onrender.com \
  --visibility plaintext \
  --scope project \
  --non-interactive
```

If the preview variable already exists with a different value, update it:

```bash
npx eas env:update preview \
  --variable-name EXPO_PUBLIC_API_URL \
  --variable-environment preview \
  --value https://campusconnect-api-u7tq.onrender.com \
  --visibility plaintext \
  --scope project \
  --non-interactive
```

Dashboard alternative: Expo dashboard for the initialized CampusConnect project,
then **Environment variables** -> **preview** -> `EXPO_PUBLIC_API_URL` ->
plaintext value `https://campusconnect-api-u7tq.onrender.com`.

## Remaining EAS Preview Checklist

- Remaining internal-preview blockers are EAS account/project confirmation, EAS
  preview environment confirmation, and explicit preview-build approval.
- Confirm the EAS project is initialized and accessible from the correct Expo
  account.
- Confirm `EXPO_PUBLIC_API_URL` in the EAS preview environment is set to
  `https://campusconnect-api-u7tq.onrender.com`.
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
- `cd backend && .venv/bin/python -m pytest`: passed, 105/105 tests.
- `EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run publish:check`:
  passed.
- Hosted Render role smoke: passed for Member, Student, and Teacher release-test
  accounts against `https://campusconnect-api-u7tq.onrender.com`.
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

Completed:

- Final Render HTTPS backend URL is confirmed:
  `https://campusconnect-api-u7tq.onrender.com`.
- Render `/health`, `/api/v1/health`, and `/api/v1/health/db` have passed
  against the confirmed URL.
- Release test accounts exist on the hosted backend.
- `EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run publish:check`
  passes with the exact final URL.
- Member, Student, and Teacher smoke tests pass against the hosted backend.

Remaining:

- EAS preview environment uses the exact final Render URL.
- Explicit approval is given to run EAS preview builds.

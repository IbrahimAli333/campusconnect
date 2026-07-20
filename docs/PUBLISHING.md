# Unibridge Publishing Checklist

This repository is configured for production mobile builds, but store release
still needs external accounts and a hosted backend.

Internal preview builds and production store submission are separate gates.
Preview builds use the `preview` EAS profile for internal QA against the final
Render HTTPS API URL. Store submission uses the `production` EAS profile plus
Apple/Google store accounts, metadata, privacy/support URLs, device testing,
and explicit submission approval.

The repo currently stays on Expo SDK 54 for internal preview. Review and upgrade
to SDK 56 in a separate production-store readiness task before public store
submission.

## 1. Pick Production Identifiers

Current app identifiers:

```text
iOS bundle identifier: com.unibridge.app
Android package:        com.unibridge.app
Expo slug:              campusconnect
URL scheme:             campusconnect
```

Change these before the first store build if you want a different permanent
identifier. After release, changing them creates a different app in the stores.

## 2. Deploy The Backend

Use the Render Blueprint in `render.yaml` to create a managed PostgreSQL
database and hosted HTTPS API service. For internal preview, the Blueprint uses
paid preview-compatible Render plans because the current automatic migration
path depends on `preDeployCommand: alembic upgrade head`, and Render free web
services do not support `preDeployCommand`. The previous free-tier attempt
failed on that limitation.

Backend production requirements:

```text
UNIVERSITY_PORTAL_DATABASE_URL
UNIVERSITY_PORTAL_ENVIRONMENT=production
UNIVERSITY_PORTAL_SECRET_KEY
UNIVERSITY_PORTAL_CORS_ORIGINS
```

Render setup:

1. Push the repository, including `render.yaml`, to GitHub.
2. In Render, choose **New** -> **Blueprint** and connect/import this repo.
3. Review the generated resources:
   - `campusconnect-api` web service on the paid `starter` plan
   - `campusconnect-postgres` managed PostgreSQL database on the paid
     `basic-256mb` plan with public connections disabled
4. Review Render's estimated cost and get explicit user approval before
   creating the Blueprint.
5. During Blueprint creation, enter `UNIVERSITY_PORTAL_CORS_ORIGINS` when
   prompted. Use a comma-separated list of browser origins that may call the
   API, such as `https://your-campusconnect-web-domain.com`. Native mobile
   clients do not require CORS, so this can stay blank if there is no web app.
6. Create the Blueprint and wait for the database and API deploy to finish.

The Blueprint sets these environment variables on the API service:

```text
UNIVERSITY_PORTAL_APP_NAME=Unibridge API
UNIVERSITY_PORTAL_API_V1_PREFIX=/api/v1
UNIVERSITY_PORTAL_DATABASE_URL=<Render campusconnect-postgres connectionString>
UNIVERSITY_PORTAL_ENVIRONMENT=production
UNIVERSITY_PORTAL_SECRET_KEY=<Render generated secret>
UNIVERSITY_PORTAL_ALGORITHM=HS256
UNIVERSITY_PORTAL_ACCESS_TOKEN_EXPIRE_MINUTES=60
UNIVERSITY_PORTAL_CORS_ORIGINS=<comma-separated HTTPS browser origins, or blank for mobile-only>
```

The Docker image is built from `backend/Dockerfile` with `backend/` as the
Docker build context. The container starts Uvicorn on `0.0.0.0` using Render's
`PORT` environment variable, with local Docker defaulting to port `8000`.
The API connects to PostgreSQL over Render's private network.

Paid preview caveats:

- Render should show an estimated cost before the Blueprint is created; do not
  deploy until the user approves that estimate.
- Paid preview resources are for internal preview and stable demos only. They
  do not replace the separate production store-readiness gate.

Run database migrations on the production database:

```bash
alembic upgrade head
```

`render.yaml` configures this same command as the Render pre-deploy command, so
it runs before every successful API deploy. If you need to run it manually, use
Render Shell for the `campusconnect-api` service and run `alembic upgrade head`.

Do not run the dev seed in production. Do not run
`python3 -m app.scripts.seed_dev` against the Render database. The seed refuses
to run when `UNIVERSITY_PORTAL_ENVIRONMENT=production`, but production data
should not depend on the dev seed workflow.

Verify the hosted API:

```bash
curl https://campusconnect-api.onrender.com/health
curl https://campusconnect-api.onrender.com/api/v1/health
curl https://campusconnect-api.onrender.com/api/v1/health/db
```

If you add a custom API domain, run the same checks against
`https://api.your-campusconnect-domain.com`.

## 3. Configure The Mobile App API URL

Production and preview EAS builds require a public HTTPS API URL:

```bash
export EXPO_PUBLIC_API_URL=https://campusconnect-api.onrender.com
npm run publish:check
```

After Render deploys the API, copy the final public HTTPS service URL from
Render and use that exact URL as `EXPO_PUBLIC_API_URL`. If Render assigns a
different `onrender.com` hostname or you add a custom HTTPS API domain, use that
final URL instead of the example above.

The build config rejects missing, localhost, emulator, private LAN, and
non-HTTPS API URLs for store-ready builds.

`eas.json` maps the preview and production build profiles to the matching EAS
environments. Before running EAS cloud builds, configure the same
`EXPO_PUBLIC_API_URL` value in the EAS project for both the preview and
production environments.

## 4. Build With EAS

Log in and initialize the EAS project once:

```bash
npx eas login
npx eas init
```

Internal test builds:

```bash
EXPO_PUBLIC_API_URL=https://campusconnect-api.onrender.com npm run build:android:preview
EXPO_PUBLIC_API_URL=https://campusconnect-api.onrender.com npm run build:ios:preview
```

These preview commands do not submit to the App Store or Google Play. The
current iOS preview profile is EAS internal distribution; TestFlight requires a
separately approved Apple Developer/App Store Connect path.

Store builds:

```bash
EXPO_PUBLIC_API_URL=https://campusconnect-api.onrender.com npm run build:android:production
EXPO_PUBLIC_API_URL=https://campusconnect-api.onrender.com npm run build:ios:production
```

## 5. Submit To Stores

Required outside this repo:

- Apple Developer Program membership
- Google Play Console account
- App Store Connect app record
- Google Play app record
- Privacy policy URL
- Support URL/contact
- Store screenshots and descriptions

Submit after production builds pass device testing:

```bash
npm run submit:android
npm run submit:ios
```

## 6. Release Gate

Before submission:

```bash
npm run typecheck
npm run doctor
EXPO_PUBLIC_API_URL=https://campusconnect-api.onrender.com npm run publish:check
cd backend && .venv/bin/python -m pytest
```

Also test all three seeded role flows against the hosted API:

- Member: browse, save, apply, connect, cannot post
- Student: browse, connect, apply, post Startup/Project
- Teacher: post Research and review applicants

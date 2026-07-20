# Unibridge EAS Internal Preview Build Checklist

Last prepared: 2026-06-29

Scope: EAS internal preview build preparation only. Do not deploy Render, run
EAS builds, submit to stores, use external credentials, change app identifiers,
change demo credentials, add dependencies, or upgrade Expo SDK from this
checklist unless the coordinator explicitly approves a separate task.

## Current Readiness Verdict

Internal preview builds are not yet runnable. The local EAS configuration is in
the expected shape, but the preview build gate remains blocked until the final
Render HTTPS API URL is confirmed, hosted health and role smoke tests pass, and
the EAS preview environment is configured with that exact URL.

The example URL below is only a URL-shape placeholder unless Render confirms it
as the final service URL:

```text
https://campusconnect-api.onrender.com
```

## Preflight Audit

Inspected files:

- `app.config.js`
- `eas.json`
- `package.json`
- `scripts/verify-publish-env.js`
- `.env.production.example`
- `assets/`
- `docs/PUBLISHING.md`
- `docs/RELEASE_STATUS.md`
- `docs/RENDER_PREVIEW_DEPLOYMENT.md`
- `README.md`

Findings:

- `eas.json` defines a `preview` build profile.
- The `preview` profile uses `"distribution": "internal"`.
- The `preview` profile maps to the EAS `preview` environment.
- Android preview builds are configured as APKs through
  `build.preview.android.buildType: "apk"`.
- The Android preview script is
  `EXPO_PUBLIC_API_URL=<final-render-url> npm run build:android:preview`.
- The iOS preview script is
  `EXPO_PUBLIC_API_URL=<final-render-url> npm run build:ios:preview`.
- iOS preview builds use EAS internal distribution, not TestFlight, with the
  current `preview` profile.
- `app.config.js` defines app identifiers:
  `com.unibridge.app` for both iOS and Android.
- Required visual assets exist:
  `assets/icon.png`, `assets/splash-icon.png`,
  `assets/android-icon-foreground.png`, `assets/android-icon-background.png`,
  `assets/android-icon-monochrome.png`, and `assets/favicon.png`.
- `app.config.js` rejects missing, invalid, non-HTTPS, localhost, emulator, and
  private LAN API URLs during EAS `preview` and `production` cloud builds.
- `scripts/verify-publish-env.js` applies the same URL-shape guard before
  publishable preview or production build scripts run.
- `.env.production.example` documents that the Render URL must be replaced with
  the final public HTTPS URL shown by Render after deployment.
- The repo currently uses Expo SDK 54 (`expo` `~54.0.35`), React Native
  `0.81.5`, and React `19.1.0`.
- SDK 54 is acceptable for this internal preview path once hosted-backend gates
  pass. SDK 56 review and upgrade work is deferred to production-store
  readiness because SDK 56 changes the React Native, React, Node, iOS, Android,
  and Xcode baselines.

## Exact Prerequisites

Before any EAS preview build is started:

- Render deployment is complete and the final public HTTPS API URL is copied
  from the Render service overview.
- The final URL has no trailing slash in `EXPO_PUBLIC_API_URL`.
- Hosted health checks pass against the final URL:

```bash
BASE_URL=<final-render-url>
curl -fsS "$BASE_URL/health"
curl -fsS "$BASE_URL/api/v1/health"
curl -fsS "$BASE_URL/api/v1/health/db"
```

- Release test accounts exist on the hosted backend through the approved
  production-safe process, not through the dev seed.
- Member, Student, and Teacher smoke tests pass against the hosted backend.
- Local preflight commands pass:

```bash
npm run typecheck
npm run doctor
EXPO_PUBLIC_API_URL=<final-render-url> npm run publish:check
npx expo config --type public --json
```

- The EAS project is initialized and associated with the correct Expo account.
- The EAS `preview` environment has `EXPO_PUBLIC_API_URL` set to the exact final
  Render HTTPS URL.
- iOS device strategy is confirmed before any iOS internal distribution build:
  registered ad hoc devices, Enterprise distribution, or a separate TestFlight
  path.
- The coordinator explicitly approves running EAS preview builds.

## Required EAS Account And Project Setup

These steps require an Expo account and may require Apple credentials for iOS.
They are external setup steps and were not run in this local preflight pass.

Initialize or confirm the EAS project once from the repo root:

```bash
npx eas login
npx eas init
```

Confirm the project is owned by the expected Expo account or organization and
that the local project is linked to that EAS project before builds are run.

Create or update the preview environment variable with the final Render URL:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value <final-render-url> --environment preview --visibility plaintext
```

If the variable already exists, update it in the Expo dashboard or with the EAS
CLI so the `preview` environment uses the exact same final URL used in local
`publish:check`. `EXPO_PUBLIC_API_URL` is client-side public configuration, so
do not treat it as a secret.

## Android Internal Preview APK

Run only after every gate above passes and the coordinator approves EAS builds:

```bash
EXPO_PUBLIC_API_URL=<final-render-url> npm run build:android:preview
```

Expected behavior:

- `npm run publish:check` runs first and rejects a missing or bad API URL.
- EAS uses the `preview` profile.
- The output artifact is an APK suitable for direct Android install and
  internal distribution.
- The app must be installed and smoke tested against the hosted Render API.

## iOS Internal Preview

Run only after every gate above passes, Apple/device setup is complete, and the
coordinator approves EAS builds:

```bash
EXPO_PUBLIC_API_URL=<final-render-url> npm run build:ios:preview
```

Expected behavior:

- `npm run publish:check` runs first and rejects a missing or bad API URL.
- EAS uses the `preview` profile with internal distribution.
- For ad hoc iOS distribution, only devices included in the provisioning profile
  at build time can install the app.
- New ad hoc devices must be registered before building, commonly with:

```bash
eas device:create
```

TestFlight note:

- The current `preview` profile is internal distribution, not TestFlight.
- TestFlight requires Apple Developer and App Store Connect setup and a
  submission path. That is outside this internal-preview preflight unless the
  coordinator explicitly switches the iOS preview strategy.
- Production App Store submission remains out of scope.

## Internal Preview Versus Production Store Submission

Internal preview:

- Goal: installable QA builds for approved testers.
- Backend: final Render HTTPS API URL, already health checked and role smoked.
- EAS profile: `preview`.
- Android artifact: APK.
- iOS path: internal distribution through ad hoc or enterprise provisioning, or
  a separately approved TestFlight path.
- Store listing, privacy URL, support URL, screenshots, and public release notes
  are not required for this gate.

Production store submission:

- Goal: public App Store and Google Play release.
- EAS profile: `production`.
- Requires Apple Developer Program, Google Play Console, store app records,
  privacy/support URLs, store metadata, screenshots, production device testing,
  and submission approval.
- SDK 56 upgrade review is deferred to this production-store readiness track.

## Output To Send Back To Coordinator After Builds

After approved EAS preview builds finish, report:

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

Until these values are filled with real hosted and EAS build results, the
internal preview remains blocked by missing external Render/EAS confirmation.

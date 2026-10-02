# Release 1.1.0 — redesign, Azerbaijani-first, compliance

Release preparation draft, audited 2026-10-02. Store text below requires
final release verification and real-device QA before submission.
Legal pages remain DRAFT with unresolved placeholders; see COMPLIANCE.md.

## Verified release facts and unresolved gates

- The live EAS Apple status check reported app `6799017393`, version 1.0.0
  build 2, **READY_FOR_DISTRIBUTION**. The September Information Needed
  instructions are historical. Create a new 1.1.0 version; confirm current
  state in App Store Connect before editing.
- EAS production environment listing contained the required
  `EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com` and no
  `EXPO_PUBLIC_SENTRY_DSN`; production profile flags do not enable it.
- Read-only Render inspection found service `srv-d91q087avr4c73fqpus0` on
  commit `d030f20015d2e897c91b92f50de269834a615612`. Its 14 environment-variable
  names contained no Sentry DSN, Anthropic API key, Google OAuth client IDs
  or SMTP keys, with values masked; no linked environment groups or secret
  files were shown. Dockerfile/settings inspection supports that those
  optional providers are **not configured in this deployment**.
- Render migration logs confirm `202610020010` and `202610020011` applied
  on October 2, 2026 at **10:39:41 EDT (14:39:41 UTC)**; subsequent predeploy
  and health checks succeeded. The release consent fixes have **not** been
  deployed to the older backend commit above.

## Build and store progress — October 2, 2026

| Platform | Verified result |
|---|---|
| iOS | **FINISHED**, 1.1.0 (4), build `1fc72115-2a41-4b32-ae7d-610b8b365d2c`, release commit `3872057` |
| iOS upload | Submission `5d41c53b-782a-4827-9d9d-263db58ffc45` **FINISHED at 18:57:49 UTC** |
| Apple processing | 1.1.0 (4) **VALID / IN_BETA_TESTING**; external testing **READY_FOR_BETA_SUBMISSION**. This does not establish external-tester access or App Review submission. |
| Android | **FINISHED at 19:08:03 UTC**, 1.1.0 (8), build `a9de5156-a908-468f-9a08-cda6a1860ccf`; original AAB manifest confirms compile/target SDK **36** |
| Android upload | EAS Submit could not schedule because no Google service account is configured. No key was created. The manual internal release remains a draft awaiting AAB upload. |

Android artifact: `../artifacts/unibridge-1.1.0-8.aab` relative to the repository
root (59,255,227 bytes). Resume the existing [Play internal release draft](https://play.google.com/console/u/1/developers/8812445908314987117/app/4975225834609246994/tracks/4701542745689890167/releases/2/prepare).

Google Play has saved the Azerbaijani default listing plus English/Russian
drafts, reused the existing icon/feature graphic, and saved the 18+ target
audience. Matching native phone screenshots remain missing. The Apple browser
session is not logged in; use a secure owner sign-in for console metadata work.

**No final store reviews were submitted.** Real-phone QA, legal DRAFT
resolution, final privacy/data-safety category mapping and native screenshots
remain pending. Effective date and provider/retention placeholders are not
legal approval. Simulator/web previews do not count as real-phone QA.
No backend-fix deployment or rollout-enforcement change was made.

## Order of operations

1. Verify the release commit, app version 1.1.0, production environment,
   signing configuration and existing plan allowance. Preserve unrelated
   working changes. Obtain approval before any new charge, credential/grant
   creation or legal-agreement acceptance.
2. Review backend compatibility and consent fixes before deployment. Merging
   `main` can trigger Render and public legal-page deployment; do not do that
   as an incidental build step. The migrations above are confirmed applied;
   before launch, verify required provisioning and server-side
   consent enforcement for content writes, including old clients. Leaving
   the global terms flag off must not leave a path to create UGC without
   accepting current terms. Coordinate any backend deployment separately.
3. Both native builds above are complete. Reuse them unless a material fix
   requires rebuilding. For any necessary rebuild, use the verified release
   source. Check current store SDK/target requirements and EAS image first.
   EAS increments build numbers; record each build ID and actual version.
   ```
   EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:ios:production
   EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:android:production
   ```
   Added native modules require a new binary, not an OTA update. Monitor each
   build to completion. Rebuild only if a material fix requires it.
4. The iOS upload above is complete. Finish the Android AAB upload in the
   existing Play **internal testing** draft and verify tester access. Inspect submit profile/track first; do not use an ambiguous
   `--latest` or let an upload release directly to production. iOS EAS Submit
   uploads to TestFlight; it does not submit App Review. Verify processing
   and tester availability in both consoles.
5. Test on a real iPhone and Android phone, recording build/version and result:
   - new signup requires both confirmations; existing-user login → terms → tabs;
   - notification prompt (Allow and Not now), delivery and push switch;
   - profile/post sheets open and drag correctly;
   - Me → Download my data opens a share sheet containing JSON **text** on
     native, not a file attachment; verify usable output with installed targets;
   - account deletion (obtain separate confirmation for each permanent deletion);
   - AZ/RU/EN switching and localized pushes;
   - admin report pushes and Me → Moderation;
   - old-client/unaccepted-account content-write protection.
6. Prepare current native screenshots and truthful console disclosures below.
   After QA and unresolved disclosure/legal gates are resolved, submit 1.1.0
   for review. Do not claim approval or availability until store status confirms.
7. After the release is live and rollout evidence shows most users updated,
   review enabling `UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE=true`. Do not
   enable it or minimum-version enforcement during release preparation.

## Moderation alerts (do this before launch)

The draft Terms promise action on reports within 8 hours. Confirm the owner
can meet that commitment and obtain legal review before publishing it. Verify
alert delivery before launch:

1. **Push:** install the 1.1.0 build on your phone, sign in with the admin
   account through an existing secure sign-in and allow notifications. Do not
   retrieve or paste credentials into chat. Every new report then arrives as
   "New report to review"; tapping it opens Me → Moderation.
2. **Email (optional, recommended as a backup):**
   - SMTP is not configured in the inspected deployment. If the owner chooses
     to enable email alerts, new app passwords, grants or account-security
     changes require approval and a secure owner-operated handoff.
   - In Render, set `UNIVERSITY_PORTAL_SMTP_HOST=smtp.gmail.com`,
     `UNIVERSITY_PORTAL_SMTP_USERNAME` and `UNIVERSITY_PORTAL_SMTP_FROM` to
     the Gmail address, and `UNIVERSITY_PORTAL_SMTP_PASSWORD` to the app
     password.
   - `UNIVERSITY_PORTAL_MODERATION_ALERT_EMAIL` is already set to
     ibrahimaliworkacc@gmail.com in render.yaml.
   - Update the privacy provider table only after the actual configuration
     and provider processing have been verified; do not assume Gmail is active.
3. Test it: file a report from another account and check the admin push.
   Test email separately only after SMTP is configured; do not expect it in
   the current deployment.

## What's New

**Azerbaijani (Play primary listing):**
```
Unibridge yeni görünüşdə! Azərbaycandan ilhamlanan dizayn, aşağıda naviqasiya paneli, profillər və elanlar üçün sürüşən panellər. Tətbiq artıq tam Azərbaycan dilindədir: tarixlər, bildirişlər və xəta mesajları da daxil olmaqla. Yeni: məlumatlarınızın surətini paylaşmaq, bildirişləri idarə etmək və hüquqi sənədlər "Mən" bölməsində.
```

**English:**
```
A fresh new look inspired by Azerbaijan, with a bottom tab bar and slide-up panels for profiles and posts. The app is now fully available in Azerbaijani, including dates, notifications, and error messages. New in the Me tab: share a copy of your data, manage notifications, and read the legal documents.
```

**Russian:**
```
Новый дизайн, вдохновлённый Азербайджаном: нижняя панель вкладок и выдвижные панели для профилей и публикаций. Приложение полностью доступно на азербайджанском языке, включая даты, уведомления и сообщения об ошибках. Новое на вкладке «Я»: экспорт своих данных, управление уведомлениями и правовые документы.
```

## App Review Information → Notes (App Store) / App access (Play)

**DRAFT — not ready to paste until release gates pass.** Verify the reviewer
role/login and stated flows on the final build, and have the owner enter
credentials directly in each console using a secure handoff.

```
Log in with the credentials above (Student role). If this account has not accepted the current legal version, the app shows its Terms of Service and Privacy Policy screen: tick both boxes ("I agree..." and "I confirm I am 18 or older") and tap "Agree and continue". If notification permission can still be requested, the app offers an explanation screen and then the system prompt after Allow; prior permissions affect this flow.

The interface defaults to Azerbaijani; tap the language button (AZ) in the top-right corner of the header to switch to English or Russian.

Anyone can create a Member account with "Create account" (it requires the same two confirmations). Member accounts can browse, save, apply, connect, and message. Posting opportunities and reviewing applicants require a Student or Teacher role, granted by university administrators, so the provided account is the easiest way to review those flows.

Safety and account controls: Report and Block are on every profile and post (tap a card to open it). The Me tab contains Download my data (shares JSON text on iOS/Android), the push notification switch, links to the Terms, Privacy Policy, Child Safety Standards, and open-source licences, and Delete Account at the bottom.

External services: our own API on Render (FastAPI/PostgreSQL, HTTPS) and Expo Push Notification Service (APNs on iOS / FCM on Android). No payments, in-app purchases or advertising are offered. Personalized profile/opportunity recommendations use account/profile data. Third-party sign-in and the optional AI assistant are not enabled in the inspected deployment.

Audience: university students and staff aged 18+.
```

The current external-services paragraph reflects the inspected EAS inputs and
Render deployment; Sentry and Anthropic are omitted because they are not
configured, not because the SDKs are absent. If either is enabled later,
revise the notes and privacy/data safety answers before release. Sentry can
collect crash and performance data; disabling default PII is not an anonymity
guarantee. Render retention/backup details and legal placeholders remain
unresolved. No backend deployment or rollout-enforcement change was made.

## Console changes for this release (YOU)

App Store Connect:
- Version 1.1.0; paste "What's New" (English; add Russian if you add a
  Russian localisation).
- Age rating minimum 18+ using truthful questionnaire answers. Any custom
  licence agreement must use approved text in the console's supported format;
  a Terms URL alone is not a completed custom EULA.
- App Privacy: include messages, consent records, push Device ID, profile
  location and Product Personalization purposes. Resolve free-text location
  precision and provider/linkage checks in `app-privacy.md`; Sentry can require
  both Crash Data and Performance Data.

Google Play Console:
- Main store listing language → Azerbaijani; paste the AZ and RU texts from
  `play-listing.md`.
- Target audience 18+ only; Data safety per `data-safety.md` (messages,
  profile location, personalization, device IDs for push, and diagnostics as
  applicable); delete-account URL.

Legal pages are published by the repository's deployment flow and still carry
DRAFT banners and unresolved placeholders. Their accuracy/completeness has
not been certified. Resolve them with the owner/lawyer before final submission;
do not remove warnings or invent legal terms (COMPLIANCE.md).

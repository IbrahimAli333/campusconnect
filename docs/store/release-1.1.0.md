# Release 1.1.0 — redesign, Azerbaijani-first, compliance

Release preparation draft, audited 2026-10-02. Store text below requires
final build/provider verification and real-device QA before submission.
Legal pages remain DRAFT with unresolved placeholders; see COMPLIANCE.md.

## Verified release facts and unresolved gates

- The live EAS Apple status check reported app `6799017393`, version 1.0.0
  build 2, **READY_FOR_DISTRIBUTION**. The September Information Needed
  instructions are historical. Create a new 1.1.0 version; confirm current
  state in App Store Connect before editing.
- EAS production environment listing contained the required
  `EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com` and no
  `EXPO_PUBLIC_SENTRY_DSN`. Verify the actual build inputs; backend Sentry,
  Anthropic, Google OAuth and SMTP configuration are still **UNVERIFIED**.
- Do not describe legal pages as approved or complete. Effective date,
  provider/retention details and other legal placeholders require resolution.
- A simulator/web preview is not real-phone QA. Neither store's final review
  submission is ready until the required phone checks below have passed.

## Order of operations

1. Verify the release commit, app version 1.1.0, production environment,
   signing configuration and existing plan allowance. Preserve unrelated
   working changes. Obtain approval before any new charge, credential/grant
   creation or legal-agreement acceptance.
2. Review backend compatibility and consent fixes before deployment. Merging
   `main` can trigger Render and public legal-page deployment; do not do that
   as an incidental build step. Before launch, verify deployed migrations
   `202610020010` and `202610020011`, required provisioning, and server-side
   consent enforcement for content writes, including old clients. Leaving
   the global terms flag off must not leave a path to create UGC without
   accepting current terms. Coordinate any backend deployment separately.
3. Build a full native binary once per platform from the verified release
   source. Check current store SDK/target requirements and EAS image first.
   EAS increments build numbers; record each build ID and actual version.
   ```
   EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:ios:production
   EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:android:production
   ```
   Added native modules require a new binary, not an OTA update. Monitor each
   build to completion. Rebuild only if a material fix requires it.
4. Upload those exact successful build IDs to TestFlight and Play **internal
   testing**. Inspect submit profile/track first; do not use an ambiguous
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
   - First confirm whether SMTP is already configured and which provider is
     in use. New app passwords, grants or account-security changes require
     owner approval and a secure owner-operated handoff.
   - In Render, set `UNIVERSITY_PORTAL_SMTP_HOST=smtp.gmail.com`,
     `UNIVERSITY_PORTAL_SMTP_USERNAME` and `UNIVERSITY_PORTAL_SMTP_FROM` to
     the Gmail address, and `UNIVERSITY_PORTAL_SMTP_PASSWORD` to the app
     password.
   - `UNIVERSITY_PORTAL_MODERATION_ALERT_EMAIL` is already set to
     ibrahimaliworkacc@gmail.com in render.yaml.
   - Update the privacy provider table only after the actual configuration
     and provider processing have been verified; do not assume Gmail is active.
3. Test it: file a report from another account and check that both the
   push and the email arrive.

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

**DRAFT — not ready to paste.** Resolve every bracketed verification item,
verify the reviewer role/login on the final build, and have the owner enter
credentials directly in each console using a secure handoff.

```
Log in with the credentials above (Student role). If this account has not accepted the current legal version, the app shows its Terms of Service and Privacy Policy screen: tick both boxes ("I agree..." and "I confirm I am 18 or older") and tap "Agree and continue". If notification permission can still be requested, the app offers an explanation screen and then the system prompt after Allow; prior permissions affect this flow.

The interface defaults to Azerbaijani; tap the language button (AZ) in the top-right corner of the header to switch to English or Russian.

Anyone can create a Member account with "Create account" (it requires the same two confirmations). Member accounts can browse, save, apply, connect, and message. Posting opportunities and reviewing applicants require a Student or Teacher role, granted by university administrators, so the provided account is the easiest way to review those flows.

Safety and account controls: Report and Block are on every profile and post (tap a card to open it). The Me tab contains Download my data (shares JSON text on iOS/Android), the push notification switch, links to the Terms, Privacy Policy, Child Safety Standards, and open-source licences, and Delete Account at the bottom.

External services: our own API on Render (FastAPI/PostgreSQL, HTTPS); Expo Push Notification Service (APNs on iOS / FCM on Android). [VERIFY FINAL BINARY: native Sentry is expected off with the audited production environment; if enabled, describe crash/error reporting and 10% performance sampling.] [VERIFY BACKEND: Sentry, Anthropic Opportunity Assistant, SMTP provider and Google OAuth configuration; list only the services actually enabled and describe their data and retention accurately.] No payments, in-app purchases or advertising were found in the audited app. Personalized profile/opportunity recommendations use account/profile data. [VERIFY partner practices before asserting no tracking.] Google sign-in is not offered on iOS in the audited configuration.

Audience: university students and staff aged 18+.
```

Removing the native Sentry reference does not establish that backend Sentry
is off. `sendDefaultPii: false` is not a guarantee that no personal data is
present in diagnostics. Verify provider state without copying secrets into
chat; revise the privacy/data safety drafts to match final deployed behavior.

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

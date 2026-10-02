# Release 1.1.0 — redesign, Azerbaijani-first, compliance

Everything to paste or change for this release. Items marked YOU need the
account owner. See COMPLIANCE.md for the legal background.

## Order of operations

1. YOU: merge the release branch into `main`.
2. Render deploys the backend; its pre-deploy step runs migrations
   `202610020010` (consent fields) and `202610020011` (push language).
   Confirm `UNIVERSITY_PORTAL_ENABLE_LEGACY_ACADEMIC_API=false` and
   `UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE=false` in the dashboard
   (render.yaml sets both).
3. Build and submit (EAS increments the build number automatically):
   ```
   EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:ios:production
   npm run submit:ios
   EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:android:production
   npm run submit:android
   ```
   This release adds native modules (navigation, Reanimated, gesture
   handler, bottom sheet, haptics, gradients, fonts), so it must ship as a
   new binary; it cannot be delivered over the air.
4. Test on a real iPhone (TestFlight) and Android phone (internal testing):
   - login → terms screen for existing users → tabs;
   - the notification prompt (Allow and Not now);
   - opening and dragging the detail sheets;
   - Me → Download my data (share sheet);
   - the push switch;
   - account deletion;
   - switching to RU/EN and back to AZ (pushes should follow).
5. YOU: update the store consoles (below), then submit for review.
6. Later: once 1.1.0 is the oldest version in use, set
   `UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE=true` in Render.

## Moderation alerts (do this before launch)

The Terms promise action on reports within 8 hours. To be told
immediately:

1. **Push:** install the 1.1.0 build on your phone, sign in with the admin
   account (`UNIVERSITY_PORTAL_ADMIN_EMAIL`, i.e.
   ibrahimaliworkacc@gmail.com, with the password from the Render
   dashboard), and allow notifications. Every new report then arrives as
   "New report to review"; tapping it opens Me → Moderation.
2. **Email (optional, recommended as a backup):**
   - In your Google account, turn on 2-step verification and create an
     **app password** (Google Account → Security → App passwords).
   - In Render, set `UNIVERSITY_PORTAL_SMTP_HOST=smtp.gmail.com`,
     `UNIVERSITY_PORTAL_SMTP_USERNAME` and `UNIVERSITY_PORTAL_SMTP_FROM` to
     the Gmail address, and `UNIVERSITY_PORTAL_SMTP_PASSWORD` to the app
     password.
   - `UNIVERSITY_PORTAL_MODERATION_ALERT_EMAIL` is already set to
     ibrahimaliworkacc@gmail.com in render.yaml.
   - Then replace the TODO in the privacy policy's provider table with
     "Google LLC (Gmail)".
3. Test it: file a report from another account and check that both the
   push and the email arrive.

## What's New

**Azerbaijani (Play primary listing):**
```
Unibridge yeni görünüşdə! Azərbaycandan ilhamlanan dizayn, aşağıda naviqasiya paneli, profillər və elanlar üçün sürüşən panellər. Tətbiq artıq tam Azərbaycan dilindədir: tarixlər, bildirişlər və xəta mesajları da daxil olmaqla. Yeni: məlumatlarınızı endirmək, bildirişləri idarə etmək və hüquqi sənədlər "Mən" bölməsində.
```

**English:**
```
A fresh new look inspired by Azerbaijan, with a bottom tab bar and slide-up panels for profiles and posts. The app is now fully available in Azerbaijani, including dates, notifications, and error messages. New in the Me tab: download your data, manage notifications, and read the legal documents.
```

**Russian:**
```
Новый дизайн, вдохновлённый Азербайджаном: нижняя панель вкладок и выдвижные панели для профилей и публикаций. Приложение полностью доступно на азербайджанском языке, включая даты, уведомления и сообщения об ошибках. Новое на вкладке «Я»: скачивание своих данных, управление уведомлениями и правовые документы.
```

## App Review Information → Notes (App Store) / App access (Play)

```
Log in with the credentials above (Student role). On first login the app shows its Terms of Service and Privacy Policy screen: tick both boxes ("I agree..." and "I confirm I am 18 or older") and tap "Agree and continue". The app then asks whether to turn on notifications (our own explanation screen, then the system dialog if you tap Allow).

The interface defaults to Azerbaijani; tap the language button (AZ) in the top-right corner of the header to switch to English or Russian.

Anyone can create a Member account with "Create account" (it requires the same two confirmations). Member accounts can browse, save, apply, connect, and message. Posting opportunities and reviewing applicants require a Student or Teacher role, granted by university administrators, so the provided account is the easiest way to review those flows.

Safety and account controls: Report and Block are on every profile and post (tap a card to open it). The Me tab contains Download my data, the push notification switch, links to the Terms, Privacy Policy, Child Safety Standards, and open-source licences, and Delete Account at the bottom.

External services: our own API on Render (FastAPI/PostgreSQL, HTTPS); Expo Push Notification Service (via APNs); Sentry crash reporting (no personal data attached); Anthropic Claude for the optional Opportunity Assistant when it is enabled on our server (the user's query and public post text only). No payments, in-app purchases, analytics, ads, or tracking. Google sign-in is not offered on iOS.

Audience: university students and staff aged 18+.
```

Adjust the external-services paragraph to match reality on submission
day:
- **Sentry:** remove it if this build is not made with
  EXPO_PUBLIC_SENTRY_DSN set.
- **Anthropic:** remove it if UNIVERSITY_PORTAL_ANTHROPIC_API_KEY is not
  set in Render.

## Console changes for this release (YOU)

App Store Connect:
- Version 1.1.0; paste "What's New" (English; add Russian if you add a
  Russian localisation).
- Age rating 18+; custom licence agreement → Terms URL (after lawyer
  approval).
- App Privacy: add *Emails or Text Messages*, *Other Data Types* (consent
  record), and *Diagnostics → Crash Data* if Sentry is on (see
  `app-privacy.md`).

Google Play Console:
- Main store listing language → Azerbaijani; paste the AZ and RU texts from
  `play-listing.md`.
- Target audience 18+ only; Data safety per `data-safety.md` (messages,
  device IDs for push, crash logs if Sentry is on); delete-account URL.

Legal pages: they go live on GitHub Pages when `main` is updated. They are
accurate but still carry a DRAFT banner until the lawyer approves them
(COMPLIANCE.md).

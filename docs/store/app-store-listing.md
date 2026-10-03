# App Store listing - Unibridge

Everything below is ready to paste into App Store Connect. Items marked YOU
require actions only the account owner can do. Companion file:
app-privacy.md (Apple App Privacy questionnaire answers).

## App details

- **App name (max 30 chars):** `Unibridge`
  - Name availability is only checked when the app record is created in App
    Store Connect. If taken, fallback: `Unibridge: Uni Network` (26).
- **Subtitle (max 30 chars):** `Campus research & networking` (28)
- **Promotional text (max 170 chars, editable without review):**

```
Discover research, startups, and internships across your campus. Apply in one tap, connect with students and faculty, and message collaborators.
```

- **Description (max 4000 chars):** reuse the full description from
  play-listing.md verbatim (it is well under the limit).
- **Keywords (max 100 chars, comma-separated):**

```
campus,university,research,startup,internship,networking,students,faculty,mentorship,opportunities
```

- **Primary category:** Social Networking (secondary: Education)
- **Age rating: 18+.** The audience is university students and staff and
  the app requires every user to confirm they are 18 or older at signup
  (see COMPLIANCE.md). Answer the age rating questionnaire truthfully
  (user-generated content: yes; messaging/chat: yes; no mature themes,
  violence, gambling, or unrestricted web access), then YOU set the
  minimum age to **18+** using the option to apply a higher age rating
  than the questionnaire result. Report + block + contact info are all
  present, which Apple requires for UGC apps under Guideline 1.2.
- **License agreement (EULA):** YOU set a custom EULA in App Store Connect
  (App Information → License Agreement) pointing to the Terms of Service
  once the lawyer has approved them; the Terms include the zero-tolerance
  clause Guideline 1.2 expects.
- **Support URL:** https://ibrahimali333.github.io/campusconnect/ (the
  public landing page with support email, Terms, Privacy Policy, and
  account deletion links; the GitHub repo is not a support page)
- **Privacy policy URL:** https://ibrahimali333.github.io/campusconnect/privacy-policy.html
- **Terms of Service URL:** https://ibrahimali333.github.io/campusconnect/terms.html
- **Contact email:** ibrahimaliworkacc@gmail.com
- **Copyright:** `2026 Ibrahim Ali Khudiyev`

## App Review Information (sign-in required)

Check "Sign-in required" and provide a demo credential set. The reviewer
account (reviewer@example.edu) is provisioned automatically on deploy once
UNIVERSITY_PORTAL_REVIEWER_PASSWORD is set in the Render dashboard — read the
password from there. The same account serves Google Play review; do NOT hand
out the shared demo accounts.

Public email/password sign-up exists (added 2026-07-20) and creates Member
accounts. Posting roles (student/teacher) are provisioned by administrators
or university SSO. The notes below say exactly that — do not claim sign-up
is unavailable, since the reviewer will see the Create account button.

```
Email: reviewer@example.edu
Password: <UNIVERSITY_PORTAL_REVIEWER_PASSWORD from the Render dashboard>
Notes: Log in with the credentials above to review the full app. On first
login the app asks you to accept the Terms of Service and Privacy Policy
and confirm you are 18 or older; tick both boxes and tap "Agree and
continue". Anyone can also create a Member account with the "Create
account" button (it requires the same two confirmations); Member
accounts can browse, save, apply, connect, and message. Posting
opportunities requires a student or teacher role, which is granted by
university administrators, so the provided account is the easiest way to
review posting and applicant-review flows. Report, block, and account
deletion are available from within the app.
```

## Screenshots (done 2026-09-07)

The App Store Connect iPhone slot for this app is labelled 6.5" and REJECTS
the native iPhone 17 Pro Max capture (1320x2868); it accepts 1284x2778.

- Native captures: docs/store/assets/ios/ (1320x2868).
- Uploaded set: docs/store/assets/ios-6.5/ (1284x2778, downscaled with
  `sips --resampleWidth 1284` then `sips -c 2778 1284`).
- Capture with `xcrun simctl io booted screenshot` on the simulator; check
  for the iOS Keychain "Save Password?" prompt before saving — it ruined
  the first Discover capture.

## Screenshots for 1.1.0 (redesign, Azerbaijani)

The 2026-09-07 set above shows the old design. The 1.1.0 set is in
docs/store/assets/1.1.0/, six screens each (Discover, Posts, Network,
Applications, Me, profile panel):

- ios-6.5/ (1284x2778) — upload to the App Store 6.5" slot.
- ios-6.9/ (1320x2868) — native size, for reference.
- android/ (1080x1920) — Play Console phone screenshots.
- ipad-13/ (2064x2752) — App Store iPad slot.

They are captured from the web build (no iOS status bar) with demo data
translated into Azerbaijani; no real users appear. Retake on the
simulator if Apple asks for device captures.

## Guideline traps specific to this app

- **Sign in with Apple (Guideline 4.8):** only triggered if a third-party
  social login is offered. Ship iOS with Google SSO DISABLED (do not set
  EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID for iOS builds) until Sign in with
  Apple is implemented alongside it. Email/password login alone is fine.
- **Account deletion (5.1.1(v)):** required and already implemented (Me tab).
- **UGC moderation (1.2):** report + block + in-app contact are already
  implemented; mention them in Review Notes if asked.

## Contact details

Unibridge is run by an individual, not a company, so there is no business
address, phone, or registration number to publish.

- **Seller / developer name:** Ibrahim Ali Khudiyev (personal Apple Developer account;
  Apple shows the account holder's name)
- **Support / contact email:** ibrahimaliworkacc@gmail.com
- **EU DSA trader status:** YOU declare it in App Store Connect
  (Business → Trader status). A free app with no income, run by an
  individual, is normally declared **non-trader**, so no address or phone
  is published. Choose "trader" only if you start earning from the app.

## Release 1.1.0

Release steps, "What's New" text (AZ/EN/RU), and updated App Review notes
are in `release-1.1.0.md`.

## Checklist before submitting

- [ ] YOU: Apple Developer Program enrollment approved ($99/yr).
- [ ] YOU: accept agreements in App Store Connect (Agreements, Tax, Banking -
      free apps still need the free-app agreement accepted).
- [ ] Create the app record in App Store Connect (bundle ID
      com.unibridge.app - must match app.config.js, do not change it).
- [ ] First iOS build: `EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:ios:production`
      (cloud build; EAS prompts for the Apple ID login once and then creates
      the distribution certificate, provisioning profile, and APNs key
      automatically - say yes to all credential prompts).
- [ ] Submit to TestFlight: `npm run submit:ios` (or `npx eas submit -p ios --latest`).
- [ ] Verify on a real iPhone via TestFlight: login vs prod, push delivery
      (APNs path is separate from the verified FCM path), session restore,
      report/block/delete flows.
- [ ] Screenshots captured at an accepted iPhone size (see above).
- [ ] App Privacy questionnaire filled in (app-privacy.md) — re-check it:
      the data types changed on 2026-10-02 (messages, diagnostics).
- [ ] YOU: age rating set to 18+ (see App details).
- [ ] YOU: custom EULA set to the approved Terms URL.
- [ ] Lawyer has approved terms.html and privacy-policy.html and the DRAFT
      banners have been removed (COMPLIANCE.md).
- [ ] Reviewer account credentials filled into App Review Information.
- [ ] Submit for review.

# App Store listing - CampusConnect

Everything below is ready to paste into App Store Connect. Items marked YOU
require actions only the account owner can do. Companion file:
app-privacy.md (Apple App Privacy questionnaire answers).

## App details

- **App name (max 30 chars):** `CampusConnect`
  - Name availability is only checked when the app record is created in App
    Store Connect. If taken, fallback: `CampusConnect: Uni Network` (26).
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
- **Age rating questionnaire:** answers match the IARC section in
  play-listing.md; expect 4+ with the unrestricted-web/UGC disclosures
  (report + block + contact info are all present, which Apple requires
  for UGC apps under Guideline 1.2).
- **Support URL:** https://github.com/IbrahimAli333/campusconnect
- **Privacy policy URL:** https://ibrahimali333.github.io/campusconnect/privacy-policy.html
- **Contact email:** ibrahimaliworkacc@gmail.com
- **Copyright:** Ibrahim Khudiyev

## App Review Information (sign-in required)

The app is invite-based, so check "Sign-in required" and provide a demo
credential set. The reviewer account (reviewer@example.edu, student role) is
provisioned automatically on deploy once UNIVERSITY_PORTAL_REVIEWER_PASSWORD
is set in the Render dashboard — read the password from there. The same
account serves Google Play review; do NOT hand out the shared demo accounts.

```
Email: reviewer@example.edu
Password: <UNIVERSITY_PORTAL_REVIEWER_PASSWORD from the Render dashboard>
Notes: Log in with the credentials above. All app functionality
(discover, apply, post, connect, message, report, block, delete account)
is available to this account. Accounts are provisioned by campus or
program administrators, which is why public sign-up is not offered.
```

## Screenshots (required before submission)

Apple accepts one size since 2025: 6.9" (1320x2868) or 6.7" (1290x2796).
The existing Android captures (1080x1920) are NOT accepted.

- Capture on the iOS Simulator (needs Xcode installed) or a physical
  iPhone running the TestFlight build; `Cmd+S` in Simulator saves at the
  correct native resolution.
- Reuse the same four scenes as Android: Discover, Posts, Me, Network.

## Guideline traps specific to this app

- **Sign in with Apple (Guideline 4.8):** only triggered if a third-party
  social login is offered. Ship iOS with Google SSO DISABLED (do not set
  EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID for iOS builds) until Sign in with
  Apple is implemented alongside it. Email/password login alone is fine.
- **Account deletion (5.1.1(v)):** required and already implemented (Me tab).
- **UGC moderation (1.2):** report + block + in-app contact are already
  implemented; mention them in Review Notes if asked.

## Checklist before submitting

- [ ] YOU: Apple Developer Program enrollment approved ($99/yr).
- [ ] YOU: accept agreements in App Store Connect (Agreements, Tax, Banking -
      free apps still need the free-app agreement accepted).
- [ ] Create the app record in App Store Connect (bundle ID
      com.ibrahimalikhudiyev.campusconnect - must match app.config.js, do not change it).
- [ ] First iOS build: `EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com npm run build:ios:production`
      (cloud build; EAS prompts for the Apple ID login once and then creates
      the distribution certificate, provisioning profile, and APNs key
      automatically - say yes to all credential prompts).
- [ ] Submit to TestFlight: `npm run submit:ios` (or `npx eas submit -p ios --latest`).
- [ ] Verify on a real iPhone via TestFlight: login vs prod, push delivery
      (APNs path is separate from the verified FCM path), session restore,
      report/block/delete flows.
- [ ] Screenshots captured at an accepted iPhone size (see above).
- [ ] App Privacy questionnaire filled in (app-privacy.md).
- [ ] Reviewer account credentials filled into App Review Information.
- [ ] Submit for review.

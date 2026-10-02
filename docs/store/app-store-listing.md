# App Store listing - Unibridge

Draft for App Store Connect. Resolve the release, legal and disclosure
gates in release-1.1.0.md before submission. Items marked YOU need the owner.
Companion file:
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
  (App Information → License Agreement) using the approved agreement text
  in the console's supported format; a Terms URL alone is insufficient. The
  draft Terms include the zero-tolerance
  clause referenced in the compliance draft. See [Apple custom EULA
  instructions](https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement/).
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
UNIVERSITY_PORTAL_REVIEWER_PASSWORD is configured. Verify access on the final
build. The owner must enter the password directly into each store console
using a secure handoff; do not retrieve or put credentials in chat or use
shared demo accounts.

Public email/password sign-up exists (added 2026-07-20) and creates Member
accounts. Posting roles (student/teacher) are provisioned by administrators
or university SSO. The notes below say exactly that — do not claim sign-up
is unavailable, since the reviewer will see the Create account button.

```
Email: reviewer@example.edu
Password: <owner enters directly in console; never in chat>
Notes: Log in with the credentials above to review the full app. If this
account has not accepted the current legal version, the app asks you to
accept the Terms of Service and Privacy Policy
and confirm you are 18 or older; tick both boxes and tap "Agree and
continue". Anyone can also create a Member account with the "Create
account" button (it requires the same two confirmations); Member
accounts can browse, save, apply, connect, and message. Posting
opportunities requires a student or teacher role, which is granted by
university administrators, so the provided account is the easiest way to
review posting and applicant-review flows. Report, block, and account
deletion are available from within the app.
```

## Screenshots (historical 1.0 set from 2026-09-07)

These pre-redesign images are not ready for 1.1.0. Capture the final native
UI again and check current slot requirements in App Store Connect. Historical
accepted dimensions below are not a guarantee for the current console.

The historical App Store Connect iPhone slot was labelled 6.5" and rejected
the native iPhone 17 Pro Max capture (1320x2868); it accepted 1284x2778.

- Native captures: docs/store/assets/ios/ (1320x2868).
- Uploaded set: docs/store/assets/ios-6.5/ (1284x2778, downscaled with
  `sips --resampleWidth 1284` then `sips -c 2778 1284`).
- Capture with `xcrun simctl io booted screenshot` on the simulator; check
  for the iOS Keychain "Save Password?" prompt before saving — it ruined
  the first Discover capture.

## Guideline traps specific to this app

- **Sign in with Apple (Guideline 4.8):** only triggered if a third-party
  social login is offered. Ship iOS with Google SSO DISABLED (do not set
  EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID for iOS builds) until Sign in with
  Apple is implemented alongside it. Email/password login alone is fine.
- **Account deletion (5.1.1(v)):** required and already implemented (Me tab).
- **UGC moderation (1.2):** report + block + in-app contact are already
  implemented; mention them in Review Notes if asked.

## Contact details

Verify required public contact and identity details in the current console.
Individual ownership or free pricing does not alone settle disclosure duties.

- **Seller / developer name:** Ibrahim Ali Khudiyev (personal Apple Developer account;
  Apple shows the account holder's name)
- **Support / contact email:** ibrahimaliworkacc@gmail.com
- **EU DSA trader status:** the owner must determine and attest the correct
  status, with legal guidance as needed. Do not infer non-trader status solely
  from free pricing or make this declaration automatically.

## Release 1.1.0

Release steps, "What's New" text (AZ/EN/RU), and updated App Review notes
are in `release-1.1.0.md`.

## Checklist before submitting

- [ ] Verify active Apple membership and existing agreements; new charges or
      agreement acceptance require owner approval.
- [ ] Existing app `6799017393` / bundle ID `com.unibridge.app` is the target.
      The 2026-10-02 EAS Apple check reported 1.0.0 (2) READY_FOR_DISTRIBUTION;
      verify current console status and create the 1.1.0 version.
- [ ] Build from verified source with production API and existing signing
      assets. Stop for approval if new credentials or grants are required.
- [ ] Upload the exact verified build to TestFlight and verify processing and
      tester availability. Do not use an ambiguous latest-build shortcut.
- [ ] Complete real-iPhone QA against production, including APNs, consent,
      session restore, report/block and export; obtain separate confirmation
      before any permanent test-account deletion.
- [ ] New matching native screenshots at current accepted sizes; simulator
      screenshots are not proof of real-phone QA.
- [ ] Resolve all app-privacy.md items: location, push Device ID, personalization,
      provider/linkage checks and conditional Crash Data + Performance Data.
- [ ] Truthful age questionnaire and minimum age 18+.
- [ ] Legal pages approved, unresolved placeholders filled and DRAFT warnings
      removed only by the authorized owner/reviewer after approval.
- [ ] Owner enters valid reviewer credentials securely in the console.
- [ ] Submit 1.1.0 for review only after the release gates pass.

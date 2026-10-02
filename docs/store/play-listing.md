# Google Play listing - Unibridge

Everything below is ready to paste into the Play Console. Items marked YOU
require actions only the account owner can do.

## App details

- **App name:** Unibridge
- **Short description (max 80 chars):**
  `University networking: research, startups, applications, and mentorship.`
- **Full description:**

```
Unibridge is an academic and professional network for university communities.

Built for members, students, and faculty:
- Discover people by skills, role, faculty, and university, with match scores that explain why someone is recommended.
- Browse research, startup, project, internship, and job opportunities posted by your university community.
- Apply in one tap and track every application from submission to decision.
- Post opportunities (students post startups and projects, faculty post research) and review applicants with their skills and portfolio in one place.
- Build a portfolio profile with skills and resume entries, and control who can see it (public, university-only, or private).
- Grow your network with connection requests, and see new activity at a glance with tab badges.

Safety and control:
- Report any profile or post for review.
- Block users to hide their content from you and yours from them.
- Download a copy of your data, turn off push notifications, or delete your account (and the data linked to it) at any time from the Me tab.

Unibridge is for adults (18+) in university communities.

Create your own member account in the app, or sign in with credentials provided by your university program.
```

- **Category:** Social (alternative: Education)
- **Tags:** networking, education, campus
- **Contact email:** ibrahimaliworkacc@gmail.com
- **Website:** https://ibrahimali333.github.io/campusconnect/
- **Privacy policy URL:** https://ibrahimali333.github.io/campusconnect/privacy-policy.html
- **Delete account URL (Data safety):** https://ibrahimali333.github.io/campusconnect/delete-account.html

## Access instructions for Google reviewers (App access form)

Anyone can create a Member account in-app, but posting requires a
student/teacher role granted by administrators, so declare "All or some
functionality is restricted" and provide a demo credential set. The reviewer account (reviewer@example.edu,
student role) is provisioned automatically on deploy once
UNIVERSITY_PORTAL_REVIEWER_PASSWORD is set in the Render dashboard — read the
password from there (do NOT hand out the shared demo accounts):

```
Email: reviewer@example.edu
Password: <UNIVERSITY_PORTAL_REVIEWER_PASSWORD from the Render dashboard>
Notes: Log in with the credentials above to review the full app. On first
login, accept the Terms of Service and Privacy Policy and confirm you are
18 or older (tick both boxes, then "Agree and continue"). Anyone
can also create a Member account with "Create account"; Member accounts can
browse, save, apply, connect, and message. Posting requires a student or
teacher role granted by university administrators, so the provided account
is the easiest way to review posting and applicant review. Report, block,
and account deletion are available in-app.
```

## Content rating questionnaire (IARC) - expected answers

- User-generated content: YES (profiles and opportunity posts)
  - Users can report objectionable UGC: YES
  - Users can block other users: YES
- Violence / sexuality / drugs / gambling: NO
- Shares user location: NO
- Allows purchases: NO
- IARC rates content, not audience: expect a low content rating with the
  "Users Interact" interactive element. The 18+ restriction is set in
  Target audience below, not by IARC.

## Target audience

- Target age group: 18+ only (YOU: tick only the 18+ box in Play Console →
  App content → Target audience and content).
- Not appealing to children. Signup requires confirming age 18 or older.

## Contact and business details

Never invent these; fill them in from real records.

- **Developer name shown on Play:** TODO (must match the verified Play
  developer account)
- **Developer address:** TODO (Play shows it publicly for organisation
  accounts and some personal accounts)
- **Phone:** TODO (required by Play account verification; can be hidden
  for personal accounts)
- **Contact email:** ibrahimaliworkacc@gmail.com
- **EU DSA trader status:** TODO — declare in Play Console; lawyer to advise

## Checklist before submitting

- [ ] YOU: Play Console developer account ($25 one-time), identity verified.
- [ ] YOU: 14-day closed test with 12 testers (required for new personal accounts before production).
- [ ] Production AAB uploaded (see docs/store/release-build.md notes in repo).
- [ ] Store listing assets: app icon 512x512 (have: assets/icon.png - export at 512), feature graphic 1024x500 (make one), 4-8 phone screenshots (capture from emulator in production mode).
- [ ] Data safety form (see data-safety.md) — re-check it: messages,
      device IDs (push token), and crash logs changed on 2026-10-02.
- [ ] Lawyer has approved terms.html and privacy-policy.html and the DRAFT
      banners have been removed (COMPLIANCE.md).
- [ ] Privacy policy URL live (GitHub Pages).
- [ ] App access credentials for reviewers filled in.

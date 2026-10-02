# App Store Connect App Privacy questionnaire - answers for Unibridge

Apple's questionnaire covers the same facts as the Play Data Safety form
(data-safety.md) but with different categories. Source of truth: no
analytics SDK, no ads, no tracking; data goes only to the service
providers listed in COMPLIANCE.md (Render, Expo push via APNs, Sentry when
enabled, Anthropic when the assistant is enabled), all over HTTPS.
Updated 2026-10-02 to match the privacy policy; DRAFT pending lawyer
review.

## Top-level questions

- Do you or your third-party partners collect data from this app? **Yes**
- Is data used to track users across apps/websites owned by other
  companies? **No** (nothing under the "Data Used to Track You" label)

## Data types collected

All of the following are **Linked to the user** (tied to their account),
used for **App Functionality** only, and **not** used for tracking:

| Apple category | Data | Why |
|---|---|---|
| Contact Info > Name | Yes | Profile identity |
| Contact Info > Email Address | Yes | Login and account |
| Identifiers > User ID | Yes | Account records |
| User Content > Emails or Text Messages | Yes | In-app messages between connections (sender, recipient, contents) |
| User Content > Other User Content | Yes | Profiles, portfolio/resume entries, opportunity posts, applications, connection notes, reports, Opportunity Assistant requests (sent to Anthropic when the assistant is enabled; not stored) |
| Other Data > Other Data Types | Yes | Terms/Privacy version accepted, acceptance time, and the 18+ confirmation time (no birth date) |

Everything else (location, contacts, photos, health, financial info,
browsing history, search history, purchases, device identifiers): **Not
collected**. Diagnostics: see the Sentry note below.

Notes:
- Push tokens are stored server-side to deliver notifications; they fall
  under Identifiers > User ID handling (account-scoped, deleted with the
  account) rather than Device ID (no advertising/device-graph use).
- Crash logs / analytics: none collected in build 1.0.0 (2), which predates
  Sentry. **From the first build that ships with EXPO_PUBLIC_SENTRY_DSN set,
  add `Diagnostics > Crash Data` (linked to user: No; tracking: No; purpose:
  App Functionality) before submitting** — a Sentry-enabled build with no
  Diagnostics disclosure is a review mismatch. send_default_pii is off, so
  no other category changes.

## Age

The app is 18+ (signup requires confirming age 18 or older). Set the age
rating to 18+ in App Store Connect — see app-store-listing.md.

## Data deletion

- Users can delete their account and the data linked to it in-app (Me
  tab), or request deletion at ibrahimaliworkacc@gmail.com. The
  delete-account page documents both paths and what backups may retain.
- Users can download a JSON copy of their data in the Me tab.

# App Store Connect App Privacy questionnaire - answers for Unibridge

Apple's questionnaire covers the same facts as the Play Data Safety form
(data-safety.md) but with different categories. Source of truth: no
analytics SDK, no ads, no tracking, no third-party sharing; all data is
user-entered and served over HTTPS from the Unibridge backend.

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
| User Content > Other User Content | Yes | Profiles, portfolio/resume entries, opportunity posts, applications, connection notes, messages, reports |

Everything else (location, contacts, photos, health, financial info,
browsing history, purchases, diagnostics, device identifiers): **Not collected**.

Notes:
- Push tokens are stored server-side to deliver notifications; they fall
  under Identifiers > User ID handling (account-scoped, deleted with the
  account) rather than Device ID (no advertising/device-graph use).
- Crash logs / analytics: none collected (no SDK present).

## Data deletion

- Users can delete their account and all data in-app (Me tab), or request
  deletion at ibrahimaliworkacc@gmail.com. The privacy-policy page
  documents both paths.

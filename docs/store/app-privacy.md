# App Store Connect App Privacy — Unibridge 1.1.0 draft

Source-audited 2026-10-02. **Not ready to submit:** confirm the final binary,
production backend providers, provider retention/linkage, and the unresolved
location classification below. Legal pages remain DRAFT with unresolved
placeholders; this document does not certify legal compliance.

The release audit's EAS production environment listing contained
`EXPO_PUBLIC_API_URL=https://campusconnect-api-u7tq.onrender.com` and no
`EXPO_PUBLIC_SENTRY_DSN`. This is evidence about that environment listing,
not proof about the eventual build inputs or the backend's separate Sentry
configuration. Do not infer that Anthropic, SMTP, Google OAuth, or backend
Sentry is disabled from a missing client variable.

## Top-level questions

- Collect data: **Yes**.
- Cross-app/site tracking: **No in the audited application code**; confirm
  actual partner practices before publishing this answer.

## Account-linked collection established in source

These rows are linked to the account. No advertising/tracking use was found.
Select every applicable purpose, not just App Functionality.

| Apple category | Data | Purpose |
|---|---|---|
| Contact Info > Name | Profile identity | App Functionality |
| Contact Info > Email Address | Login and account; domain can populate university | App Functionality; Product Personalization where used to establish university for matching |
| Identifiers > User ID | Account and profile identifiers | App Functionality; Product Personalization for account-specific recommendations |
| Identifiers > Device ID | Expo push token associated with the account/device | App Functionality (notifications); optional push does not exempt ongoing collection |
| Location > Coarse Location | Optional profile Location text, e.g. city/country, stored, displayed and exported | App Functionality |
| User Content > Emails or Text Messages | In-app message sender, recipient and contents | App Functionality |
| User Content > Other User Content | Profile, skills, portfolio, posts, applications, notes and reports | App Functionality; Product Personalization for profile/skill/portfolio/post data used in recommendations |
| Other Data > Other Data Types | Accepted legal version and consent/18+ timestamps | App Functionality |

**Location needs a final answer before submission.** The Location field is
free text, not a GPS permission. It is not constrained to city/country and
can hold an address or precise location. Coarse Location is the minimum
supported disclosure; assess Physical Address / Precise Location against
the actual collected data and permitted input. Do not select “no location”
or claim that the input is coarse-only without resolving this. Its display
also needs consideration in the content-rating questionnaire.

The app stores connections between accounts; review Apple's Contacts
category (which includes a social graph), rather than treating absence of
phone-address-book access as proof of no Contacts collection. Saved posts,
applications and related activity also require a Product Interaction mapping
check before the final form. There is no camera/photo/address-book permission
flow in the audited app; this is not a blanket exemption for user content.

## Conditional SDK/server collection

- Native Sentry initializes only with `EXPO_PUBLIC_SENTRY_DSN`, with
  `tracesSampleRate: 0.1`. If enabled, disclose **Diagnostics > Crash Data**
  and **Diagnostics > Performance Data**. App stability/performance analysis
  has an Analytics purpose; include App Functionality where applicable.
- Backend Sentry is independent (`UNIVERSITY_PORTAL_SENTRY_DSN`, sample rate
  configurable, default 0.1). Its production state is **UNVERIFIED**. Include
  relevant server collection in the final assessment even with native
  Sentry off.
- `sendDefaultPii: false` / `send_default_pii=False` and disabled backend
  locals reduce collection; they do not prove all events are anonymous or
  free of personal data. Inspect SDK payloads, IP handling, scrubbing and
  retention before choosing “not linked.” Do not assume diagnostics are
  unlinked; add identifiers, activity or other categories if payloads require.
- Optional Opportunity Assistant sends query text and selected open-post
  content to Anthropic when configured. Server state and provider retention
  are **UNVERIFIED**; do not claim no collection merely because the app does
  not store the request. Review under Other User Content and applicable
  categories before submission.
- Verify Render logs, optional Google sign-in and SMTP provider processing,
  retention and purposes with the owner. Source defaults do not establish
  production configuration.

## Age and account controls

Set the audience minimum to 18+ through the truthful age-rating questionnaire
and the higher-rating control where available. Verify consent enforcement
for new and existing accounts, including old clients, before release.

Me → Download my data downloads JSON on web; **native opens the share sheet
with JSON text, not a JSON file attachment**. Check supported share targets
on real devices. In-app account deletion and the documented email request
path are available; retention/backups in the legal pages still need review.

## Evidence and definitions

Implementation: `App.tsx`, `backend/app/main.py`, `backend/app/core/config.py`,
`backend/app/api/v1/network.py` (matching and profile responses),
`backend/app/models/user_profile.py`, `backend/app/services/data_export.py`,
`src/screens/network/AccountPrivacySection.tsx`, `src/lib/notifications.ts`.
Category/purpose and linkage definitions: [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

# Google Play Data safety — Unibridge 1.1.0 draft

Source-audited 2026-10-02. **Do not submit until production providers and
retention, location classification, and final build inputs are verified.**
The legal pages remain DRAFT with unresolved placeholders.

## Overview

- Required data types collected: **Yes**.
- Sharing: **UNVERIFIED** until each actual provider and transfer qualifies
  under Google's definitions. Service-provider and user-initiated-transfer
  exceptions may apply, but do not assert “does not share” solely because a
  vendor is described as a processor. Check contracts and actual use.
- Encrypted in transit: release API is HTTPS; confirm every enabled provider
  path (including optional SMTP TLS) before answering Yes for all data.
- Users can request deletion: **Yes**, through Me → Delete Account or email
  to ibrahimaliworkacc@gmail.com. Retention details still need legal review.
- Delete-account URL: https://ibrahimali333.github.io/campusconnect/delete-account.html

## Collection established in source

“Optional” refers to user choice, not the developer's choice to enable a
service. All rows below are stored, not solely processed ephemerally.
Sharing answers remain subject to the overview verification.

| Data type | Collected | User choice | Purpose |
|---|---|---|---|
| Personal info > Name | Yes | Required | App functionality; Account management |
| Personal info > Email address | Yes | Required | App functionality; Account management; Personalization where domain-derived university is used for matching |
| Personal info > User IDs | Yes | Required | App functionality; Account management; Personalization for account-specific recommendations |
| Location > Approximate location | Yes (profile Location, e.g. city/country) | Optional | App functionality (profile display) |
| Messages > Other in-app messages | Yes | Optional | App functionality |
| App activity > Other user-generated content | Yes (profiles, portfolio, posts, applications, notes, reports) | Optional profile/content fields; role and account defaults also exist | App functionality; Personalization for matching inputs; Fraud prevention, security, and compliance for reports |
| Personal info > Other info | Yes (legal version and acceptance/18+ timestamps) | Required in consent flows | Account management; Fraud prevention, security, and compliance |
| Device or other IDs | Yes (Expo push token) | Optional | App functionality (notifications) |

The Location field is unrestricted free text, persisted, displayed and
exported. **Resolve whether Address / Precise location must also be declared
before submission.** No GPS permission is requested; that does not mean no
location is collected. Assess user-visible location separately for IARC.
Also map stored connections, saved posts and application activity to the
appropriate categories (including App interactions where applicable) before
finalizing the form; absence of a phone-contacts permission is insufficient
to decide every social-data category.

## Conditional collection — verify before answering

The release audit's EAS production listing showed the correct Render API URL
and no `EXPO_PUBLIC_SENTRY_DSN`. Verify the final build environment too.
Backend Sentry, Anthropic, Google OAuth and SMTP remain **UNVERIFIED**.

| Service/data | When applicable | User choice / purpose |
|---|---|---|
| Sentry: App info and performance > Crash logs | Native DSN enabled, or applicable backend collection | No in-app diagnostics opt-out is implemented; Analytics / app stability |
| Sentry: App info and performance > Diagnostics | Native traces sample at 10%; backend default is 10% with separate configuration | Same as crash logs; Analytics / performance |
| Anthropic: assistant request and selected open-post content | Backend assistant enabled | User invokes assistant; App functionality; verify retention before any ephemeral answer |

Disabling default PII and backend local-variable capture is not a guarantee
that error messages, URLs, breadcrumbs or identifiers contain no personal
data. Verify representative payloads, scrubbing, IP handling and retention;
add categories as needed. “No analytics SDK” is misleading if Sentry's
performance/error analysis is enabled. No advertising integration was found
in the audited app code.

The push switch requests removal of this device's token; confirm successful
removal and notification behavior on real phones. Native data export shares
JSON text via the system share sheet; web downloads a JSON file.

## Security practices

- Data encrypted in transit: pending full enabled-provider verification.
- Users can request deletion: Yes.
- Families policy: adult audience, 18+ only; do not claim Families compliance.
- Independent security review: no completed review evidence in this audit.

## Evidence

Source: `App.tsx`, `backend/app/main.py`, `backend/app/core/config.py`,
`backend/app/api/v1/network.py`, `backend/app/services/data_export.py`,
`src/screens/network/AccountPrivacySection.tsx`, `src/lib/notifications.ts`.
Form definitions and exceptions: [Google Play Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469).

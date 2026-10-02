# Play Console Data Safety form - answers for Unibridge

Updated 2026-10-02 to match the privacy policy (DRAFT pending lawyer
review). Service providers (Render, Expo/FCM, Sentry, Anthropic) process
data on our behalf, which Play does not count as "sharing".

## Overview questions

- Does your app collect or share any of the required user data types? **Yes (collects; does not share)**
- Is all of the user data collected by your app encrypted in transit? **Yes (HTTPS only)**
- Do you provide a way for users to request that their data is deleted? **Yes** - in-app account deletion (Me tab) plus email requests to ibrahimaliworkacc@gmail.com.
- Delete account URL (required): https://ibrahimali333.github.io/campusconnect/delete-account.html

## Data types collected

| Data type | Collected | Shared | Processed ephemerally | Required | Purpose |
|---|---|---|---|---|---|
| Personal info > Name | Yes | No | No | Yes | App functionality (profile identity) |
| Personal info > Email address | Yes | No | No | Yes | App functionality (login, account) |
| Personal info > User IDs | Yes | No | No | Yes | App functionality (account) |
| Photos/Videos | No | - | - | - | - |
| Location | No | - | - | - | - |
| Contacts | No | - | - | - | - |
| Messages > Other in-app messages | Yes | No | No | No | App functionality (messages between connections) |
| App activity > Other user-generated content | Yes | No | No | No | App functionality (profiles, posts, applications, connections, reports, Opportunity Assistant requests) |
| App info and performance > Crash logs | Yes, from the first build with EXPO_PUBLIC_SENTRY_DSN set (otherwise No) | No | No | No | Analytics / app stability (Sentry) |
| App info and performance > Diagnostics | Same as crash logs (Sentry performance samples) | No | No | No | Analytics / app stability |
| Device or other IDs | Yes (push notification token) | No | No | No | App functionality (delivering notifications); removable via the Me tab switch |

Notes:
- Education/work history entered in the portfolio (resume entries) falls under
  "Other user-generated content"; it is user-entered and optional.
- No analytics SDK, no advertising SDK, no third-party data sharing.
- Passwords are transmitted over HTTPS and stored as salted hashes.

## Security practices section

- Data is encrypted in transit: **Yes**
- Users can request data deletion: **Yes**
- Committed to Play Families Policy: **No** (18+ audience; signup requires
  confirming age 18 or older)
- Independent security review: **No**

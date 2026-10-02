# Unibridge legal and compliance review

**Status: DRAFT for lawyer review (2026-10-02).** This is an engineering
review, not legal advice. Nothing here or in `docs/terms.html`,
`docs/privacy-policy.html`, `docs/delete-account.html`, or
`docs/child-safety.html` has been approved by a lawyer. Business details we
do not know are left as `TODO` placeholders; none were invented.

Terms/Privacy version in force: **2026-10-02** (`CURRENT_TERMS_VERSION` in
`backend/app/core/legal.py`). Minimum age: **18**.

---

## 1. What was fixed

### Consent, age, and terms
- **Terms of Service written** (`docs/terms.html`): minimum age 18, zero
  tolerance for objectionable content and abusive users, what happens to
  violating content and accounts, reporting and blocking, content
  ownership plus a licence to display it, AI assistant caveat, account
  termination, "as is" and limitation of liability, changes, governing
  law (TODO), contact and business details (TODO). Linked from the app
  (signup, login footer, terms screen, Me tab → Legal), the privacy
  policy, the other docs pages, and `docs/index.html`.
- **Required signup consent for both email and Google signup.** Two
  separate, unticked checkboxes: "I agree to the Terms of Service and
  Privacy Policy" (with working links) and "I confirm I am 18 or older".
  The backend enforces both: `/auth/register` returns 400 without them,
  and a Google sign-in that would create a new account returns 428 and
  creates nothing. The app then switches to the signup form and asks for
  both boxes.
- **Consent is recorded on the user:** `terms_version`,
  `terms_accepted_at`, `age_confirmed_at` (migration
  `202610020010`). No birth date is stored.
- **Re-acceptance:** `UserRead.terms_acceptance_required` is true when the
  stored version differs from `CURRENT_TERMS_VERSION`, or age was never
  confirmed. That covers every existing user, since all have NULL after
  the migration. The app shows a blocking "Review our Terms" screen with
  the same two boxes until `/auth/accept-terms` succeeds. That endpoint
  refuses a stale version (409). The screen always offers Sign out and a
  link to request deletion without agreeing.
- **Bumping the version:** edit both documents, then change
  `CURRENT_TERMS_VERSION` and the "Version" line in `terms.html` and
  `privacy-policy.html`. Deploy the backend. Every user is asked again on
  next launch, with no app update needed.
- `GET /api/v1/auth/legal` (public) returns the version, minimum age, and
  document URLs.

### Data rights
- **Download my data:** Me tab → *Your Data* → *Download my data* calls
  `GET /api/v1/auth/me/export`. It returns JSON with the account, consent
  record, profile, skills, portfolio, posts (applicant counts only),
  applications, saved posts, connections, messages, blocks, reports
  filed, and devices (push token masked). Web downloads a `.json` file;
  iOS/Android open the share sheet.
- **Push notifications can be turned off in the app:** Me tab →
  *Notifications* switch (per device). Off removes the device token from
  the server and is remembered on the device, so it is not re-registered
  at the next login. On asks for OS permission. If permission is blocked,
  the app explains this and offers *Open device settings*. Push is also
  no longer registered until the user has accepted the current terms.
- **Account deletion verified complete.** A new test
  (`tests/test_legal.py::TestAccountDeletionCompleteness`) seeds a row in
  every table that references a user and checks that all of them are gone
  after `/auth/delete-account`: user, profile, skills, resume entries,
  posts (and others' applications and saves on them), applications,
  saved posts, connections, messages both directions, blocks both
  directions, reports by and about the user, and push tokens.
- **Bug fixed: teachers could not delete their account.** For a teacher
  with legacy academic lessons, deletion failed with a 500
  (`lessons.teacher_profile_id` is NOT NULL / RESTRICT). Legacy lessons
  and their attendance rows now cascade with the teacher profile. Verified
  against real PostgreSQL for the seeded teacher, student, and member.
- `docs/delete-account.html` now matches the app's exact steps and button
  names. It lists everything deleted, says what backups and logs may keep
  (retention TODO), mentions the data download, and states that
  disagreeing with the terms does not block deletion.

### Moderation
- **Gap fixed: deactivated users stayed visible.** Admin deactivation
  blocked login but left the user's profile, posts, and messages visible
  to everyone. Deactivated accounts are now hidden wherever blocked users
  are: discovery, profile detail, recommendations, post lists, assistant
  corpus, applying, connecting, and messaging. Test:
  `TestDeactivatedAccountsAreHidden`.

### Data minimisation
- The AI assistant no longer sends poster names to Anthropic. Only post
  type, title, description, and skills are sent, plus the user's query.
- The assistant panel now tells users their request goes to Anthropic's
  Claude and not to include personal information.
- Backend Sentry no longer captures stack-frame local variables
  (`include_local_variables=False`), which could contain names, emails,
  or message bodies. `send_default_pii` was already off.

### Dark patterns and unsupported claims
- Nothing is pre-checked. Both consent boxes start unticked, and so does
  the terms screen.
- Login "Log in" mode was described as "Existing demo accounts" in
  production builds (wide screens). It is now "Sign in to your account".
- The signup screen said "Students and faculty join with their university
  Google account" even in builds without Google sign-in (all iOS builds).
  It now says roles are granted by administrators unless Google sign-in
  is configured.
- The terms screen originally said you could delete your account "after
  agreeing". That was replaced: users can sign out, or request deletion
  without agreeing.
- Delete-account copy now lists everything removed, offers the data
  download, and keeps a plain *Cancel* next to *Permanently delete* (no
  guilt wording).
- Privacy policy: removed the inaccurate claims "no third-party SDKs /
  no crash data" (Sentry ships in the app; Anthropic, Google, and Expo
  are used) and "no personal data retained after deletion" (backups and
  logs may be). Retention is now a TODO with real values to be filled
  in.
- Store files: "Delete your account (and all your data)" became "the data
  linked to it". The age claims are now consistently 18+, replacing 4+,
  "Everyone/PEGI 3 tier", and "rated 13+". The support URL is now the
  public landing page instead of the GitHub repo.
- Child-safety page: "reviewed promptly" became a TODO with a concrete
  commitment, and the reporting authority is a lawyer TODO.
- `docs/index.html` lists Terms, Privacy, Child Safety, and deletion, and
  carries no marketing claims.
- Claims kept because the code supports them: "Apply in one tap" (apply
  is one request, no form), "match scores that explain why", and "report
  / block / delete in-app".

### Accessibility (WCAG 2.1 AA)
- **Screen reader labels:** every icon-only control has a translated
  label.
  - The language button reads "Change language, current: EN".
  - Tabs announce new-item counts in all three languages.
  - Repeated Edit/Delete buttons name their item ("Delete Python").
  - Login inputs now carry labels.
  - Selected/pressed/busy/checked states are exposed.
  - Section titles are real headings.
  - Status and error lines are announced (live regions; explicit
    announcements on iOS).
  - The withdraw button nested inside a pressable card was unreachable
    and invalid on web. It is now a separate control.
- **Contrast:** all text and UI pairs meet AA. Darkened colours: faint
  `#8C9AAC→#617085` (2.86→5.04 on white), amber, red, green, and input
  borders `#DCE3EC→#8390A3` (1.29→3.24, the 3:1 non-text rule). The
  legal pages were checked too.
- **Touch targets:** all interactive elements are now ≥44×44 pt: icon
  buttons, tabs, chips, inline actions, close, retry, inputs, checkboxes,
  and links.
- **Images:** the logo and brand mark sit next to the visible
  "Unibridge" text and are marked decorative. Avatars are text initials,
  also hidden from screen readers. The app has no other images. The docs
  pages have no images.
- **Keyboard-only web:**
  - Focus outlines now also cover checkbox, switch, link, radio, and
    select.
  - A real bug was found by testing: react-native-web only activates
    non-button roles with Enter, so Space did not tick the consent
    checkboxes. Fixed.
  - Verified with Playwright: Tab reaches both checkboxes, Space toggles
    them, and signup, the terms screen, and the data download all work
    with the keyboard.

### Translations
All new strings have EN/AZ/RU translations, as does one previously
untranslated string. **They were machine-written and need a native
speaker's review**, especially the legal wording.

---

## 2. What is still open

### Must do before publishing
1. **Lawyer review** of all four pages and this file. Then remove the
   DRAFT banners and fill in every `TODO`. Search for `class="todo"` in
   `docs/` and `TODO` in `docs/store/`.
2. **Fill in business details** (never invented): operator legal name,
   address, company registration number, phone (store accounts), governing
   law and venue, liability cap, DPO / EU representative if required, and
   EU DSA trader status.
3. **Fill in retention values** from real plans: Render Postgres backup
   retention, Render log retention, Sentry event retention, and the
   data-request response time.
4. **Commit to a report-response time** (Apple expects action within
   24 hours for UGC apps) and an appeal process. Replace the TODOs in
   Terms §4–5 and the child-safety page.
5. **Publish the docs.** GitHub Pages serves `docs/` only from the branch
   configured in repo settings. The new `terms.html` is live only after
   this branch is merged there.
6. **Manual store-console changes:** see section 6.
7. **Sentry:** in the Sentry project settings enable *Prevent Storing of
   IP Addresses* and confirm the data region. The privacy policy says IP
   addresses are not attached.
8. **Deploy order:** run the migration (`alembic upgrade head`, done by
   the pre-deploy command) and deploy the backend *before* releasing the
   app build. Older app builds still work but cannot send consent, so new
   signups from old builds fail with "Accept the Terms…". Ship the new
   build promptly.
9. **Image ownership:** confirm who created the UB logo and that you own
   or license it (see section 5). Get a trademark check on the name
   "Unibridge".

### Should do soon
- **Server-side terms enforcement:** the backend records consent and
  refuses signups without it. Existing users who have not re-accepted are
  gated by the app, but the API itself does not block them. A
  `require_current_terms` dependency on network/messages routes would
  close this for direct API use. Ask the lawyer whether that is needed.
- **Legacy academic tables and routes** (`student_profiles`,
  `teacher_profiles`, `attendance_records`, `grade_records`, `courses`,
  `lessons`, `materials`, `announcements`, `/attendance`, `/grades`,
  `/portal`): not part of the product but still deployed. Attendance and
  grades are sensitive education records. Check whether production holds
  any rows. If not, remove the routers and tables in a dedicated change.
  If it does, decide on retention or deletion with the lawyer.
  `provision_release_preview.py` creates these rows.
- **Deactivated users in your own history:** deactivated accounts still
  appear in other users' existing connections list, their own
  applications list, and applicant lists on posts. Discovery, posts, and
  messaging hide them.
- **Open-source notices:** the app ships MIT/ISC/BSD/Apache packages
  (lucide icons are ISC), whose licences require keeping copyright
  notices. Add an "Open-source licences" page, e.g. generated with
  `license-checker` during the build, and link it from Me → Legal.
- **Default profile visibility is "public"** (all signed-in users, never
  the open web). Privacy-by-default (GDPR Art. 25) may favour
  "university only" as the default. It is a product decision with legal
  input; see the questions.
- **Push permission prompt** appears right after first login/acceptance
  without an explanatory pre-prompt. Consider a short explainer screen
  first.
- `SectionHeader` shows a chevron next to its action text that looks
  tappable but isn't. Remove the chevron or make it act.
- The header's unused *Notifications* bell has no action; it is never
  shown today. Don't enable it without wiring it up.

### Environment notes
- docs.expo.dev was blocked by this environment's network policy (AGENTS.md
  asks for the v56 docs), so the Expo APIs used (`expo-notifications`
  permissions/tokens, `Linking.openSettings`, `Share`) were checked
  against the installed SDK 54 type definitions instead.
- Native iOS/Android were not run here. The web build was tested end to
  end. Test the push switch, share-sheet export, and Google consent flow
  on devices via TestFlight / internal testing.

---

## 3. Third-party services and SDKs

| Service / SDK | Used for | Data it receives | When | Named in privacy policy |
|---|---|---|---|---|
| **Render** (Render Services, Inc., US) | Hosting API + PostgreSQL | Everything in the data inventory; request logs with IPs | Always | Yes |
| **Expo Push Service** (650 Industries, Inc., US) via `expo-notifications` | Push delivery | Push token; notification title/body. Bodies include names ("Message from X", "X wants to connect") and message previews ≤140 chars | When the user allows push | Yes |
| **Apple APNs / Google FCM** (`google-services.json`) | Transport for push | Push token, notification text | When push is allowed | Yes |
| **Sentry** (Functional Software, Inc., US) — `@sentry/react-native`, `sentry-sdk[fastapi]` | Crash/error reports, 10% performance traces | Stack traces, app version, device model/OS, breadcrumbs (screens, request URLs without bodies). No PII attached; backend locals off | Only when `EXPO_PUBLIC_SENTRY_DSN` / `UNIVERSITY_PORTAL_SENTRY_DSN` are set | Yes |
| **Google Sign-In** (Google LLC) — `expo-auth-session`, server calls `oauth2.googleapis.com/tokeninfo` | Optional university SSO | Google email, name, email_verified; ID token sent to Google for verification | Only when `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is set; disabled for iOS | Yes |
| **Anthropic** (Anthropic PBC, US) — `anthropic` Python SDK | Optional Opportunity Assistant | User's query text; type/title/description/skills of ≤100 open posts (no names, no profiles) | Only when `UNIVERSITY_PORTAL_ANTHROPIC_API_KEY` is set | Yes |
| **GitHub Pages** (GitHub, Inc., US) | Hosts the legal/support pages | Visitors' web request data | Always | Yes |
| **Expo EAS Build/Submit** | Building and submitting binaries | No end-user data | Build time | Not needed |
| **Apple App Store / Google Play** | Distribution | Under their own policies | Always | Mentioned |
| `expo-secure-store` | On-device storage of session, language, push preference | Stays on device | Always | Yes ("On your device") |

There are no analytics, advertising, attribution, or tracking SDKs.
Confirm a data processing agreement / DPA is accepted with Render,
Expo, Sentry, and Anthropic (each offers standard terms).

---

## 4. Data inventory

Every database column, why it is collected, and the decision. "Kept" means
it is needed for the feature named.

### Current product tables
| Table | Columns | Purpose / decision |
|---|---|---|
| `users` | id, email, hashed_password, full_name, role, is_active, created_at, updated_at | Login, identity shown to others, permissions, moderation (deactivation), audit timestamps. **Kept.** |
| `users` (new) | terms_version, terms_accepted_at, age_confirmed_at | Proof of consent and 18+ confirmation. No birth date collected (minimisation). **Added.** |
| `user_profiles` | role, headline, bio, university, faculty, graduation_year, location, visibility, timestamps | All user-entered and optional except role/visibility; drive profile display and matching. `university` is auto-filled from known email domains. `location` is free text; users should not enter a home address. **Kept** (all user-controlled and deletable). |
| `skills` | name | Shared catalogue of skill names, not personal on its own. Survives account deletion (not linked to the user). **Kept.** |
| `user_skills` | profile_id, skill_id, level, created_at | Portfolio and matching. **Kept.** |
| `resume_entries` | entry_type, title, organization, description, start/end date, is_current, url | Portfolio. **Kept** (user-entered, optional). |
| `opportunities` | owner, type, title, description, required_skills, status, timestamps | Posts. **Kept.** |
| `opportunity_applications` | opportunity, applicant, status, note, timestamps | Applications. `note` is accepted by the API but the app never sends one today. It costs nothing when empty, so it is **kept** for a planned feature; remove it if no note UI ships. |
| `saved_opportunities` | profile, opportunity, created_at | Saved posts. **Kept.** |
| `connection_requests` | requester, receiver, status, message, timestamps | Networking. `message` is optional. **Kept.** |
| `messages` | sender, recipient, body, read_at, created_at | Messaging. `read_at` drives unread badges. **Kept.** |
| `profile_blocks` | blocker, blocked, created_at | Safety. **Kept.** |
| `content_reports` | reporter, target, reason, status, created_at | Moderation. **Kept.** Deleted when either side deletes their account (see lawyer questions). |
| `push_tokens` | user_id, token, platform, timestamps | Push delivery. `platform` is not needed for Expo delivery but is **kept** to diagnose APNs vs FCM delivery failures; it identifies only "ios"/"android". Removed with the device switch, logout, account deletion, or when Expo reports the device unregistered. |

### Legacy academic tables (not used by the current app)
| Table | Personal columns | Decision |
|---|---|---|
| `student_profiles` | student_number, enrollment_year | **Not needed by the product.** Kept only because legacy routes and tests still use them; included in the data export and deleted with the account. Removal recommended (section 2). |
| `teacher_profiles` | teacher_number, title | Same as above. |
| `attendance_records`, `grade_records` | attendance status, scores, comments about students | **Sensitive education records, not needed.** Confirm production is empty, then remove. |
| `enrollments`, `courses`, `lessons`, `materials`, `announcements`, `student_groups`, `departments`, `faculties`, `universities` | mostly organisational; `announcements.published_by_user_id` (SET NULL on delete) | Same as above. |

### Outside the database
- **Server memory:** failed-login counters (IP + email tried, ≤15 min;
  per-IP 15 min; signup per-IP 1 hour), action rate limits per user ID.
  Never persisted.
- **Render logs:** request lines with IPs (retention TODO).
- **Sentry:** see section 3.
- **Device:** access/refresh tokens, language, push preference (secure
  storage; `localStorage` on web).

---

## 5. Images, icons, and fonts

| Asset | Where | Origin | Licence status |
|---|---|---|---|
| `assets/icon.png`, `splash-icon.png`, `android-icon-foreground/background/monochrome.png`, `favicon.png`, `brand-mark.png` | App icon, splash, header | Generated from "the chosen UniBridge logo" (commit `6e4feb5`, 2026-08-06); the logo's author is not recorded | **Unknown — confirm.** Who designed the UB logo? If an AI tool, template, or freelancer was used, keep the licence or assignment. |
| `docs/store/assets/app-icon-512.png`, `feature-graphic.png` | Store listing | Derived from the same logo | Same as above |
| `docs/store/assets/screenshot-*.png`, `ios/`, `ios-6.5/`, `ipad-13/` | Store screenshots | Captures of this app with fictional seed data (e.g. "Aydin Mammadli", "Prof. Leyla") | Own work. Real university names appear as labels; see the lawyer questions. |
| Icons in the app | `lucide-react-native` | Open source | **ISC** (keep the notice; see "open-source notices") |
| Azerbaijani ornaments (8-point star, buta/paisley, flag stripe, Flame Towers skyline) | `src/components/brand/Ornaments.tsx` | Drawn from scratch as SVG paths for Unibridge (2026-10-02 redesign); no third-party artwork or tracing | Own work. The flag colours and star are a national symbol used decoratively; see the lawyer questions. |
| App font: **Inter** (Regular–ExtraBold) | Bundled via `@expo-google-fonts/inter` | Rasmus Andersson / Google Fonts | **SIL Open Font License 1.1** — free to embed in apps; keep `node_modules/@expo-google-fonts/inter/LICENSE_FONT` with the open-source notices. Covers Azerbaijani (Ə ə, Ğ ğ, ı, İ, Ş ş, Ç ç, Ö ö, Ü ü), Cyrillic, and ₼ (checked against the font's glyph table). |
| Docs pages fonts | `docs/*.html` | System font stack, no web fonts | No licence needed |
| UI libraries added in the redesign | React Navigation (native, bottom-tabs), react-native-screens, react-native-safe-area-context, react-native-reanimated, react-native-worklets, react-native-gesture-handler, @gorhom/bottom-sheet, expo-haptics, expo-linear-gradient, expo-font | All **MIT**; versions pinned to the Expo SDK 54 bundle | Add to the open-source notices page |
| JS dependencies (shipped) | `package-lock.json` | MIT 682, ISC 52, BSD 41, Apache-2.0 13, MPL-2.0 12 (build tools), others | No copyleft in the app bundle. `node-forge` is BSD/GPL dual-licensed (use BSD). `qrcode-terminal`/`requireg` have unknown licences but are Expo CLI dev tools, not shipped. |
| Python dependencies (server) | `backend/requirements.txt` | MIT/BSD/Apache; `psycopg` is LGPL-3.0 | Used unmodified on our own server, not distributed. Fine, but confirm with the lawyer. |

---

## 6. Store console changes YOU must make by hand

**App Store Connect**
1. *App Information → Age Rating:* answer truthfully (UGC yes,
   messaging yes), then set the age rating to **18+** (higher than the
   questionnaire result).
2. *App Information → License Agreement:* set a custom EULA (the approved
   Terms of Service text or URL).
3. *App Privacy:* update per `docs/store/app-privacy.md`. Add *Emails or
   Text Messages* and *Other Data Types* (consent record). Add
   *Diagnostics → Crash Data* from the first Sentry-enabled build.
4. *App Review Information → Notes:* paste the updated notes. The
   reviewer will see the terms acceptance screen on first login.
5. *Business → Trader status (EU DSA)* and the developer address, as the
   lawyer advises.
6. Support URL → `https://ibrahimali333.github.io/campusconnect/`.

**Google Play Console**
1. *App content → Target audience and content:* **18+ only**.
2. *App content → Data safety:* update per `docs/store/data-safety.md`.
   Add Messages → Other in-app messages, Device or other IDs (push
   token), and Crash logs/Diagnostics once Sentry is enabled. Set the
   delete-account URL.
3. *App content → Content rating (IARC):* re-answer if asked. Users
   interact = yes.
4. *Store listing:* paste the updated full description from
   `docs/store/play-listing.md`; add the website URL.
5. *Developer account:* DSA trader status and address as advised.

**Other consoles**
- **Sentry:** enable *Prevent Storing of IP Addresses*; confirm the data
  region and retention.
- **Render:** confirm the service/database region and the backup and log
  retention for the plan, then fill in the TODOs.
- **GitHub Pages:** make sure `docs/` from the merged branch is what is
  published.

---

## 7. Questions for the lawyer

1. **Applicable law:** Which data protection laws apply? Azerbaijan's Law
   on Personal Data for sure. Does offering the app on the EU/UK stores
   bring in the GDPR, which would need an EU/UK representative? Which
   governing law and venue should the Terms use?
2. **Who is the controller/operator:** an individual or a company? Do we
   need to register as a personal-data operator or owner with any
   Azerbaijani authority?
3. **Cross-border transfers:** all providers are US-based. What
   safeguards, notice, or consent are required for Azerbaijani users (and
   EU users, if any)?
4. **Age:** is a self-declared 18+ checkbox adequate, or is stronger age
   assurance needed in any target market? What should happen to an
   existing account found to be under 18?
5. **Consent mechanics:** is click-through acceptance with a recorded
   version and time enough as proof? Must the backend also block API use
   until re-acceptance (today the app enforces the gate)? Should material
   changes be emailed in advance?
6. **Legal bases:** are contract / legitimate interests correct for each
   purpose in the privacy policy? Does Sentry crash reporting need
   consent in any market?
7. **Deletion vs evidence:** deleting an account also deletes reports
   filed *about* that user and their messages to others. Should we keep
   moderation records, or abuse evidence, for a period after deletion
   (e.g. to stop banned users returning or to support police requests)?
   If so, for how long?
8. **Messages disappearing for the recipient** when the sender deletes
   their account: acceptable, or should recipients keep their copy?
9. **Moderation commitments:** what response time and appeal process
   should the Terms promise? Are there notice-and-action or transparency
   obligations (e.g. the EU DSA) for a platform of this size?
10. **CSAE reporting:** which authority must we report to as an operator
    based in Azerbaijan, and what is the procedure?
11. **Liability:** what liability cap and disclaimers are enforceable for
    a free consumer service in the target markets?
12. **User content licence:** is the licence in Terms §6 sufficient and
    not broader than needed?
13. **Default visibility:** is "public to all signed-in users" an
    acceptable default, or must it be "university only" (privacy by
    default)?
14. **AI assistant:** is the in-app notice sufficient before sending free
    text to Anthropic? Does the assistant need to be opt-in? Should
    Anthropic's data retention be described?
15. **Push notification content:** notifications carry names and message
    previews through Expo, Apple, and Google. Acceptable, or should
    previews be removed?
16. **Legacy education records** (attendance, grades) still in the
    schema: retention and deletion obligations if production contains
    any.
17. **University names and trademarks:** university names appear as
    profile labels, in email-domain mapping, and in screenshots. Is that
    nominative use acceptable? Does the listing need a "not affiliated
    with any university" statement?
18. **Brand:** clearance for the name "Unibridge" and ownership of the
    UB logo.
    Also: the redesign uses Azerbaijani national motifs decoratively
    (flag colours, the 8-point star, a stylised Flame Towers skyline). Is
    that permitted under Azerbaijan's rules on state symbols, and is the
    Flame Towers silhouette free of building-design or trademark claims?
19. **EU DSA trader status** for the App Store and Play: is the operator
    a "trader"? If so, its address and phone become public.
20. **Open-source licences:** confirm the plan for notices (ISC/MIT/BSD)
    and that server-side LGPL `psycopg` use needs no further action.

---

## 8. Verification

- `npm run typecheck`: clean.
- Backend: `cd backend && .venv/bin/python -m pytest` passes in full.
  New tests are in `tests/test_legal.py`; the SSO consent tests are in
  `test_sso.py`; the teacher deletion and deactivated-user hiding tests
  are in `test_moderation.py`. Existing register and SSO tests were
  updated to send consent.
- Migration `202610020010`: upgrade → downgrade → upgrade verified on
  PostgreSQL. Deleting the seeded teacher, student, and member was also
  verified on PostgreSQL.
- Web end-to-end (Playwright, Expo web against a local API):
  - signup is blocked without consent;
  - keyboard Tab/Space ticks both boxes;
  - signup succeeds;
  - Download my data saves a JSON file with the accepted version;
  - a legacy user sees the terms screen and cannot continue without both
    boxes, then gets in after accepting;
  - the Me tab cards render without clipping.

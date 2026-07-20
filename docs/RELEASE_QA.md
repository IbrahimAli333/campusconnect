# Unibridge MVP Release QA

Use this checklist before producing Android preview APKs or iOS internal
preview/TestFlight builds. Work against local services first, then repeat the
release smoke test against the final Render HTTPS backend URL.

Expo SDK 54 is acceptable for internal preview. SDK 56 review and upgrade work
is deferred to the production-store readiness track.

## Test Accounts

Use the seeded MVP roles:

- Member: `member@example.edu` / `member-password`
- Student: `student@example.edu` / `student-password`
- Teacher: `teacher@example.edu` / `teacher-password`

Confirm these accounts exist on the backend under test before starting manual
QA. Do not run the dev seed against the production Render database; provision
release test accounts through the approved production data process.

## Local Automated Verification

Run these from the repository root unless noted:

- [ ] `npm run typecheck`
- [ ] `npm run doctor`
- [ ] `cd backend && .venv/bin/python -m pytest`

The backend test suite should include the network role and flow coverage in
`backend/tests/test_network.py`, including role posting permissions, apply,
save, connect, owned posts, applicant review, profile visibility, profile
editing, skills, and resume entries.

## Backend Health

- [ ] Start or identify the backend under test.
- [ ] Confirm `/health` returns a healthy response.
- [ ] Confirm `/api/v1/health` returns a healthy API response.
- [ ] Confirm `/api/v1/health/db` confirms database connectivity.
- [ ] Confirm authenticated API requests return `401` without a token and
      succeed with a valid role token.

## API URL Configuration

- [ ] On local web, confirm the login screen API hint shows
      `http://localhost:8000` unless `EXPO_PUBLIC_API_URL` is set.
- [ ] On local native development, confirm the app points to the Metro host IP
      or Android emulator host as expected.
- [ ] For physical phone testing after any Wi-Fi, hotspot, or adapter IP change,
      restart the backend with `cd backend && uvicorn app.main:app --host 0.0.0.0 --reload`,
      then restart Expo with `CURRENT_IP=$(ipconfig getifaddr en0) && EXPO_PUBLIC_API_URL=http://$CURRENT_IP:8000 npm start -- --host lan`.
- [ ] For preview and production builds, set
      `EXPO_PUBLIC_API_URL=<final Render HTTPS API URL>`.
- [ ] Run `npm run publish:check` with the final URL and confirm it rejects
      missing, non-HTTPS, localhost, emulator, or private LAN URLs.
- [ ] Confirm the final URL has no trailing slash requirement. The app trims
      trailing slashes before requests.

## Auth Page Modes

- [ ] Confirm Log in mode is the default and renders the Member, Student, and
      Teacher demo role presets.
- [ ] Confirm each demo preset fills only the seeded credentials listed above.
- [ ] Confirm Create account mode is request-access only, explains that public
      registration is not exposed by the API, and does not offer a real account
      creation submit action.
- [ ] Confirm Use demo login returns from request-access mode to Log in mode.

## Member Login And Permissions

- [ ] Select the Member preset on the login screen and sign in.
- [ ] Confirm the signed-in profile role is `member`.
- [ ] Confirm Discover loads profiles and recommendations.
- [ ] Confirm the Member can open profile details.
- [ ] Confirm the Member can request a connection.
- [ ] Confirm the Member can browse opportunities.
- [ ] Confirm the Member can apply to an opportunity.
- [ ] Confirm the Member can save an opportunity.
- [ ] Confirm the Member cannot open a posting form or create an opportunity.
- [ ] Confirm the Member cannot review applicants.

## Student Login And Permissions

- [ ] Select the Student preset on the login screen and sign in.
- [ ] Confirm the signed-in profile role is `student`.
- [ ] Confirm Discover, profile detail, connection request, opportunity browse,
      apply, and save work.
- [ ] Confirm the Student can post only Startup and Project opportunities.
- [ ] Confirm Research, Internship, and Job posting options are not offered.
- [ ] Confirm Student-owned posts appear in My Posts.
- [ ] Confirm Student-owned posts open as a post detail view, not applicant
      review.

## Teacher Login And Permissions

- [ ] Select the Teacher preset on the login screen and sign in.
- [ ] Confirm the signed-in profile role is `teacher`.
- [ ] Confirm Discover, profile detail, connection request, opportunity browse,
      apply, and save work.
- [ ] Confirm the Teacher can post only Research opportunities.
- [ ] Confirm Startup, Project, Internship, and Job posting options are not
      offered to the Teacher role.
- [ ] Confirm Teacher-owned research posts appear in My Posts.
- [ ] Confirm Teacher-owned posts open the applicant review panel.

## Discover, Search, And Profile Detail

- [ ] Confirm Recommended profiles load.
- [ ] Confirm Discover profiles load.
- [ ] Search by name, role, headline, university, faculty, location, and skill.
- [ ] Confirm an empty search result shows the no-results state.
- [ ] Open a profile detail panel.
- [ ] Confirm the detail panel shows role, name, headline or fallback, bio or
      fallback, university/faculty, location, skills, and resume entries.
- [ ] Close the detail panel and confirm the list state remains usable.

## Opportunity Browsing

- [ ] Confirm Recommended opportunities load.
- [ ] Confirm the Opportunities list loads.
- [ ] Confirm filters work for All, Startup, Research, Internship, Job, and
      Project.
- [ ] Open an opportunity detail panel.
- [ ] Confirm type, status, applied flag, saved flag, description, owner,
      required skills, Apply, and Save are visible.
- [ ] Open the owner profile from an opportunity detail panel.
- [ ] Close panels and confirm the list remains usable.

## Apply Flow

- [ ] Apply from an opportunity card.
- [ ] Confirm a success message appears and the button changes to Applied.
- [ ] Open the same opportunity detail and confirm the Applied status chip.
- [ ] Repeat apply on an already applied opportunity and confirm the app treats
      the duplicate as already applied, not as a broken state.
- [ ] Confirm the Applications tab lists the submitted application.
- [ ] Open the application detail from the Applications tab.

## Save Flow

- [ ] Save from an opportunity card.
- [ ] Confirm a success message appears and the button changes to Saved.
- [ ] Open the same opportunity detail and confirm the Saved status chip.
- [ ] Repeat save on an already saved opportunity and confirm the app treats the
      duplicate as already saved, not as a broken state.

## Connect Flow

- [ ] Request a connection from Recommended profiles.
- [ ] Confirm the action changes to Requested or Connected based on status.
- [ ] Request a connection from the Discover list.
- [ ] Confirm duplicate connection requests show the already requested state.
- [ ] Confirm the Connections tab lists sent and received requests for the
      relevant roles.
- [ ] Confirm the current user's own profile is marked Your Profile and cannot
      be connected to.

## Posting Permissions

- [ ] Member: Post action is disabled or unavailable.
- [ ] Member: API rejects opportunity creation with a role permission error.
- [ ] Student: Startup and Project post creation succeeds.
- [ ] Student: Research creation is rejected by API permissions.
- [ ] Teacher: Research post creation succeeds.
- [ ] Teacher: non-Research creation is rejected by UI availability and API
      permissions where applicable.
- [ ] Confirm successful posts appear in My Posts without requiring a full app
      restart.

## Teacher Applicant Review

- [ ] As Student or Member, apply to a Teacher-owned Research opportunity.
- [ ] Sign in as Teacher.
- [ ] Open Opportunities, then My Posts.
- [ ] Open the Teacher-owned Research post.
- [ ] Confirm applicants list with applicant name, role, headline, profile meta,
      application date, note, skills, and resume highlights.
- [ ] Change an application to Reviewing.
- [ ] Change an application to Accepted.
- [ ] Change a separate submitted/reviewing application to Rejected.
- [ ] Confirm accepted or rejected applications no longer offer additional
      review transitions.
- [ ] Confirm a non-owner cannot list or update another owner's applicants.

## Profile Editing

- [ ] Open the Profile tab for each role.
- [ ] Update headline, bio, university, faculty, graduation year, location, and
      visibility.
- [ ] Save and confirm the profile summary updates.
- [ ] Enter a non-integer graduation year and confirm validation appears.
- [ ] Add a skill.
- [ ] Edit a skill level.
- [ ] Delete a skill.
- [ ] Add a resume entry.
- [ ] Edit a resume entry.
- [ ] Delete a resume entry.
- [ ] Confirm updated public or university-visible profile information appears
      in Discover and opportunity applicant review where expected.

## Mobile Layout Sanity

Run these checks on an iPhone SE or similarly small iPhone-sized viewport,
approximately 375 x 667 points:

- [ ] Login screen `Unibridge` brand/title stays on one line without
      clipped letters or awkward character wrapping.
- [ ] Login screen role presets, email, password, sign-in button, error panel,
      and API hint fit without horizontal clipping.
- [ ] Bottom or top navigation remains reachable after sign-in.
- [ ] Discover dashboard stat cards keep the `Recommended` count and label on
      one line without cramped wrapping.
- [ ] Discover profile cards do not overlap text, chips, icons, or action
      buttons.
- [ ] Opportunity cards and detail panels wrap Apply and Save controls cleanly.
- [ ] Posting form fields and type chips wrap without horizontal scrolling.
- [ ] Teacher applicant review cards keep status actions readable and tappable.
- [ ] Profile edit fields, skill editor, resume editor, and row actions wrap
      cleanly.
- [ ] Long names, headlines, opportunity titles, API URLs, and skill lists do
      not overflow their containers.
- [ ] Keyboard entry on login and forms does not hide the active field or final
      submit action.

## Release Smoke Test Against Final Render URL

Replace `<render-api-url>` with the final public HTTPS backend URL from Render.
Do not deploy or build from this checklist unless explicitly authorized.

- [ ] Confirm the Render service is deployed and reachable over HTTPS.
- [ ] `curl <render-api-url>/health`
- [ ] `curl <render-api-url>/api/v1/health`
- [ ] `curl <render-api-url>/api/v1/health/db`
- [ ] `EXPO_PUBLIC_API_URL=<render-api-url> npm run publish:check`
- [ ] Start the app with `EXPO_PUBLIC_API_URL=<render-api-url>` and confirm the
      login screen API hint shows the Render URL.
- [ ] Sign in with Member, Student, and Teacher test accounts against the Render
      backend.
- [ ] Repeat Member, Student, Teacher, Discover, Opportunity, Apply, Save,
      Connect, Posting, Teacher applicant review, Profile editing, and small
      iPhone layout checks against the Render backend.
- [ ] Confirm no local, emulator, LAN, or staging API URL remains configured for
      preview or TestFlight release.

## Preview Build Release Gate

Do not create an Android preview APK or iOS internal preview/TestFlight build
until all of these are true:

- [ ] `npm run typecheck` passes.
- [ ] `npm run doctor` passes.
- [ ] `cd backend && .venv/bin/python -m pytest` passes.
- [ ] Final Render HTTPS backend URL is known, healthy, and database-backed.
- [ ] `EXPO_PUBLIC_API_URL` is set to the final Render HTTPS URL.
- [ ] `npm run publish:check` passes with that URL.
- [ ] Member, Student, and Teacher role smoke tests pass against the Render URL.
- [ ] Member cannot post or review applicants.
- [ ] Student can post Startup and Project only.
- [ ] Teacher can post Research and review applicants.
- [ ] Discover, profile detail, opportunity detail, apply, save, connect,
      posting, applicant review, and profile editing have been manually checked.
- [ ] Small iPhone-sized layout sanity passes without clipped or overlapping
      primary UI.
- [ ] No release-blocking bug remains open in this document or the release
      tracker.

## Current Release Blockers To Clear

- [ ] Final Render HTTPS backend URL must be supplied and smoke tested.
- [ ] Release test accounts must be available on the final Render backend.
- [ ] Android preview APK and iOS internal preview/TestFlight must wait for the
      Preview Build Release Gate above.

## Current Polish Notes

- [ ] After local dev reseeding, Student-owned posts should show professional
      startup/project demo data, with no timestamp-heavy QA titles and no
      placeholder titles such as `sad`.

# Reply to App Review — Guideline 2.1 "Information Needed" (2026-09-08)

Submission be53387d-c975-4f66-a282-4ae3f80814dc, build 1.0.0 (2).
Standard new-developer-account questionnaire, not a defect. Paste the
**Reply** into the submission's Messages thread with the screen recording
attached, paste the **Notes** version into App Review Information → Notes,
then click Resubmit to App Review. Replace <REVIEWER_PASSWORD> from Render.

## Reply (Messages thread)

Thank you for the review. Our responses to each item:

1. Screen recording — attached. Recorded on a physical iPhone running the
current iOS release, starting from app launch. It shows: creating a new
Member account, logging in, the Discover and Posts tabs, applying to and
saving a post, sending a connection request, messaging, the Me tab (profile,
skills, portfolio), reporting and blocking a user, and deleting the account
from the Me tab.

2. Purpose and target audience — Unibridge is an academic and professional
networking app for university communities, launching first in Azerbaijan.
Students, faculty, mentors, and employers build profiles with skills and
portfolio entries, discover one another, and post or apply to research
projects, startups, internships, jobs, and student projects. It solves a
concrete problem: campus collaboration opportunities are scattered across
notice boards and group chats and are invisible outside a person's immediate
circle. The target audience is university students and staff (18+; the app
is rated 13+). It is intended for the general public and is not a demo,
trial, or internal/enterprise app.

3. Setup and access — No setup or sample files are required. Anyone can
create a Member account with "Create account" (email and password). Member
accounts can browse, save, apply, connect, and message. Posting opportunities
and reviewing applicants require a Student or Teacher role, which university
administrators grant; to exercise those flows, use the demo account below
(Student role):
   Email: reviewer@example.edu
   Password: <REVIEWER_PASSWORD>
Main features: Discover (find people by skills, role, university), Posts
(browse opportunities; Apply and Save; Student/Teacher accounts can Post and
review applicants), Applied (track applications), Me (profile, skills,
portfolio, language, account deletion), Network (connections and messages).
Report and Block are available from any profile or post.

4. External services — The app communicates with exactly two services:
   - The Unibridge API: our own backend (FastAPI + PostgreSQL) hosted on
     Render (render.com), over HTTPS. All app data lives there.
   - Expo Push Notification Service, which delivers notifications through
     the Apple Push Notification service.
No payment processors, in-app purchases, third-party sign-in providers,
analytics or advertising SDKs, or AI services are used in this build.

5. Regional differences — None. The app functions identically in every
region. The interface is available in English, Azerbaijani, and Russian
(user-selectable); all content is user-generated.

6. Regulated industry / protected material — Not applicable. Unibridge does
not operate in a regulated industry and contains no licensed third-party
material; all content is created by its users. University names appear only
as plain-text labels for filtering.

We have also added this information to the App Review Information notes for
future submissions.

## Notes field (App Review Information → Notes)

Log in with the credentials above to review the full app (Student role).
Anyone can also create a Member account with "Create account"; Members can
browse, save, apply, connect, and message. Posting and applicant review
require a Student or Teacher role granted by university administrators, so
the provided account is the easiest way to review those flows.

Purpose: academic and professional networking for university communities
(students, faculty, mentors, employers) — profiles, skills, portfolios, and
research/startup/internship/job/project opportunities. General public, 18+.
Not a demo or enterprise app.

External services: our own API on Render (FastAPI/PostgreSQL, HTTPS) and
Expo Push Notification Service (via APNs). No payments, IAP, third-party
sign-in, analytics, ads, or AI services in this build.

Regional differences: none; UI in English/Azerbaijani/Russian. Not a
regulated industry; no protected third-party material; all content is
user-generated. Report, Block, and account deletion are available in-app
(Me tab).

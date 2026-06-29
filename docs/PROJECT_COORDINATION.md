# CampusConnect Project Coordination

This chat is the project coordinator for CampusConnect.

## Product Goal

Build a mobile-first university-based academic and professional networking
ecosystem for students, teachers, professors, mentors, researchers, startup
builders, and employers.

English short explanation: CampusConnect helps university communities build
professional profiles, showcase academic portfolios, discover collaborators and
mentors, and apply to research, startup, internship, and project opportunities.

Azerbaijani short explanation: CampusConnect universitet icmalarına peşəkar
profil və portfolio qurmaq, bacarıqları göstərmək, tələbə, müəllim, professor,
mentor və əməkdaş tapmaq, həmçinin tədqiqat, startap, təcrübə və layihə
imkanlarına müraciət etmək üçün akademik və peşəkar şəbəkədir.

CampusConnect is not a normal social app, not an attendance product, and not a
grades or university-management product.

## Working Name

CampusConnect

## Stack Decision

### Mobile App

- Expo + React Native
- TypeScript
- EAS Build for production iOS and Android builds
- Expo Go for early phone testing
- Development builds when native modules become necessary
- Store build identifiers are currently `com.ibrahimalikhudiyev.campusconnect`
  for both iOS and Android.

Reason: one codebase for iOS and Android, fast iteration, strong ecosystem, and
a direct path to App Store and Google Play builds.

### Backend API

- FastAPI
- PostgreSQL
- SQLAlchemy + Alembic
- Pydantic schemas
- JWT/session auth

Reason: predictable backend architecture, strong validation, simple API
contracts, and a database model that can enforce permissions, profile
visibility, applications, saved opportunities, and collaboration ownership.

### Admin And Moderation

- Moderation/admin tools are planned later.
- Do not add the admin panel during the current pivot.
- Future admin tooling should cover user/profile moderation, opportunity
  quality, reports, and institutional controls.

## Current App State

- Expo app exists at `/Users/ibrahimalikhudiyev/university-portal`
- Current phone-test-compatible Expo SDK: `54`
- Auth exists and must keep working
- Active authenticated mobile surface is CampusConnect networking
- CampusConnect backend domain exists alongside legacy academic tables
- Current MVP includes an early deterministic matching preview for recommended
  profiles and opportunities
- Publishing preparation exists in `docs/PUBLISHING.md`
- Messaging, AI matching, badges/ranking, external scholarly integrations, and
  admin tooling are out of scope for now

## Coordinator Rules

- Keep decisions explicit and written down.
- Build the smallest useful networking product first, not a landing page.
- Prefer boring, stable architecture over novelty.
- Keep iOS and Android parity unless a platform-specific feature is required.
- Every sensitive workflow must enforce permissions on the backend, not only in
  the UI.
- Do not delete existing working academic compatibility code until replacement
  workflows are proven and cleanup is explicitly planned.
- Do not upgrade Expo, React, React Native, TypeScript, or package versions
  during this pivot.
- Do not add dependencies or a navigation library during the current MVP pass.
- Do not implement messaging, payments, AI matching, badges/rankings,
  ORCID/Google Scholar/university-system integrations, or the admin panel in
  this phase.

## Current MVP

### Professional Profiles

- Login
- Public, university-only, or private profile visibility
- Student, teacher, professor, mentor, employer, and startup-builder identity
  through role, headline, bio, university, faculty, graduation year, and
  location
- Skills with beginner, intermediate, advanced, or expert level
- Portfolio/resume entries for education, work, projects, research, awards, and
  certifications

### Discover

- Find students, teachers, professors, mentors, collaborators, and employers
- See recommended profiles with transparent match scores and short reasons
- Search by name, role, skill, university, faculty, and location
- Open profile detail panels without adding a navigation library
- Request academic/professional connections

### Opportunities

- Startup cofounder posts
- Research assistant and research collaboration posts
- Internship and job posts
- Student project teammate posts
- See recommended opportunities with transparent match scores and short reasons
- Apply to opportunities
- Save opportunities
- Prevent duplicate applications and duplicate saved opportunities

### Profile And Applications

- View and edit the current user's basic CampusConnect profile fields
- View skills and portfolio/resume entries
- Track submitted applications
- View sent and received connection requests

## Future Vision

- Events, hackathons, grants, and broader university innovation programs
- Verified university badges and ranking signals
- AI-assisted matching between profiles, skills, mentors, research projects, and
  opportunities
- ORCID, Google Scholar, and university information-system integrations
- Richer mentorship and supervisor discovery
- Messaging after the core network workflows are stable
- Moderation and admin workflows
- Payments only if a later business model requires them
- EAS internal builds for iOS and Android
- Production hardening and store submission

## Backend Invariants

- Authenticated users can read and update their own network profile.
- Profile list responses must not expose private profiles owned by other users.
- University-only profiles are visible only to users from the same university.
- Opportunity applications cannot be duplicated for the same applicant and
  opportunity.
- Connection requests cannot be duplicated for the same requester and receiver.
- Saved opportunities cannot be duplicated for the same profile and opportunity.
- API responses must never include password or password-hash fields.
- Legacy academic tables stay in place until explicitly removed in a later
  cleanup.

## Legacy Academic Backend Context

Older schedule, materials, attendance, and grades tables/endpoints still exist
for compatibility and regression tests. Treat them as historical/unused context
for the current product direction unless a task explicitly asks for legacy
maintenance.

## Milestones

1. Preserve auth and legacy academic regression behavior during the pivot.
2. Add CampusConnect backend domain models, schemas, migrations, seed data, and
   tests.
3. Add minimal authenticated network endpoints.
4. Add mobile API client/types for networking as needed.
5. Redesign the mobile first screen around profile and opportunity discovery.
6. Add profile editing for skills and resume entries.
7. Add opportunity detail, apply, save, and connection-request UI flows.
8. Add opportunity posting polish and broader opportunity categories when the
   MVP contract is stable.
9. Add moderation and admin tooling later.
10. Prepare EAS internal builds for iOS and Android after MVP validation.

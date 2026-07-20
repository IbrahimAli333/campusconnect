# Unibridge

Unibridge is a university-based academic and professional networking
ecosystem. It connects students, teachers, professors, mentors, researchers,
startup builders, and employers around profiles, portfolios, skills, research,
projects, internships, and cofounder discovery.

English short explanation: Unibridge helps university communities build
professional profiles, showcase academic portfolios, discover collaborators and
mentors, and apply to research, startup, internship, and project opportunities.

Azerbaijani short explanation: Unibridge universitet icmalarına peşəkar
profil və portfolio qurmaq, bacarıqları göstərmək, tələbə, müəllim, professor,
mentor və əməkdaş tapmaq, həmçinin tədqiqat, startap, təcrübə və layihə
imkanlarına müraciət etmək üçün akademik və peşəkar şəbəkədir.

Unibridge is not a normal social app, not an attendance product, and not a
grades or university-management product.

Project coordination, stack decisions, and milestone ownership live in
[`docs/PROJECT_COORDINATION.md`](docs/PROJECT_COORDINATION.md).
Publishing and deployment steps live in
[`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Current MVP

- Mobile-first academic and professional profiles for students, teachers,
  professors, mentors, employers, and startup builders
- Portfolio/resume entries for education, work, projects, research, awards, and
  certifications
- Skills with visible proficiency levels
- Profile discovery for students, mentors, professors, collaborators, and
  employers
- Opportunity discovery for startup cofounders, research assistants,
  internships, jobs, and student project teammates
- Deterministic matching preview for recommended profiles and opportunities,
  based on skills, profile role/type, university/faculty, and portfolio/resume
  keywords
- Authenticated opportunity applications
- Opportunity owner tools for listing owned posts, reviewing applicants, and
  setting application status to reviewing, accepted, or rejected
- Saved opportunities
- Connection requests for academic and professional networking
- Authenticated profile editing for headline, bio, university, faculty,
  graduation year, location, visibility, skills, and portfolio/resume entries

## Future Vision

- Events, hackathons, grants, and broader university innovation programs
- Verified university badges and ranking signals
- AI-assisted matching between profiles, skills, mentors, research projects, and
  opportunities
- ORCID, Google Scholar, and university information-system integrations
- Richer mentorship and supervisor discovery
- Messaging after the core network workflows are stable
- Moderation and admin tooling for institutional controls

## Mobile Unibridge Flow

The authenticated Expo app opens directly into the Unibridge networking
shell. It uses custom segmented tabs and does not add React Navigation yet.

- **Discover** loads `/api/v1/network/recommendations/profiles` for an early
  deterministic matching preview, then loads `/api/v1/network/profiles`,
  enriches visible profiles with detail data, supports local search by name,
  skill, and university, opens profile detail panels in-screen, and sends
  connection requests with `/api/v1/network/connections/{profile_id}/request`.
- **Opportunities** loads `/api/v1/network/recommendations/opportunities` for
  recommended open posts, then loads `/api/v1/network/opportunities`, filters
  by startup, research, internship, job, and project, opens in-screen
  opportunity detail panels from tapped cards, supports apply/save actions, and
  includes an inline create-opportunity form. Detail panels use
  `/api/v1/network/opportunities/{opportunity_id}` and show owner, required
  skills, applied, and saved state. The same tab includes **My Posts**, loaded
  from `/api/v1/network/opportunities/mine`; tapping an owned opportunity opens
  an applicant review panel from
  `/api/v1/network/opportunities/{opportunity_id}/applications` with applicant
  profile summaries, skills, portfolio highlights, application notes, and
  status controls for reviewing, accepted, and rejected.
- **Applications** loads `/api/v1/network/applications/me` and tracks the
  current user's submitted applications with opportunity title, type, owner,
  status, and submitted date. Tapping an application opens the same in-screen
  opportunity detail panel without adding a navigation library.
- **Profile** loads `/api/v1/network/me`, shows headline, bio, university,
  faculty, location, visibility, skills, and resume entries, edits basic
  profile fields through `PATCH /api/v1/network/me`, and manages skills and
  portfolio/resume entries inline without adding a navigation library. Skill
  edits use `/api/v1/network/me/skills`; resume edits use
  `/api/v1/network/me/resume`.
- **Connections** loads `/api/v1/network/connections/me` and shows the current
  user's sent and received academic/professional connection requests.

## Backend

The backend lives in `backend/` and uses FastAPI, SQLAlchemy, Alembic, and
PostgreSQL-compatible models.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Set `UNIVERSITY_PORTAL_DATABASE_URL` in `backend/.env` for your PostgreSQL
database. Also set `UNIVERSITY_PORTAL_SECRET_KEY` to a long random value before
running outside local development. The backend rejects the default secret when
`UNIVERSITY_PORTAL_ENVIRONMENT` is `production`.

Run migrations, seed local development data, and start the API from `backend/`:

```bash
alembic upgrade head
python3 -m app.scripts.seed_dev
uvicorn app.main:app --reload
```

The dev seed is idempotent and refuses to run when `ENVIRONMENT=production` or
`UNIVERSITY_PORTAL_ENVIRONMENT=production`. It creates Unibridge profiles,
skills, resume entries, and sample startup, research, internship, and project
opportunities with Azerbaijani university-flavored examples.

For a physical phone running Expo Go, bind the API to your local network:

```bash
uvicorn app.main:app --host 0.0.0.0 --reload
```

Create the first admin account once, before any users exist:

```bash
curl -X POST http://localhost:8000/api/v1/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.edu","password":"change-this-password","full_name":"First Admin"}'
```

Local development credentials created by `python3 -m app.scripts.seed_dev`:

```text
member@example.edu / member-password
student@example.edu / student-password
teacher@example.edu / teacher-password
```

Unibridge network endpoints are available under `/api/v1/network/*`,
including `/api/v1/network/applications/me`,
`/api/v1/network/applications/{application_id}`,
`/api/v1/network/recommendations/opportunities`,
`/api/v1/network/recommendations/profiles`,
`/api/v1/network/opportunities/mine`,
`/api/v1/network/opportunities/{opportunity_id}`,
`/api/v1/network/opportunities/{opportunity_id}/applications`,
`/api/v1/network/connections/me`, `/api/v1/network/me/skills`, and
`/api/v1/network/me/resume`.

Seeded profile examples include Aydin Mammadli's student portfolio with Python,
React Native, PostgreSQL, Azerbaijani NLP, a CS education entry, a Campus Study
Planner project, an NLP research assistantship, and a backend internship.
Mentor, professor, startup mentor, and employer profiles include complementary
skills and resume entries for discovery and profile-detail testing.

### Legacy Academic Backend Context

The repository still contains older academic tables, seed fixtures, tests, and
API routes for schedules, materials, attendance, and grades. They are retained
as historical compatibility/regression context during the pivot and are not the
current Unibridge product surface.

Backend tests use SQLite for lightweight local checks:

```bash
cd backend
python3 -m pytest
```

## Mobile API URL

The app reads `EXPO_PUBLIC_API_URL` when it is set. Without it, web uses
`http://localhost:8000`, Android emulator uses `http://10.0.2.2:8000`, and
native Expo development builds try to reuse the Expo dev-server host on port
`8000` for local phone testing.

Examples:

```bash
# Web or iOS simulator
EXPO_PUBLIC_API_URL=http://localhost:8000 npm start

# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npm start

# Physical phone on the same Wi-Fi as this Mac
CURRENT_IP=$(ipconfig getifaddr en0) && EXPO_PUBLIC_API_URL=http://$CURRENT_IP:8000 npm start -- --host lan
```

Use your Mac's current Wi-Fi IP address in `EXPO_PUBLIC_API_URL` for physical
phone testing, and keep the backend running with `--host 0.0.0.0`. Re-run the
`CURRENT_IP=$(ipconfig getifaddr en0)` command after changing Wi-Fi networks,
hotspots, or VPN/network adapters.

To test on a phone:

1. Run the backend on your network with `cd backend && uvicorn app.main:app --host 0.0.0.0 --reload`.
2. Run the Expo app with `CURRENT_IP=$(ipconfig getifaddr en0) && EXPO_PUBLIC_API_URL=http://$CURRENT_IP:8000 npm start -- --host lan`.
3. Open Expo Go on the same Wi-Fi network and sign in with a seeded user.

## Commands

```bash
npm start
npm run web
npm run ios
npm run android
npm run typecheck
npm run doctor
npm run publish:check
```

## Publishing

The repo has EAS build profiles, production app identifiers, backend Docker
packaging, and production API URL checks. Store-ready builds require a hosted
HTTPS backend:

```bash
EXPO_PUBLIC_API_URL=https://api.your-campusconnect-domain.com npm run build:android:production
EXPO_PUBLIC_API_URL=https://api.your-campusconnect-domain.com npm run build:ios:production
```

See [`docs/PUBLISHING.md`](docs/PUBLISHING.md) before running the first store
build.

## Next Build Steps

- Add applicant withdrawal once the applicant-side workflow is ready
- Add opportunity posting polish after the core network workflows are stable
- Keep auth and legacy academic regression coverage working during the
  transition

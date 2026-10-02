# Google Play listing - Unibridge

Everything below is ready to paste into the Play Console. Items marked YOU
require actions only the account owner can do.

## App details

- **App name:** Unibridge
- **Short description (max 80 chars):**
  `University networking: research, startups, applications, and mentorship.`
- **Full description:**

```
Unibridge is an academic and professional network for university communities.

Built for members, students, and faculty:
- Discover people by skills, role, faculty, and university, with match scores that explain why someone is recommended.
- Browse research, startup, project, internship, and job opportunities posted by your university community.
- Apply in one tap and track every application from submission to decision.
- Post opportunities (students post startups and projects, faculty post research) and review applicants with their skills and portfolio in one place.
- Build a portfolio profile with skills and resume entries, and control who can see it (public, university-only, or private).
- Grow your network with connection requests, and see new activity at a glance with tab badges.

Safety and control:
- Report any profile or post for review.
- Block users to hide their content from you and yours from them.
- Download a copy of your data, turn off push notifications, or delete your account (and the data linked to it) at any time from the Me tab.

Unibridge is for adults (18+) in university communities.

Create your own member account in the app, or sign in with credentials provided by your university program.
```

- **Category:** Social (alternative: Education)
- **Tags:** networking, education, campus
- **Contact email:** ibrahimaliworkacc@gmail.com
- **Website:** https://ibrahimali333.github.io/campusconnect/
- **Privacy policy URL:** https://ibrahimali333.github.io/campusconnect/privacy-policy.html
- **Delete account URL (Data safety):** https://ibrahimali333.github.io/campusconnect/delete-account.html

## Azerbaijani listing (primary — Play Console language az-AZ)

Unibridge is Azerbaijani-first, so set **Azərbaycan dili (az-AZ)** as the
default listing language in Play Console → Store presence → Main store
listing → Manage translations, and paste this. Have a native speaker
proof-read it before publishing.

- **App name:** Unibridge
- **Short description (max 80 chars, 75):**
  `Universitet şəbəkəsi: tədqiqat, startap, təcrübə, müraciətlər və mentorluq.`
- **Full description:**

```
Unibridge Azərbaycan universitet icmaları üçün akademik və peşəkar şəbəkədir.

Üzvlər, tələbələr və müəllimlər üçün:
- İnsanları bacarıq, rol, fakültə və universitetə görə tapın; uyğunluq balı kimin niyə tövsiyə olunduğunu izah edir.
- Universitet icmanızın paylaşdığı tədqiqat, startap, layihə, təcrübə və iş imkanlarına baxın.
- Bir toxunuşla müraciət edin və hər müraciəti göndərişdən qərara qədər izləyin.
- İmkan paylaşın (tələbələr startap və layihə, müəllimlər tədqiqat paylaşır) və namizədlərin bacarıqlarını və portfoliosunu bir yerdə nəzərdən keçirin.
- Bacarıqlar və CV qeydləri ilə portfolio profili qurun və onu kimin görəcəyini seçin (hamı, yalnız universitet və ya gizli).
- Əlaqə sorğuları ilə şəbəkənizi genişləndirin və yeni fəaliyyəti nişanlarla bir baxışda görün.

Təhlükəsizlik və nəzarət:
- İstənilən profil və ya elan barədə şikayət edin.
- İstifadəçiləri bloklayın: onların məzmunu sizə, sizinki onlara görünməz.
- Məlumatlarınızın surətini endirin, push bildirişlərini söndürün və ya hesabınızı (ona bağlı məlumatlarla birlikdə) istənilən vaxt "Mən" bölməsindən silin.

Unibridge universitet icmalarındakı yetkinlər (18+) üçündür. Tətbiq Azərbaycan, ingilis və rus dillərindədir.

Tətbiqdə üzv hesabı yaradın və ya universitet proqramınızın verdiyi məlumatlarla daxil olun.
```

## Russian listing (Play Console language ru-RU)

- **Short description (max 80 chars, 71):**
  `Сеть университета: исследования, стартапы, стажировки и наставничество.`
- **Full description:**

```
Unibridge — академическая и профессиональная сеть для университетских сообществ Азербайджана.

Для участников, студентов и преподавателей:
- Находите людей по навыкам, роли, факультету и университету — оценка совпадения объясняет, почему вам кого-то рекомендуют.
- Просматривайте исследования, стартапы, проекты, стажировки и вакансии от вашего университетского сообщества.
- Откликайтесь в одно касание и следите за каждым откликом от отправки до решения.
- Публикуйте возможности (студенты — стартапы и проекты, преподаватели — исследования) и просматривайте кандидатов с их навыками и портфолио в одном месте.
- Создайте профиль-портфолио с навыками и записями резюме и выберите, кто его видит (все, только университет или никто).
- Расширяйте сеть с помощью запросов на контакт и видите новую активность по значкам на вкладках.

Безопасность и контроль:
- Пожалуйтесь на любой профиль или публикацию.
- Блокируйте пользователей: их контент скрыт от вас, а ваш — от них.
- Скачайте копию своих данных, отключите push-уведомления или удалите аккаунт (вместе со связанными данными) в любое время на вкладке «Я».

Unibridge предназначен для взрослых (18+) в университетских сообществах. Приложение доступно на азербайджанском, английском и русском языках.

Создайте аккаунт участника в приложении или войдите с данными, выданными вашей университетской программой.
```

## App Store localisations

The app itself is Azerbaijani-first. Check App Store Connect's list of
listing languages when you add localisations; as far as I know it does not
include Azerbaijani. If so, keep English as the primary listing, add Russian
(paste the Russian text above into the App Store fields), and mention in the
description that the app is in Azerbaijani, English, and Russian.

## Access instructions for Google reviewers (App access form)

Anyone can create a Member account in-app, but posting requires a
student/teacher role granted by administrators, so declare "All or some
functionality is restricted" and provide a demo credential set. The reviewer account (reviewer@example.edu,
student role) is provisioned automatically on deploy once
UNIVERSITY_PORTAL_REVIEWER_PASSWORD is set in the Render dashboard — read the
password from there (do NOT hand out the shared demo accounts):

```
Email: reviewer@example.edu
Password: <UNIVERSITY_PORTAL_REVIEWER_PASSWORD from the Render dashboard>
Notes: Log in with the credentials above to review the full app. On first
login, accept the Terms of Service and Privacy Policy and confirm you are
18 or older (tick both boxes, then "Agree and continue"). Anyone
can also create a Member account with "Create account"; Member accounts can
browse, save, apply, connect, and message. Posting requires a student or
teacher role granted by university administrators, so the provided account
is the easiest way to review posting and applicant review. Report, block,
and account deletion are available in-app.
```

## Content rating questionnaire (IARC) - expected answers

- User-generated content: YES (profiles and opportunity posts)
  - Users can report objectionable UGC: YES
  - Users can block other users: YES
- Violence / sexuality / drugs / gambling: NO
- Shares user location: NO
- Allows purchases: NO
- IARC rates content, not audience: expect a low content rating with the
  "Users Interact" interactive element. The 18+ restriction is set in
  Target audience below, not by IARC.

## Target audience

- Target age group: 18+ only (YOU: tick only the 18+ box in Play Console →
  App content → Target audience and content).
- Not appealing to children. Signup requires confirming age 18 or older.

## Contact details

Unibridge is run by an individual, not a company.

- **Developer name:** Ibrahim Ali Khudiyev (personal Play developer account). Google
  verifies your address and phone privately; for a free app on a personal
  account they are not shown on the listing.
- **Contact email:** ibrahimaliworkacc@gmail.com
- **EU DSA trader status:** YOU declare it in Play Console. A free app with
  no income, run by an individual, is normally declared **non-trader**.

## Checklist before submitting

- [ ] YOU: Play Console developer account ($25 one-time), identity verified.
- [ ] YOU: 14-day closed test with 12 testers (required for new personal accounts before production).
- [ ] Production AAB uploaded (see docs/store/release-build.md notes in repo).
- [ ] Store listing assets: app icon 512x512 (have: assets/icon.png - export at 512), feature graphic 1024x500 (make one), 4-8 phone screenshots (capture from emulator in production mode).
- [ ] Data safety form (see data-safety.md) — re-check it: messages,
      device IDs (push token), and crash logs changed on 2026-10-02.
- [ ] Lawyer has approved terms.html and privacy-policy.html and the DRAFT
      banners have been removed (COMPLIANCE.md).
- [ ] Privacy policy URL live (GitHub Pages).
- [ ] App access credentials for reviewers filled in.

import { API_BASE_URL } from "./config";
import type {
  Announcement,
  Course,
  CourseStatus,
  MaterialItem,
  Priority,
  ScheduleItem,
  TeacherClass,
} from "../../types/portal";

export type PortalUserRole = "admin" | "member" | "staff" | "student" | "teacher";
export type PortalEnrollmentStatus = "active" | "completed" | "dropped" | "withdrawn";
export type PortalLessonType = "lecture" | "seminar" | "lab" | "exam" | "practice";
export type PortalAttendanceStatus = "present" | "absent" | "late" | "excused";
export type PortalMaterialKind = "document" | "link" | "video" | "slides" | "repository";
export type PortalAnnouncementTarget = "all" | "admin" | "student" | "teacher" | "staff";
export type PortalAnnouncementPriority = "low" | "normal" | "high" | "urgent";

export interface PortalUserSummary {
  id: number;
  email: string;
  full_name: string;
  role: PortalUserRole;
}

export interface PortalGroupSummary {
  id: number;
  name: string;
  start_year: number;
  department_id: number;
  department_name: string;
  university_id: number;
  university_name: string;
}

export interface PortalDepartmentSummary {
  id: number;
  name: string;
  code: string;
  university_id: number;
  university_name: string;
}

export interface PortalStudentProfile {
  id: number;
  user: PortalUserSummary;
  student_number: string;
  enrollment_year: number | null;
  group: PortalGroupSummary;
}

export interface PortalTeacherProfile {
  id: number;
  user: PortalUserSummary;
  teacher_number: string;
  title: string | null;
  department: PortalDepartmentSummary;
}

export interface PortalStudentCourse {
  id: number;
  code: string;
  title: string;
  credits: number | null;
  enrollment_status: PortalEnrollmentStatus;
  teacher_name: string | null;
}

export interface PortalTeacherCourse {
  id: number;
  code: string;
  title: string;
  credits: number | null;
  enrolled_count: number;
}

export interface PortalAssignedClass {
  course_id: number;
  course_code: string;
  course_title: string;
  group_id: number;
  group_name: string;
  enrolled_count: number;
}

export interface PortalAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
}

export interface PortalLessonRosterStudent {
  student_profile_id: number;
  student_user_id: number;
  full_name: string;
  student_number: string;
  attendance_status: PortalAttendanceStatus | null;
}

export interface PortalTeacherGradeRosterStudent {
  student_profile_id: number;
  student_user_id: number;
  full_name: string;
  student_number: string;
  group_id: number;
  group_name: string;
  score: number | null;
  comment: string | null;
  graded_at: string | null;
}

export interface PortalLesson {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  group_id: number;
  group_name: string;
  teacher_profile_id: number;
  teacher_name: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  lesson_type: PortalLessonType;
  attendance_summary: PortalAttendanceSummary | null;
  roster: PortalLessonRosterStudent[];
}

export interface PortalAttendanceRecord {
  id: number;
  lesson_id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  group_id: number;
  group_name: string;
  teacher_name: string;
  starts_at: string;
  lesson_type: PortalLessonType;
  room: string | null;
  status: PortalAttendanceStatus;
  marked_at: string | null;
}

export interface PortalGradeRecord {
  grade_item_id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  title: string;
  kind: string;
  score: number;
  max_score: number;
  comment: string | null;
  graded_at: string | null;
}

export interface PortalCourseGradeSummary {
  course_id: number;
  course_code: string;
  course_title: string;
  earned_score: number;
  max_score: number;
  percent: number | null;
  records: PortalGradeRecord[];
}

export interface PortalMaterial {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  title: string;
  kind: PortalMaterialKind;
  url: string;
  published_by_teacher_id: number | null;
  created_at: string;
}

export interface PortalAnnouncement {
  id: number;
  title: string;
  body: string;
  target_role: PortalAnnouncementTarget;
  priority: PortalAnnouncementPriority;
  published_by_user_id: number | null;
  created_at: string;
}

export interface PortalPendingGradeItem {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  title: string;
  kind: string;
  max_score: number;
  due_at: string | null;
  pending_count: number;
}

export interface PortalTeacherGradeItem {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  title: string;
  kind: string;
  max_score: number;
  due_at: string | null;
  enrolled_count: number;
  graded_count: number;
  pending_count: number;
  roster: PortalTeacherGradeRosterStudent[];
}

export interface StudentPortalResponse {
  profile: PortalStudentProfile;
  courses: PortalStudentCourse[];
  schedule: PortalLesson[];
  attendance_summary: PortalAttendanceSummary;
  attendance_records: PortalAttendanceRecord[];
  grades_summary: PortalCourseGradeSummary[];
  materials: PortalMaterial[];
  announcements: PortalAnnouncement[];
}

export interface TeacherPortalResponse {
  profile: PortalTeacherProfile;
  assigned_courses: PortalTeacherCourse[];
  assigned_classes: PortalAssignedClass[];
  upcoming_lessons: PortalLesson[];
  pending_grade_items: PortalPendingGradeItem[];
  grade_items: PortalTeacherGradeItem[];
  materials: PortalMaterial[];
  announcements: PortalAnnouncement[];
}

export interface StudentPortalView {
  profileName: string;
  profileMeta: string;
  attendanceRate: number;
  attendanceRecords: PortalAttendanceRecord[];
  averageGrade: number | null;
  gradeSummaries: PortalCourseGradeSummary[];
  gradeRecords: PortalGradeRecord[];
  courses: Course[];
  schedule: ScheduleItem[];
  materials: MaterialItem[];
  announcements: Announcement[];
}

export interface TeacherPortalView {
  profileName: string;
  profileMeta: string;
  assignedCourses: PortalTeacherCourse[];
  attendanceLessons: PortalLesson[];
  classes: TeacherClass[];
  upcomingLessons: ScheduleItem[];
  pendingGradeItems: PortalPendingGradeItem[];
  gradeItems: PortalTeacherGradeItem[];
  pendingGradeCount: number;
  totalStudents: number;
  materials: MaterialItem[];
  announcements: Announcement[];
}

interface ApiErrorBody {
  detail?: string | Array<{ msg?: string }>;
}

export class PortalApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PortalApiError";
    this.status = status;
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiErrorBody;
    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      const messages = data.detail.map((item) => item.msg).filter(Boolean);
      if (messages.length > 0) {
        return messages.join("\n");
      }
    }
  } catch {
    // Use the status fallback below when the response body is not JSON.
  }

  return `Request failed with status ${response.status}`;
}

async function requestPortalJson<TResponse>(path: string, token: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new PortalApiError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as TResponse;
}

export function getStudentPortal(token: string): Promise<StudentPortalResponse> {
  return requestPortalJson<StudentPortalResponse>("/api/v1/portal/student", token);
}

export function getTeacherPortal(token: string): Promise<TeacherPortalResponse> {
  return requestPortalJson<TeacherPortalResponse>("/api/v1/portal/teacher", token);
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatClock(value: string): string {
  const date = parseDate(value);
  if (!date) {
    return "--:--";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDay(value: string): string {
  const date = parseDate(value);
  if (!date) {
    return "TBD";
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDate(date, today)) {
    return "Today";
  }

  if (isSameDate(date, tomorrow)) {
    return "Tomorrow";
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatShortDateTime(value: string): string {
  return `${formatDay(value)} ${formatClock(value)}`;
}

function normalizePriority(priority: PortalAnnouncementPriority): Priority {
  return priority;
}

function targetLabel(target: PortalAnnouncementTarget): string {
  if (target === "all") {
    return "Campus";
  }

  return target.charAt(0).toUpperCase() + target.slice(1);
}

function lessonToScheduleItem(lesson: PortalLesson): ScheduleItem {
  return {
    id: String(lesson.id),
    day: formatDay(lesson.starts_at),
    time: formatClock(lesson.starts_at),
    title: lesson.course_title,
    room: lesson.room ?? "TBD",
    teacher: lesson.teacher_name,
    type: lesson.lesson_type,
  };
}

function materialToItem(material: PortalMaterial): MaterialItem {
  return {
    id: String(material.id),
    title: material.title,
    courseCode: material.course_code,
    kind: material.kind,
  };
}

function announcementToItem(announcement: PortalAnnouncement): Announcement {
  return {
    id: String(announcement.id),
    title: announcement.title,
    body: announcement.body,
    priority: normalizePriority(announcement.priority),
    target: targetLabel(announcement.target_role),
    dateLabel: formatDay(announcement.created_at),
  };
}

function courseStatusFor(
  enrollmentStatus: PortalEnrollmentStatus,
  gradePercent: number | null,
  attendanceRate: number,
): CourseStatus {
  if (enrollmentStatus === "completed") {
    return "completed";
  }

  if (enrollmentStatus === "active" && ((gradePercent !== null && gradePercent < 70) || attendanceRate < 75)) {
    return "at_risk";
  }

  return "active";
}

export function mapStudentPortal(data: StudentPortalResponse): StudentPortalView {
  const gradesByCourse = new Map(data.grades_summary.map((grade) => [grade.course_id, grade]));
  const gradeRecords = data.grades_summary
    .flatMap((grade) => grade.records)
    .sort((left, right) => {
      const leftTime = parseDate(left.graded_at)?.getTime() ?? 0;
      const rightTime = parseDate(right.graded_at)?.getTime() ?? 0;
      return rightTime - leftTime;
    });
  const attendanceRate = Math.round(data.attendance_summary.attendance_rate);
  const gradePercents = data.grades_summary
    .map((grade) => grade.percent)
    .filter((grade): grade is number => typeof grade === "number");

  const averageGrade =
    gradePercents.length > 0
      ? Math.round(gradePercents.reduce((sum, grade) => sum + grade, 0) / gradePercents.length)
      : null;

  return {
    profileName: data.profile.user.full_name,
    profileMeta: `${data.profile.group.department_name} - ${data.profile.group.name}`,
    attendanceRate,
    attendanceRecords: data.attendance_records,
    averageGrade,
    gradeSummaries: data.grades_summary,
    gradeRecords,
    courses: data.courses.map((course) => {
      const gradePercent = gradesByCourse.get(course.id)?.percent ?? null;
      return {
        id: String(course.id),
        code: course.code,
        title: course.title,
        teacher: course.teacher_name ?? "Unassigned teacher",
        credits: course.credits ?? 0,
        attendancePercent: attendanceRate,
        currentGrade: gradePercent === null ? 0 : Math.round(gradePercent),
        status: courseStatusFor(course.enrollment_status, gradePercent, attendanceRate),
      };
    }),
    schedule: data.schedule.map(lessonToScheduleItem),
    materials: data.materials.map(materialToItem),
    announcements: data.announcements.map(announcementToItem),
  };
}

export function mapTeacherPortal(data: TeacherPortalResponse): TeacherPortalView {
  const lessons = data.upcoming_lessons.map(lessonToScheduleItem);
  const gradeItems = data.grade_items ?? [];
  const lessonByClass = new Map<string, PortalLesson>();
  data.upcoming_lessons.forEach((lesson) => {
    const key = `${lesson.course_id}:${lesson.group_id}`;
    if (!lessonByClass.has(key)) {
      lessonByClass.set(key, lesson);
    }
  });
  const pendingByCourse = data.pending_grade_items.reduce<Record<number, number>>((acc, item) => {
    acc[item.course_id] = (acc[item.course_id] ?? 0) + item.pending_count;
    return acc;
  }, {});

  return {
    profileName: data.profile.user.full_name,
    profileMeta: `${data.profile.department.name} - ${data.profile.title ?? "Teacher"}`,
    assignedCourses: data.assigned_courses,
    attendanceLessons: data.upcoming_lessons.filter((lesson) => lesson.roster.length > 0),
    classes: data.assigned_classes.map((assignedClass) => {
      const nextLesson = lessonByClass.get(`${assignedClass.course_id}:${assignedClass.group_id}`);
      return {
        id: `${assignedClass.course_id}-${assignedClass.group_id}`,
        code: assignedClass.course_code,
        title: assignedClass.course_title,
        group: assignedClass.group_name,
        studentsCount: assignedClass.enrolled_count,
        nextLesson: nextLesson ? formatShortDateTime(nextLesson.starts_at) : "No lessons scheduled",
        room: nextLesson?.room ?? "TBD",
        pendingGrades: pendingByCourse[assignedClass.course_id] ?? 0,
        attendanceOpen: Boolean(nextLesson),
      };
    }),
    upcomingLessons: lessons,
    pendingGradeItems: data.pending_grade_items,
    gradeItems,
    pendingGradeCount: data.pending_grade_items.reduce((sum, item) => sum + item.pending_count, 0),
    totalStudents: data.assigned_classes.reduce((sum, item) => sum + item.enrolled_count, 0),
    materials: (data.materials ?? []).map(materialToItem),
    announcements: data.announcements.map(announcementToItem),
  };
}

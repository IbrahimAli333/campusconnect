export type UserRole = "member" | "student" | "teacher";

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export type Priority = "low" | "normal" | "important" | "high" | "urgent";

export type CourseStatus = "active" | "completed" | "at_risk";

export type StudentTab = "overview" | "courses" | "schedule" | "materials";

export type TeacherTab = "overview" | "classes" | "attendance" | "grades";

export type ScheduleType = "lecture" | "seminar" | "lab" | "exam" | "practice";

export type MaterialKind = "document" | "link" | "video" | "slides" | "repository" | "pdf" | "assignment";

export interface StudentProfile {
  id: string;
  fullName: string;
  studentNumber: string;
  faculty: string;
  group: string;
  semester: string;
  advisor: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  teacher: string;
  credits: number;
  attendancePercent: number;
  currentGrade: number;
  status: CourseStatus;
}

export interface ScheduleItem {
  id: string;
  day: string;
  time: string;
  title: string;
  room: string;
  teacher: string;
  type: ScheduleType;
}

export interface MaterialItem {
  id: string;
  title: string;
  courseCode: string;
  kind: MaterialKind;
  dueLabel?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  target: string;
  dateLabel: string;
}

export interface TeacherProfile {
  id: string;
  fullName: string;
  staffNumber: string;
  department: string;
  title: string;
}

export interface TeacherClass {
  id: string;
  code: string;
  title: string;
  group: string;
  studentsCount: number;
  nextLesson: string;
  room: string;
  pendingGrades: number;
  attendanceOpen: boolean;
}

export interface ClassStudent {
  id: string;
  fullName: string;
  studentNumber: string;
  attendanceStatus: AttendanceStatus;
  currentScore: number;
}

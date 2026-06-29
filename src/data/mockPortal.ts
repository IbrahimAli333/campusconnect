import type {
  Announcement,
  ClassStudent,
  Course,
  MaterialItem,
  ScheduleItem,
  StudentProfile,
  TeacherClass,
  TeacherProfile,
} from "../types/portal";

export const studentProfile: StudentProfile = {
  id: "stu-001",
  fullName: "Ayan Mammadova",
  studentNumber: "STU-2026-0142",
  faculty: "Computer Science",
  group: "CS-24A",
  semester: "Spring 2026",
  advisor: "Dr. Leyla Hasanli",
};

export const teacherProfile: TeacherProfile = {
  id: "tch-001",
  fullName: "Dr. Kamran Aliyev",
  staffNumber: "TCH-1184",
  department: "Information Systems",
  title: "Senior Lecturer",
};

export const courses: Course[] = [
  {
    id: "course-1",
    code: "CS201",
    title: "Data Structures",
    teacher: "Dr. Kamran Aliyev",
    credits: 6,
    attendancePercent: 94,
    currentGrade: 88,
    status: "active",
  },
  {
    id: "course-2",
    code: "MATH210",
    title: "Discrete Mathematics",
    teacher: "Nigar Karimova",
    credits: 5,
    attendancePercent: 89,
    currentGrade: 82,
    status: "active",
  },
  {
    id: "course-3",
    code: "ENG102",
    title: "Academic Writing",
    teacher: "Sarah Collins",
    credits: 3,
    attendancePercent: 72,
    currentGrade: 76,
    status: "at_risk",
  },
];

export const schedule: ScheduleItem[] = [
  {
    id: "schedule-1",
    day: "Today",
    time: "09:00",
    title: "Data Structures",
    room: "B-204",
    teacher: "Dr. Kamran Aliyev",
    type: "lecture",
  },
  {
    id: "schedule-2",
    day: "Today",
    time: "11:00",
    title: "Academic Writing",
    room: "A-118",
    teacher: "Sarah Collins",
    type: "seminar",
  },
  {
    id: "schedule-3",
    day: "Tomorrow",
    time: "10:30",
    title: "Discrete Mathematics",
    room: "C-310",
    teacher: "Nigar Karimova",
    type: "lecture",
  },
  {
    id: "schedule-4",
    day: "Tomorrow",
    time: "14:00",
    title: "Data Structures Lab",
    room: "Lab-2",
    teacher: "Dr. Kamran Aliyev",
    type: "lab",
  },
];

export const materials: MaterialItem[] = [
  {
    id: "material-1",
    title: "Binary trees and traversal notes",
    courseCode: "CS201",
    kind: "pdf",
  },
  {
    id: "material-2",
    title: "Graph algorithms lecture deck",
    courseCode: "CS201",
    kind: "slides",
  },
  {
    id: "material-3",
    title: "Essay draft submission",
    courseCode: "ENG102",
    kind: "assignment",
    dueLabel: "Due Friday",
  },
];

export const announcements: Announcement[] = [
  {
    id: "announcement-1",
    title: "Midterm schedule published",
    body: "Exam rooms for all second-year groups are now available.",
    priority: "important",
    target: "All students",
    dateLabel: "Today",
  },
  {
    id: "announcement-2",
    title: "Library database maintenance",
    body: "Digital library access will be limited from 22:00 to 23:30.",
    priority: "normal",
    target: "Campus",
    dateLabel: "Yesterday",
  },
];

export const teacherClasses: TeacherClass[] = [
  {
    id: "class-1",
    code: "CS201",
    title: "Data Structures",
    group: "CS-24A",
    studentsCount: 32,
    nextLesson: "Today 09:00",
    room: "B-204",
    pendingGrades: 6,
    attendanceOpen: true,
  },
  {
    id: "class-2",
    code: "CS201",
    title: "Data Structures",
    group: "CS-24B",
    studentsCount: 29,
    nextLesson: "Today 13:00",
    room: "B-204",
    pendingGrades: 2,
    attendanceOpen: false,
  },
  {
    id: "class-3",
    code: "IS310",
    title: "Database Systems",
    group: "IS-23A",
    studentsCount: 35,
    nextLesson: "Tomorrow 11:00",
    room: "C-112",
    pendingGrades: 0,
    attendanceOpen: false,
  },
];

export const classStudents: ClassStudent[] = [
  {
    id: "student-1",
    fullName: "Ayan Mammadova",
    studentNumber: "STU-2026-0142",
    attendanceStatus: "present",
    currentScore: 88,
  },
  {
    id: "student-2",
    fullName: "Murad Huseynli",
    studentNumber: "STU-2026-0188",
    attendanceStatus: "late",
    currentScore: 74,
  },
  {
    id: "student-3",
    fullName: "Fatima Abbasova",
    studentNumber: "STU-2026-0219",
    attendanceStatus: "present",
    currentScore: 93,
  },
  {
    id: "student-4",
    fullName: "Rauf Ismayilov",
    studentNumber: "STU-2026-0250",
    attendanceStatus: "absent",
    currentScore: 61,
  },
];

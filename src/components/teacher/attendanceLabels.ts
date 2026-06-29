import type { AttendanceStatus } from "../../types/portal";

export const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

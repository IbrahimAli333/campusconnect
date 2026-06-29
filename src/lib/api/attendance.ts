import { API_BASE_URL } from "./config";
import { PortalApiError, type PortalAttendanceStatus, type PortalLesson, type PortalLessonRosterStudent, type PortalAttendanceSummary } from "./portal";

export interface SubmitLessonAttendanceRecord {
  student_profile_id?: number;
  student_id?: number;
  status: PortalAttendanceStatus;
}

export interface LessonAttendanceResponse {
  lesson: PortalLesson;
  attendance_summary: PortalAttendanceSummary;
  records: PortalLessonRosterStudent[];
}

interface ApiErrorBody {
  detail?: string | Array<{ msg?: string }>;
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

export async function submitLessonAttendance(
  token: string,
  lessonId: number,
  records: SubmitLessonAttendanceRecord[],
): Promise<LessonAttendanceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/attendance/lessons/${lessonId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records }),
  });

  if (!response.ok) {
    throw new PortalApiError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as LessonAttendanceResponse;
}

import { API_BASE_URL } from "./config";
import { PortalApiError, type PortalTeacherGradeItem } from "./portal";

export interface SubmitGradeRecord {
  student_profile_id?: number;
  student_id?: number;
  score: number;
  comment?: string | null;
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

export async function submitGradeRecords(
  token: string,
  gradeItemId: number,
  records: SubmitGradeRecord[],
): Promise<PortalTeacherGradeItem> {
  const response = await fetch(`${API_BASE_URL}/api/v1/grades/items/${gradeItemId}`, {
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

  return (await response.json()) as PortalTeacherGradeItem;
}

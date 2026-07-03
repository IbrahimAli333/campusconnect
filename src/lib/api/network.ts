import { API_BASE_URL } from "./config";
import { fetchWithTimeout } from "./request";
import type {
  ConnectionRequestDecision,
  ConnectionRequestRead,
  ContentReportCreatePayload,
  ContentReportRead,
  MessageRead,
  MessageThreadRead,
  MyConnectionsRead,
  MyOpportunityApplicationRead,
  OwnerApplicationStatusUpdate,
  OwnerOpportunityApplicationRead,
  OpportunityApplicationRead,
  OpportunityCreatePayload,
  OpportunityDetailRead,
  OpportunityRecommendationRead,
  OpportunityRead,
  OpportunityUpdatePayload,
  ProfileRead,
  ProfileRecommendationRead,
  ProfileSummary,
  ProfileUpdatePayload,
  PushPlatform,
  PushTokenRead,
  ResumeEntryCreatePayload,
  ResumeEntryRead,
  ResumeEntryUpdatePayload,
  SavedOpportunityRead,
  UnreadMessagesRead,
  UserSkillCreatePayload,
  UserSkillRead,
  UserSkillUpdatePayload,
} from "../../types/network";

interface ApiErrorBody {
  detail?: string | Array<{ msg?: string }>;
}

export class NetworkApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NetworkApiError";
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
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
    // Use the status fallback when the response body is not JSON.
  }

  return `Request failed with status ${response.status}`;
}

async function requestNetworkJson<TResponse>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch (error) {
    throw new NetworkApiError(
      error instanceof Error ? error.message : "Could not connect to the API",
      0,
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    throw new NetworkApiError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as TResponse;
}

async function requestNetworkNoContent(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch (error) {
    throw new NetworkApiError(
      error instanceof Error ? error.message : "Could not connect to the API",
      0,
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    throw new NetworkApiError(await getErrorMessage(response), response.status);
  }
}

function jsonRequest(payload: unknown): Pick<RequestInit, "body" | "headers"> {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

export function getProfileDetail(token: string, profileId: number): Promise<ProfileRead> {
  return requestNetworkJson<ProfileRead>(`/api/v1/network/profiles/${profileId}`, token);
}

export function getMyProfile(token: string): Promise<ProfileRead> {
  return requestNetworkJson<ProfileRead>("/api/v1/network/me", token);
}

export function updateMyProfile(token: string, payload: ProfileUpdatePayload): Promise<ProfileRead> {
  return requestNetworkJson<ProfileRead>("/api/v1/network/me", token, {
    method: "PATCH",
    ...jsonRequest(payload),
  });
}

export function addMySkill(token: string, payload: UserSkillCreatePayload): Promise<UserSkillRead> {
  return requestNetworkJson<UserSkillRead>("/api/v1/network/me/skills", token, {
    method: "POST",
    ...jsonRequest(payload),
  });
}

export function updateMySkill(
  token: string,
  userSkillId: number,
  payload: UserSkillUpdatePayload,
): Promise<UserSkillRead> {
  return requestNetworkJson<UserSkillRead>(`/api/v1/network/me/skills/${userSkillId}`, token, {
    method: "PATCH",
    ...jsonRequest(payload),
  });
}

export function deleteMySkill(token: string, userSkillId: number): Promise<void> {
  return requestNetworkNoContent(`/api/v1/network/me/skills/${userSkillId}`, token, {
    method: "DELETE",
  });
}

export function addResumeEntry(token: string, payload: ResumeEntryCreatePayload): Promise<ResumeEntryRead> {
  return requestNetworkJson<ResumeEntryRead>("/api/v1/network/me/resume", token, {
    method: "POST",
    ...jsonRequest(payload),
  });
}

export function updateResumeEntry(
  token: string,
  resumeEntryId: number,
  payload: ResumeEntryUpdatePayload,
): Promise<ResumeEntryRead> {
  return requestNetworkJson<ResumeEntryRead>(`/api/v1/network/me/resume/${resumeEntryId}`, token, {
    method: "PATCH",
    ...jsonRequest(payload),
  });
}

export function deleteResumeEntry(token: string, resumeEntryId: number): Promise<void> {
  return requestNetworkNoContent(`/api/v1/network/me/resume/${resumeEntryId}`, token, {
    method: "DELETE",
  });
}

export function listProfiles(token: string): Promise<ProfileRead[]> {
  return requestNetworkJson<ProfileRead[]>("/api/v1/network/profiles", token);
}

export function getRecommendedProfiles(token: string): Promise<ProfileRecommendationRead[]> {
  return requestNetworkJson<ProfileRecommendationRead[]>("/api/v1/network/recommendations/profiles", token);
}

export function listOpportunities(token: string): Promise<OpportunityRead[]> {
  return requestNetworkJson<OpportunityRead[]>("/api/v1/network/opportunities", token);
}

export function getRecommendedOpportunities(token: string): Promise<OpportunityRecommendationRead[]> {
  return requestNetworkJson<OpportunityRecommendationRead[]>("/api/v1/network/recommendations/opportunities", token);
}

export function getOpportunityDetail(token: string, opportunityId: number): Promise<OpportunityDetailRead> {
  return requestNetworkJson<OpportunityDetailRead>(`/api/v1/network/opportunities/${opportunityId}`, token);
}

export function getMyApplications(token: string): Promise<MyOpportunityApplicationRead[]> {
  return requestNetworkJson<MyOpportunityApplicationRead[]>("/api/v1/network/applications/me", token);
}

export function getMyOwnedOpportunities(token: string): Promise<OpportunityRead[]> {
  return requestNetworkJson<OpportunityRead[]>("/api/v1/network/opportunities/mine", token);
}

export function getOpportunityApplications(
  token: string,
  opportunityId: number,
): Promise<OwnerOpportunityApplicationRead[]> {
  return requestNetworkJson<OwnerOpportunityApplicationRead[]>(
    `/api/v1/network/opportunities/${opportunityId}/applications`,
    token,
  );
}

export function updateApplicationStatus(
  token: string,
  applicationId: number,
  status: OwnerApplicationStatusUpdate,
): Promise<OwnerOpportunityApplicationRead> {
  return requestNetworkJson<OwnerOpportunityApplicationRead>(`/api/v1/network/applications/${applicationId}`, token, {
    method: "PATCH",
    ...jsonRequest({ status }),
  });
}

export function createOpportunity(token: string, payload: OpportunityCreatePayload): Promise<OpportunityRead> {
  return requestNetworkJson<OpportunityRead>("/api/v1/network/opportunities", token, {
    method: "POST",
    ...jsonRequest(payload),
  });
}

export function applyToOpportunity(token: string, opportunityId: number): Promise<OpportunityApplicationRead> {
  return requestNetworkJson<OpportunityApplicationRead>(`/api/v1/network/opportunities/${opportunityId}/apply`, token, {
    method: "POST",
  });
}

export function requestConnection(token: string, profileId: number, message?: string): Promise<ConnectionRequestRead> {
  const trimmedMessage = message?.trim();
  return requestNetworkJson<ConnectionRequestRead>(`/api/v1/network/connections/${profileId}/request`, token, {
    method: "POST",
    ...(trimmedMessage ? jsonRequest({ message: trimmedMessage }) : {}),
  });
}

export function getMyConnections(token: string): Promise<MyConnectionsRead> {
  return requestNetworkJson<MyConnectionsRead>("/api/v1/network/connections/me", token);
}

export function saveOpportunity(token: string, opportunityId: number): Promise<SavedOpportunityRead> {
  return requestNetworkJson<SavedOpportunityRead>(`/api/v1/network/opportunities/${opportunityId}/save`, token, {
    method: "POST",
  });
}

export function unsaveOpportunity(token: string, opportunityId: number): Promise<void> {
  return requestNetworkNoContent(`/api/v1/network/opportunities/${opportunityId}/save`, token, {
    method: "DELETE",
  });
}

export function updateOpportunity(
  token: string,
  opportunityId: number,
  payload: OpportunityUpdatePayload,
): Promise<OpportunityRead> {
  return requestNetworkJson<OpportunityRead>(`/api/v1/network/opportunities/${opportunityId}`, token, {
    method: "PATCH",
    ...jsonRequest(payload),
  });
}

export function withdrawApplication(token: string, applicationId: number): Promise<void> {
  return requestNetworkNoContent(`/api/v1/network/applications/${applicationId}`, token, {
    method: "DELETE",
  });
}

export function reportContent(token: string, payload: ContentReportCreatePayload): Promise<ContentReportRead> {
  return requestNetworkJson<ContentReportRead>("/api/v1/network/reports", token, {
    method: "POST",
    ...jsonRequest(payload),
  });
}

export function blockProfile(token: string, profileId: number): Promise<ProfileSummary> {
  return requestNetworkJson<ProfileSummary>(`/api/v1/network/blocks/${profileId}`, token, {
    method: "POST",
  });
}

export function unblockProfile(token: string, profileId: number): Promise<void> {
  return requestNetworkNoContent(`/api/v1/network/blocks/${profileId}`, token, {
    method: "DELETE",
  });
}

export function listMyBlocks(token: string): Promise<ProfileSummary[]> {
  return requestNetworkJson<ProfileSummary[]>("/api/v1/network/blocks/me", token);
}

export function registerPushToken(
  token: string,
  pushToken: string,
  platform?: PushPlatform,
): Promise<PushTokenRead> {
  return requestNetworkJson<PushTokenRead>("/api/v1/notifications/tokens", token, {
    method: "POST",
    ...jsonRequest(platform ? { token: pushToken, platform } : { token: pushToken }),
  });
}

export function unregisterPushToken(token: string, pushToken: string): Promise<void> {
  return requestNetworkNoContent("/api/v1/notifications/tokens/unregister", token, {
    method: "POST",
    ...jsonRequest({ token: pushToken }),
  });
}

export function listMessageThreads(token: string): Promise<MessageThreadRead[]> {
  return requestNetworkJson<MessageThreadRead[]>("/api/v1/network/messages/threads", token);
}

export function getThreadMessages(
  token: string,
  profileId: number,
  options: { limit?: number; offset?: number } = {},
): Promise<MessageRead[]> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }
  const query = params.toString();
  return requestNetworkJson<MessageRead[]>(
    `/api/v1/network/messages/threads/${profileId}${query ? `?${query}` : ""}`,
    token,
  );
}

export function sendThreadMessage(token: string, profileId: number, body: string): Promise<MessageRead> {
  return requestNetworkJson<MessageRead>(`/api/v1/network/messages/threads/${profileId}`, token, {
    method: "POST",
    ...jsonRequest({ body }),
  });
}

export function getUnreadMessages(token: string): Promise<UnreadMessagesRead> {
  return requestNetworkJson<UnreadMessagesRead>("/api/v1/network/messages/unread", token);
}

export function updateConnectionStatus(
  token: string,
  connectionId: number,
  status: ConnectionRequestDecision,
): Promise<ConnectionRequestRead> {
  return requestNetworkJson<ConnectionRequestRead>(`/api/v1/network/connections/${connectionId}`, token, {
    method: "PATCH",
    ...jsonRequest({ status }),
  });
}

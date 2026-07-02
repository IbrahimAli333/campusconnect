import { API_BASE_URL } from "./config";
import { fetchWithTimeout } from "./request";

export type BackendRole = "admin" | "member" | "staff" | "student" | "teacher";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: BackendRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

interface ApiErrorBody {
  detail?: string | Array<{ msg?: string }>;
}

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
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
    // Fall through to the generic status message below.
  }

  return `Request failed with status ${response.status}`;
}

async function requestJson<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    throw new AuthApiError(
      error instanceof Error ? error.message : "Could not connect to the API",
      0,
    );
  }

  if (!response.ok) {
    throw new AuthApiError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as TResponse;
}

export function login(email: string, password: string): Promise<TokenResponse> {
  const payload: LoginRequest = { email, password };

  return requestJson<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteAccount(token: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/delete-account`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
  } catch (error) {
    throw new AuthApiError(
      error instanceof Error ? error.message : "Could not connect to the API",
      0,
    );
  }

  if (!response.ok) {
    throw new AuthApiError(await getErrorMessage(response), response.status);
  }
}

export function getMe(token: string): Promise<AuthUser> {
  return requestJson<AuthUser>("/api/v1/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

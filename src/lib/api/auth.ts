import type { SignupConsent } from "../legal";
import { API_BASE_URL } from "./config";
import { fetchWithTimeout } from "./request";

export type BackendRole = "admin" | "member" | "staff" | "student" | "teacher";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: BackendRole;
  is_active: boolean;
  terms_version: string | null;
  terms_accepted_at: string | null;
  age_confirmed_at: string | null;
  current_terms_version: string;
  // True until the current Terms/Privacy version is accepted and age is
  // confirmed; the app shows the acceptance screen until then.
  terms_acceptance_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
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

// Public signup always creates a member account; posting roles come from
// university SSO or admin provisioning. The server rejects signups without
// both consent boxes ticked.
export function register(
  email: string,
  password: string,
  fullName: string,
  consent: SignupConsent,
): Promise<TokenResponse> {
  return requestJson<TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, full_name: fullName, ...consent }),
  });
}

export function refreshSession(refreshToken: string): Promise<TokenResponse> {
  return requestJson<TokenResponse>("/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

// Status the backend returns when a Google sign-in would create a new account
// but the consent boxes were not ticked.
export const CONSENT_REQUIRED_STATUS = 428;

export function loginWithGoogle(idToken: string, consent?: SignupConsent): Promise<TokenResponse> {
  return requestJson<TokenResponse>("/api/v1/auth/sso/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // Always send both consent fields: the server treats a request without
    // them as a pre-1.1.0 build and would skip the consent step.
    body: JSON.stringify({ id_token: idToken, accept_terms: false, confirm_age: false, ...consent }),
  });
}

export function acceptTerms(token: string, termsVersion: string): Promise<AuthUser> {
  return requestJson<AuthUser>("/api/v1/auth/accept-terms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ terms_version: termsVersion, accept_terms: true, confirm_age: true }),
  });
}

// "Download my data": everything the backend stores about the signed-in user.
export function exportMyData(token: string): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/v1/auth/me/export", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// SSO accounts have no usable password; they confirm deletion with a fresh
// Google ID token instead.
export type DeleteAccountCredential = { password: string } | { googleIdToken: string };

export async function deleteAccount(token: string, credential: DeleteAccountCredential): Promise<void> {
  const payload =
    "password" in credential
      ? { password: credential.password }
      : { google_id_token: credential.googleIdToken };

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/delete-account`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

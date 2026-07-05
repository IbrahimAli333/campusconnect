import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AuthApiError,
  getMe as requestCurrentUser,
  login as requestLogin,
  loginWithGoogle as requestGoogleLogin,
  refreshSession as requestRefreshSession,
  type AuthUser,
  type TokenResponse,
} from "../api/auth";
import { setUnauthorizedHandler } from "../api/network";
import { clearStoredSession, loadStoredSession, storeSession } from "./token-storage";

// Access tokens live 30 minutes; refreshing well inside that window keeps a
// session alive without a visible logout.
const PROACTIVE_REFRESH_MS = 20 * 60 * 1000;

export interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: (idToken: string) => Promise<AuthUser>;
  refreshCurrentUser: () => Promise<AuthUser | null>;
  logout: () => void;
}

export function useAuthStore(): AuthStore {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const applySession = useCallback((response: TokenResponse) => {
    refreshTokenRef.current = response.refresh_token;
    setToken(response.access_token);
    setUser(response.user);
    void storeSession(response.access_token, response.refresh_token);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await requestLogin(email, password);
      applySession(response);
      return response.user;
    },
    [applySession],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const response = await requestGoogleLogin(idToken);
      applySession(response);
      return response.user;
    },
    [applySession],
  );

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      return null;
    }

    const nextUser = await requestCurrentUser(token);
    setUser(nextUser);
    return nextUser;
  }, [token]);

  const logout = useCallback(() => {
    refreshTokenRef.current = null;
    setToken(null);
    setUser(null);
    void clearStoredSession();
  }, []);

  // Swap the session for a fresh one; on a definitive rejection the session
  // is over, while network failures keep it so a later attempt can succeed.
  const refreshOrLogout = useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    if (!refreshToken) {
      logout();
      return;
    }

    if (!refreshInFlightRef.current) {
      refreshInFlightRef.current = requestRefreshSession(refreshToken)
        .then((response) => {
          applySession(response);
        })
        .catch((error: unknown) => {
          if (error instanceof AuthApiError && error.status !== 0) {
            logout();
          }
        })
        .finally(() => {
          refreshInFlightRef.current = null;
        });
    }
    await refreshInFlightRef.current;
  }, [applySession, logout]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const stored = await loadStoredSession();
        if (!stored) {
          return;
        }

        refreshTokenRef.current = stored.refreshToken;
        if (stored.refreshToken) {
          try {
            const response = await requestRefreshSession(stored.refreshToken);
            if (!cancelled) {
              applySession(response);
            }
            return;
          } catch (error) {
            if (error instanceof AuthApiError && error.status !== 0) {
              refreshTokenRef.current = null;
              void clearStoredSession();
              return;
            }
            // Network failure: fall through and try the stored access token,
            // which may still be valid.
          }
        }

        const currentUser = await requestCurrentUser(stored.accessToken);
        if (!cancelled) {
          setToken(stored.accessToken);
          setUser(currentUser);
        }
      } catch {
        void clearStoredSession();
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // A 401 means the access token expired mid-session: try to refresh before
  // giving up on the session.
  useEffect(() => {
    setUnauthorizedHandler(() => void refreshOrLogout());
    return () => setUnauthorizedHandler(null);
  }, [refreshOrLogout]);

  // Refresh proactively so requests rarely hit an expired token at all.
  useEffect(() => {
    if (!token || !refreshTokenRef.current) {
      return;
    }

    const interval = setInterval(() => void refreshOrLogout(), PROACTIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [token, refreshOrLogout]);

  return useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isRestoring,
      login,
      loginWithGoogle,
      refreshCurrentUser,
      logout,
    }),
    [isRestoring, login, loginWithGoogle, logout, refreshCurrentUser, token, user],
  );
}

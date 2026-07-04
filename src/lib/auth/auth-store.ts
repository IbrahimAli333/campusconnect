import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getMe as requestCurrentUser,
  login as requestLogin,
  loginWithGoogle as requestGoogleLogin,
  type AuthUser,
} from "../api/auth";
import { setUnauthorizedHandler } from "../api/network";
import { clearStoredToken, loadStoredToken, storeToken } from "./token-storage";

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

  const login = useCallback(async (email: string, password: string) => {
    const response = await requestLogin(email, password);
    setToken(response.access_token);
    setUser(response.user);
    void storeToken(response.access_token);
    return response.user;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const response = await requestGoogleLogin(idToken);
    setToken(response.access_token);
    setUser(response.user);
    void storeToken(response.access_token);
    return response.user;
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      return null;
    }

    const nextUser = await requestCurrentUser(token);
    setUser(nextUser);
    return nextUser;
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    void clearStoredToken();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const storedToken = await loadStoredToken();
        if (!storedToken) {
          return;
        }

        const currentUser = await requestCurrentUser(storedToken);
        if (!cancelled) {
          setToken(storedToken);
          setUser(currentUser);
        }
      } catch {
        void clearStoredToken();
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
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

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

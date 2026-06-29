import { useCallback, useMemo, useState } from "react";

import { getMe as requestCurrentUser, login as requestLogin, type AuthUser } from "../api/auth";

export interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  refreshCurrentUser: () => Promise<AuthUser | null>;
  logout: () => void;
}

export function useAuthStore(): AuthStore {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const response = await requestLogin(email, password);
    setToken(response.access_token);
    setUser(response.user);
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
  }, []);

  return useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      refreshCurrentUser,
      logout,
    }),
    [login, logout, refreshCurrentUser, token, user],
  );
}

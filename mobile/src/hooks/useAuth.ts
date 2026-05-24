import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiLogin, apiLogout, apiMe, getCachedUser } from '../api/auth';
import { queryClient } from '../offline/queryClient';
import type { User } from '../api/types';

interface AuthContextValue {
  user:    User | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<User>;
  logout:  () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(getCachedUser);
  const [loading, setLoading] = useState(true);

  // On mount: verify session against server
  useEffect(() => {
    (async () => {
      try {
        const u = await apiMe();
        setUser(u);
      } catch {
        // session invalid — clear user but keep cached data for offline
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    queryClient.clear();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const u = await apiMe();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  const value: AuthContextValue = { user, loading, login, logout, refresh };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

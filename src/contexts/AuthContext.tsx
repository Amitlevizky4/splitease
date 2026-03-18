import { useState, useCallback, useEffect, type ReactNode } from "react";
import type { User } from "@/types";
import { AuthContext } from "./authTypes";
import {
  loginWithGoogle as apiLogin,
  getMe,
  setToken,
  clearToken,
  hasToken,
} from "@/lib/api";

const STORAGE_KEY = "splitease_auth_user";

function loadStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser);
  const [loading, setLoading] = useState(() => hasToken());

  // Verify token on mount
  useEffect(() => {
    if (!hasToken()) {
      return;
    }
    getMe()
      .then(({ user: u }) => {
        const authUser: User = {
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
        };
        setUser(authUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      })
      .catch(() => {
        // Token invalid, clear everything
        clearToken();
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (googleCredential: string, inviteToken?: string) => {
    const { token, user: u } = await apiLogin(googleCredential, inviteToken);
    setToken(token);
    const authUser: User = {
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
    };
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearToken();
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-teal mb-2">SplitEase</h1>
          <p className="text-charcoal-light text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

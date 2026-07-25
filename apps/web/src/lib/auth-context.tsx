'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { API_URL } from './config';

export interface AuthUser {
  sub: string;
  tenantId: string;
  email: string;
  role: 'admin' | 'member';
}

export interface AuthTenant {
  id: string;
  name: string;
  tier: string;
}

interface StoredAuth {
  accessToken: string;
  user: AuthUser;
  tenant: AuthTenant;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  isLoading: boolean;
  login: (email: string, tenantName: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'rag_auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setAuth(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  async function login(email: string, tenantName: string) {
    const res = await fetch(`${API_URL}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tenantName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? 'Login failed');
    }
    const data: StoredAuth = await res.json();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAuth(data);
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token: auth?.accessToken ?? null,
        user: auth?.user ?? null,
        tenant: auth?.tenant ?? null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

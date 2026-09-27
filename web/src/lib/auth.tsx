import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post, refreshSession, setAccessToken } from './api';
import { db } from './offline';
import { queryClient } from './queryClient';
import type { Me } from './types';

type Status = 'loading' | 'guest' | 'authed';

interface AuthState {
  status: Status;
  me: Me | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const ME_KEY = 'cd:me';

function readCachedMe(): Me | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

function writeCachedMe(me: Me | null) {
  try {
    if (me) localStorage.setItem(ME_KEY, JSON.stringify(me));
    else localStorage.removeItem(ME_KEY);
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    const data = await api<Me>('/auth/me');
    setMe(data);
    writeCachedMe(data);
    setStatus('authed');
  }, []);

  // Saat aplikasi dibuka: pulihkan sesi dari cookie refresh. Jika server tak terjangkau
  // (offline), tetap masuk memakai profil tersimpan supaya pencatatan offline bisa jalan.
  useEffect(() => {
    (async () => {
      const cached = readCachedMe();
      const result = await refreshSession();
      if (result === 'ok') {
        try {
          await loadMe();
          return;
        } catch {
          if (cached) {
            setMe(cached);
            setStatus('authed');
            return;
          }
        }
      }
      if (result === 'offline' && cached) {
        setMe(cached);
        setStatus('authed');
        return;
      }
      writeCachedMe(null);
      setStatus('guest');
    })();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await post<{ accessToken: string }>('/auth/login', { email, password });
      setAccessToken(accessToken);
      await loadMe();
    },
    [loadMe],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { accessToken } = await post<{ accessToken: string }>('/auth/register', { name, email, password });
      setAccessToken(accessToken);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    writeCachedMe(null);
    await db.outbox.clear();
    queryClient.clear();
    setMe(null);
    setStatus('guest');
  }, []);

  return (
    <AuthContext.Provider value={{ status, me, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}

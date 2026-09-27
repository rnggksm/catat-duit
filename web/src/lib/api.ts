let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function send(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
}

export type RefreshResult = 'ok' | 'invalid' | 'offline';
let refreshing: Promise<RefreshResult> | null = null;

/**
 * Tukar refresh token (cookie httpOnly) dengan access token baru. Satu permintaan untuk banyak pemanggil.
 * 'offline' = server tidak terjangkau (sesi mungkin masih valid), 'invalid' = harus masuk lagi.
 */
export function refreshSession(): Promise<RefreshResult> {
  if (!refreshing) {
    refreshing = (async (): Promise<RefreshResult> => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (res.status === 401 || res.status === 403) {
          accessToken = null;
          return 'invalid';
        }
        if (!res.ok) return 'offline';
        const body = (await res.json()) as { accessToken: string };
        accessToken = body.accessToken;
        return 'ok';
      } catch {
        return 'offline';
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if ((await refreshSession()) === 'ok') res = await send(path, init);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new ApiError(res.status, msg ?? 'Terjadi kesalahan. Coba lagi.');
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ApiError, api, post, setAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { shortDate } from '../lib/format';
import type { InvitePreview, JoinedHousehold } from '../lib/types';

const STATUS_COPY: Record<'ACCEPTED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN', { title: string; body: string }> = {
  ACCEPTED: {
    title: 'Undangan ini sudah dipakai',
    body: 'Tautan hanya berlaku sekali. Minta tautan baru ke orang yang mengundangmu.',
  },
  REVOKED: {
    title: 'Undangan sudah dibatalkan',
    body: 'Orang yang mengundang mencabut tautan ini. Minta tautan baru bila masih ingin bergabung.',
  },
  EXPIRED: {
    title: 'Undangan sudah kedaluwarsa',
    body: 'Masa berlaku tautan undangan sudah lewat. Minta tautan baru ke orang yang mengundangmu.',
  },
  UNKNOWN: {
    title: 'Undangan tidak ditemukan',
    body: 'Tautan salah ketik atau sudah dihapus. Periksa kembali tautan yang kamu terima.',
  },
};

const inputCls =
  'h-[52px] w-full rounded-2xl border-[1.5px] border-line bg-card px-4 text-[15px] text-ink outline-none focus:border-primary focus:shadow-[0_0_0_4px_var(--color-primary-soft)]';

/**
 * Halaman `/undang/:token`. Dibuka dari tautan WhatsApp, jadi harus jalan tanpa login:
 * penerima melihat siapa yang mengundang, lalu mendaftar (akun baru) atau langsung bergabung
 * (sudah login) dengan email yang diundang.
 */
export function UndangPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { status, me, register, logout, resetAfterHouseholdChange } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<InvitePreview>(`/invites/${token}`),
    retry: false,
    staleTime: 30_000,
  });

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const result = await post<JoinedHousehold>(`/invites/${token}/accept`);
      setAccessToken(result.accessToken);
      await resetAfterHouseholdChange();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Tidak bisa terhubung ke server.');
    } finally {
      setBusy(false);
    }
  }

  async function signUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(name, email, password, token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung ke server.');
    } finally {
      setBusy(false);
    }
  }

  const data = preview.data;
  const dead = data && data.status !== 'PENDING' ? STATUS_COPY[data.status] : null;

  return (
    <main className="relative flex min-h-dvh flex-col gap-5 overflow-hidden px-6 pb-8 pt-12">
      <div aria-hidden className="absolute -right-14 -top-10 h-40 w-40 rounded-full bg-primary-soft" />
      <div className="relative flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-primary text-white">
        <Icon name="users" size={30} />
        <span aria-hidden className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-bg bg-amber" />
      </div>

      {preview.isLoading && <p className="text-[15px] text-muted">Memuat undangan…</p>}

      {preview.isError && !(preview.error instanceof ApiError && preview.error.status === 404) && (
        <section className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] font-extrabold tracking-tight">Tidak bisa memuat undangan</h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Periksa koneksi internet lalu buka tautannya lagi.
          </p>
          <button
            type="button"
            onClick={() => void preview.refetch()}
            className="mt-2 h-[52px] rounded-[18px] border-[1.5px] border-ink text-[15px] font-bold"
          >
            Coba lagi
          </button>
        </section>
      )}

      {preview.isError && preview.error instanceof ApiError && preview.error.status === 404 && (
        <section className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] font-extrabold tracking-tight">{STATUS_COPY.UNKNOWN.title}</h1>
          <p className="text-[15px] leading-relaxed text-muted">{STATUS_COPY.UNKNOWN.body}</p>
        </section>
      )}

      {dead && (
        <section className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] font-extrabold tracking-tight">{dead.title}</h1>
          <p className="text-[15px] leading-relaxed text-muted">{dead.body}</p>
        </section>
      )}

      {data && data.status === 'PENDING' && (
        <>
          <div className="relative flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">Undangan rumah tangga</span>
            <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">
              {data.invitedByName} mengundangmu ke {data.householdName}
            </h1>
            <p className="text-[15px] leading-relaxed text-muted">
              Semua catatan, dompet, dan laporan di rumah tangga itu akan terlihat olehmu — dan catatanmu terlihat
              oleh mereka.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-[18px] border border-line-soft bg-card px-4 py-3">
            <Icon name="card" size={20} className="shrink-0 text-muted" />
            <span className="flex flex-col">
              <span className="text-xs text-muted">Undangan untuk</span>
              <span className="text-[15px] font-semibold">{data.email}</span>
            </span>
          </div>

          {status === 'authed' && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-muted">
                Kamu sedang masuk sebagai <span className="font-semibold text-ink">{me?.user.name}</span>. Tautan ini
                hanya bisa dipakai akun dengan email di atas.
              </p>
              <button
                type="button"
                onClick={join}
                disabled={busy}
                className="h-14 rounded-[18px] bg-primary text-base font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Menggabungkan…' : `Gabung ke ${data.householdName}`}
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="h-[52px] rounded-[18px] border-[1.5px] border-line text-[15px] font-bold"
              >
                Bukan akunku, keluar dulu
              </button>
            </div>
          )}

          {status === 'guest' && (
            <form onSubmit={signUp} className="flex flex-col gap-4" noValidate>
              <p className="text-[13px] text-muted">
                Buat akun dengan email yang diundang, atau masuk dulu bila sudah punya akun.
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nama" className="text-[13px] font-semibold">
                  Nama panggilan
                </label>
                <input
                  id="nama"
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="nickname"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[13px] font-semibold">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sandi" className="text-[13px] font-semibold">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="sandi"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${inputCls} pr-14`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-muted"
                  >
                    <Icon name="eye" size={20} />
                  </button>
                </div>
                <span className="text-xs text-muted">Minimal 8 karakter.</span>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="h-14 rounded-[18px] bg-primary text-base font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Memproses…' : 'Daftar & gabung'}
              </button>
            </form>
          )}

          <p className="text-xs text-muted">Berlaku sampai {shortDate(new Date(data.expiresAt))}.</p>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDE6E4] px-4 py-3 text-sm font-semibold text-[#B42E27]">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {status === 'guest' && (
          <Link to="/masuk" className="text-center text-[13px] font-semibold text-primary underline">
            Sudah punya akun? Masuk dulu
          </Link>
        )}
        <Link to={status === 'authed' ? '/' : '/masuk'} className="text-center text-[13px] text-muted underline">
          {status === 'authed' ? 'Kembali ke beranda' : 'Nanti saja'}
        </Link>
      </div>
    </main>
  );
}

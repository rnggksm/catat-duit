import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

type Mode = 'masuk' | 'daftar';

export function MasukPage() {
  const { status, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('masuk');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authed') return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'masuk') await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung ke server.');
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'h-[52px] w-full rounded-2xl border-[1.5px] border-line bg-card px-4 text-[15px] text-ink outline-none focus:border-primary focus:shadow-[0_0_0_4px_var(--color-primary-soft)]';

  return (
    <main className="relative flex min-h-dvh flex-col gap-6 overflow-hidden px-6 pb-7 pt-12">
      <div aria-hidden className="absolute -right-16 -top-12 h-44 w-44 rounded-full bg-primary-soft" />
      <div className="relative flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-primary text-white">
        <Icon name="wallet" size={30} />
        <span aria-hidden className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-bg bg-amber" />
      </div>

      <div className="relative flex flex-col gap-1.5">
        <h1 className="font-display text-[30px] font-extrabold tracking-tight">
          {mode === 'masuk' ? 'Masuk ke Catat Duit' : 'Buat akun baru'}
        </h1>
        <p className="text-[15px] text-muted">Catatan keuanganmu, rapi setiap periode gajian.</p>
      </div>

      <form onSubmit={onSubmit} className="relative flex flex-col gap-4" noValidate>
        {mode === 'daftar' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nama" className="text-[13px] font-semibold">Nama panggilan</label>
            <input id="nama" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" required />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[13px] font-semibold">Email</label>
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
          <label htmlFor="sandi" className="text-[13px] font-semibold">Password</label>
          <div className="relative">
            <input
              id="sandi"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'}
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
          {mode === 'daftar' && <span className="text-xs text-muted">Minimal 8 karakter.</span>}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-[#FDE6E4] px-4 py-3 text-sm font-semibold text-[#B42E27]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-14 rounded-[18px] bg-primary text-base font-bold text-white disabled:opacity-60"
        >
          {busy ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Daftar'}
        </button>
      </form>

      <div className="flex items-center gap-3 text-[13px] text-muted">
        <span className="h-px grow bg-line" />
        atau
        <span className="h-px grow bg-line" />
      </div>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'masuk' ? 'daftar' : 'masuk');
          setError(null);
        }}
        className="h-[54px] rounded-[18px] border-[1.5px] border-ink text-[15px] font-bold"
      >
        {mode === 'masuk' ? 'Buat akun baru' : 'Saya sudah punya akun'}
      </button>

      <p className="mt-auto flex items-center justify-center gap-2 text-center text-xs text-muted">
        <Icon name="lock" size={16} />
        Datamu hanya bisa dilihat olehmu (dan pasangan, bila diundang).
      </p>
    </main>
  );
}

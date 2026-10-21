import { useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { shortDate } from '../lib/format';
import { useCreateInvite } from '../lib/household';
import type { CreatedInvite } from '../lib/types';
import { Icon } from './Icon';

const inputCls =
  'h-[50px] w-full rounded-[14px] border-[1.5px] border-line bg-card px-3.5 text-[15px] text-ink outline-none focus:border-primary';

/**
 * Buat tautan undangan. Tautan hanya ditampilkan sekali — yang disimpan server hanya hash
 * tokennya — jadi di sini disediakan tombol salin dan kirim WhatsApp sebelum sheet ditutup.
 */
export function InviteSheet({ householdName, onClose }: { householdName: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateInvite();

  const canSubmit = email.trim() !== '' && !create.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      setCreated(await create.mutateAsync(email.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa membuat undangan. Periksa koneksi internet.');
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Tidak bisa menyalin otomatis. Tekan lama tautan di bawah untuk menyalin manual.');
    }
  }

  const waHref = created
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hai! Aku pakai Catat Duit untuk mencatat pengeluaran kita. Gabung ke ${householdName} lewat tautan ini:\n${created.url}\n\nTautan berlaku sampai ${shortDate(new Date(created.expiresAt))}.`,
      )}`
    : '';

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col justify-end">
      <button type="button" aria-label="Tutup undangan" onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <section
        role="dialog"
        aria-label="Undang pasangan"
        className="relative flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_32px_rgba(27,24,48,0.2)]"
      >
        <div aria-hidden className="mx-auto h-[5px] w-10 rounded-full bg-[#DDD7CC]" />
        <div className="flex items-center gap-3">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-primary text-white">
            <Icon name="users" />
          </span>
          <div className="flex grow flex-col">
            <h2 className="font-display text-xl font-bold">Undang pasangan</h2>
            <span className="text-xs text-muted">Bergabung ke {householdName}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-11 w-11 items-center justify-center rounded-full bg-chip">
            <Icon name="close" size={20} strokeWidth={2} />
          </button>
        </div>

        {!created ? (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email-undang" className="text-[13px] font-semibold">
                Email pasangan
              </label>
              <input
                id="email-undang"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="nama@email.com"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="text-xs text-muted">
                Tautan hanya bisa dipakai akun dengan email ini, dan berlaku sekali.
              </span>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-[#FDE6E4] px-4 py-3 text-sm font-semibold text-[#B42E27]">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={onClose} className="h-[52px] rounded-2xl border-[1.5px] border-line text-[15px] font-bold">
                Batal
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-[52px] rounded-2xl bg-primary text-[15px] font-bold text-white disabled:bg-line disabled:text-muted"
              >
                {create.isPending ? 'Membuat…' : 'Buat tautan'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-xl bg-[#FDF1D8] px-4 py-3 text-[13px] font-semibold text-[#7A5405]">
              <Icon name="sparkle" size={18} className="mt-0.5 shrink-0" />
              <span>Simpan atau kirim tautan ini sekarang. Demi keamanan, tautan tidak bisa ditampilkan lagi.</span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Tautan untuk {created.email}</span>
              <textarea
                readOnly
                rows={3}
                value={created.url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full resize-none rounded-[14px] border-[1.5px] border-line bg-chip px-3.5 py-3 text-[13px] leading-relaxed text-ink outline-none"
              />
              <span className="text-xs text-muted">
                Berlaku sampai {shortDate(new Date(created.expiresAt))} · sekali pakai
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-[#FDE6E4] px-4 py-3 text-sm font-semibold text-[#B42E27]">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={copy}
                className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-ink text-[15px] font-bold"
              >
                <Icon name={copied ? 'check' : 'note'} size={18} />
                {copied ? 'Tersalin' : 'Salin'}
              </button>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-white"
              >
                <Icon name="arrowUp" size={18} />
                WhatsApp
              </a>
            </div>

            <button type="button" onClick={onClose} className="h-[46px] text-[14px] font-semibold text-muted">
              Selesai
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

import { useState } from 'react';
import { ApiError } from '../lib/api';
import { formatNumber, formatRupiah } from '../lib/format';
import { useSetBudget } from '../lib/queries';
import type { BudgetStatus } from '../lib/types';
import { Icon, iconColor, tint } from './Icon';

/** Warna status selalu disertai label teks, tidak mengandalkan warna saja. */
export const STATUS_STYLE: Record<BudgetStatus, { bar: string; chipBg: string; chipFg: string; label: string }> = {
  ok: { bar: '#1F8A5B', chipBg: '#DFF3EA', chipFg: '#17704A', label: 'Aman' },
  warn: { bar: '#C98A12', chipBg: '#FDF1D8', chipFg: '#7A5405', label: 'Hampir habis' },
  over: { bar: '#C7362F', chipBg: '#FDE6E4', chipFg: '#B42E27', label: 'Lewat anggaran' },
};

/** Progress bar anggaran: batang terisi sampai 100%, sisanya ditulis sebagai teks. */
export function BudgetBar({ pct, status }: { pct: number; status: BudgetStatus }) {
  return (
    <span className="block h-2.5 overflow-hidden rounded-full bg-[#EFEBE4]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span className="block h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.max(2, pct))}%`, background: STATUS_STYLE[status].bar }} />
    </span>
  );
}

export function StatusChip({ status }: { status: BudgetStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: s.chipBg, color: s.chipFg }}>
      {s.label}
    </span>
  );
}

interface SheetProps {
  /** undefined = anggaran total */
  categoryId?: string;
  title: string;
  icon: string;
  color: string;
  current: number | null;
  suggested: number | null;
  spent: number;
  onClose: () => void;
}

/** Lembar pasang/ubah/hapus anggaran. Berlaku mulai periode berjalan dan terbawa ke periode berikutnya. */
export function BudgetSheet({ categoryId, title, icon, color, current, suggested, spent, onClose }: SheetProps) {
  const [raw, setRaw] = useState(current ? String(current) : suggested ? String(suggested) : '');
  const setBudget = useSetBudget();
  const amount = Number(raw.replace(/\D/g, '')) || 0;
  const tooBig = amount > 1_000_000_000;

  async function save(value: number) {
    try {
      await setBudget.mutateAsync({ categoryId, amount: value });
      onClose();
    } catch {
      /* pesan ditampilkan dari state mutation */
    }
  }

  const error = tooBig
    ? 'Nominal maksimal Rp 1.000.000.000.'
    : setBudget.error instanceof ApiError ? setBudget.error.message : setBudget.isError ? 'Tidak bisa menyimpan. Periksa koneksi internet.' : null;

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col justify-end">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <section role="dialog" aria-label={`Anggaran ${title}`} className="relative flex flex-col gap-4 rounded-t-[28px] bg-card px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5">
        <div aria-hidden className="mx-auto h-[5px] w-10 rounded-full bg-[#DDD7CC]" />
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]" style={{ background: tint(color), color: iconColor(color) }}>
            <Icon name={icon} />
          </span>
          <div className="flex grow flex-col">
            <h2 className="font-display text-xl font-bold">Anggaran {title}</h2>
            <span className="text-xs text-muted">Terpakai periode ini {formatRupiah(spent)}</span>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Batas per periode</span>
          <span className="flex h-14 items-center gap-2 rounded-2xl border-[1.5px] border-line px-4 focus-within:border-primary">
            <span className="font-display text-xl font-bold text-muted">Rp</span>
            <input
              inputMode="numeric"
              autoFocus
              value={amount ? formatNumber(amount) : ''}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent font-display text-2xl font-extrabold outline-none"
            />
          </span>
        </label>

        {suggested != null && suggested !== amount && (
          <button
            type="button"
            onClick={() => setRaw(String(suggested))}
            className="flex items-center gap-2 self-start rounded-full bg-primary-soft px-3 py-2 text-[13px] font-semibold text-primary-strong"
          >
            <Icon name="sparkle" size={16} />
            Pakai rata-rata 3 periode: {formatRupiah(suggested)}
          </button>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Berlaku mulai periode ini dan otomatis terbawa ke periode berikutnya. Peringatan muncul di 80% dan 100%.
        </p>

        {error && (
          <p role="alert" className="rounded-xl bg-[#FDE6E4] px-4 py-3 text-sm font-semibold text-[#B42E27]">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={amount <= 0 || tooBig || setBudget.isPending}
            onClick={() => save(amount)}
            className="h-[52px] rounded-2xl bg-primary text-[15px] font-bold text-white disabled:bg-line disabled:text-muted"
          >
            {setBudget.isPending ? 'Menyimpan…' : current ? 'Simpan perubahan' : 'Pasang anggaran'}
          </button>
          {current != null && (
            <button
              type="button"
              disabled={setBudget.isPending}
              onClick={() => save(0)}
              className="h-12 rounded-2xl text-[15px] font-semibold text-[#B42E27]"
            >
              Hapus anggaran
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

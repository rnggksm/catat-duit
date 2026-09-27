import { useState } from 'react';
import { ApiError, post } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import type { Category } from '../lib/types';
import { Icon, tint } from './Icon';

const ICONS = ['car', 'heart', 'gift', 'book', 'bag', 'play', 'users', 'home', 'bolt', 'ticket', 'card', 'cart'];
const COLORS = ['#1E9E8F', '#E8603C', '#3D6FE0', '#8A63F0', '#C98A12', '#D94470', '#2F8FD1', '#5E594F'];

interface Props {
  existing: Category[];
  onClose: () => void;
  onCreated: (category: Category) => void;
}

/** Form kategori baru langsung dari layar input (PRD 5.2). */
export function NewCategorySheet({ existing, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [essential, setEssential] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const key = name.trim().replace(/\s+/g, ' ').toLowerCase();
  const dup = key !== '' && existing.some((c) => c.name.toLowerCase() === key || c.children.some((ch) => ch.name.toLowerCase() === key));
  const canSave = key !== '' && !dup && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const created = await post<Omit<Category, 'children' | 'usage'>>('/categories', {
        name: name.trim(),
        icon,
        color,
        isEssential: essential,
      });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      onCreated({ ...created, children: [], usage: 0 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Tidak bisa menyimpan. Periksa koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col justify-end">
      <button type="button" aria-label="Tutup form kategori" onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <section
        role="dialog"
        aria-label="Kategori baru"
        className="relative flex flex-col gap-4 rounded-t-[28px] bg-card px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_32px_rgba(27,24,48,0.2)]"
      >
        <div aria-hidden className="mx-auto h-[5px] w-10 rounded-full bg-[#DDD7CC]" />
        <div className="flex items-center gap-3">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] text-white" style={{ background: color }}>
            <Icon name={icon} />
          </span>
          <div className="flex grow flex-col">
            <h2 className="font-display text-xl font-bold">Kategori baru</h2>
            <span className="text-xs text-muted">Langsung dipilih untuk catatan ini</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-11 w-11 items-center justify-center rounded-full bg-chip">
            <Icon name="close" size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nama-kategori" className="text-[13px] font-semibold">Nama kategori</label>
          <input
            id="nama-kategori"
            autoFocus
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Parkir, Hewan peliharaan"
            className={`h-[50px] rounded-[14px] border-[1.5px] bg-card px-3.5 text-[15px] outline-none ${dup ? 'border-[#B42E27]' : 'border-line focus:border-primary'}`}
          />
          {dup && (
            <span role="alert" className="text-xs font-semibold text-[#B42E27]">
              Kategori "{name.trim()}" sudah ada. Pilih nama lain.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Ikon</span>
          <div className="grid grid-cols-6 gap-2">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ikon ${i}`}
                aria-pressed={i === icon}
                onClick={() => setIcon(i)}
                className="flex h-12 items-center justify-center rounded-[14px] border-[1.5px]"
                style={
                  i === icon
                    ? { borderColor: color, background: tint(color), color }
                    : { borderColor: 'var(--color-line)', color: '#4F4A5C' }
                }
              >
                <Icon name={i} size={22} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Warna</span>
          <div className="flex flex-wrap gap-3">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Warna ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className="h-11 w-11 rounded-full"
                style={{ background: c, boxShadow: c === color ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : 'none' }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Sifat pengeluaran</span>
          <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-chip p-1">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={essential === v}
                onClick={() => setEssential(v)}
                className={`h-10 rounded-[11px] text-[13px] font-bold ${essential === v ? 'bg-card text-ink' : 'text-[#4F4A5C]'}`}
              >
                {v ? 'Esensial' : 'Non-esensial'}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">Dipakai untuk analisis hemat di laporan.</span>
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
            type="button"
            onClick={save}
            disabled={!canSave}
            className="h-[52px] rounded-2xl bg-primary text-[15px] font-bold text-white disabled:bg-line disabled:text-muted"
          >
            {busy ? 'Menyimpan…' : 'Simpan & pilih'}
          </button>
        </div>
      </section>
    </div>
  );
}

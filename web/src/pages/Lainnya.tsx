import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';
import { useOutbox } from '../lib/offline';
import { useCategories, useWallets } from '../lib/queries';

export function LainnyaPage() {
  const { me, logout } = useAuth();
  const outbox = useOutbox();
  const categories = useCategories();
  const wallets = useWallets();

  function onLogout() {
    if (
      outbox.length > 0 &&
      !window.confirm(`${outbox.length} catatan belum tersinkron dan akan hilang jika keluar sekarang. Tetap keluar?`)
    )
      return;
    void logout();
  }
  const initial = me?.user.name.trim().charAt(0).toUpperCase() ?? '?';

  const rows = [
    { label: 'Periode laporan', value: `Mulai tgl ${me?.household.periodStartDay ?? 25}`, icon: 'list' },
    { label: 'Kategori', value: String(categories.data?.length ?? '–'), icon: 'grid' },
    { label: 'Dompet', value: String(wallets.data?.length ?? '–'), icon: 'wallet' },
    { label: 'Undang pasangan', value: 'Fase 2', icon: 'users' },
  ];

  return (
    <main className="flex flex-col gap-[18px] px-5 pb-32 pt-6">
      <h1 className="font-display text-[28px] font-bold tracking-tight">Lainnya</h1>

      <section className="flex items-center gap-3.5 rounded-[22px] border border-line-soft bg-card p-4">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-amber font-display text-2xl font-extrabold"
        >
          {initial}
        </span>
        <span className="flex grow flex-col">
          <span className="text-base font-bold">{me?.user.name}</span>
          <span className="text-[13px] text-muted">{me?.user.email}</span>
        </span>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
        {[
          { to: '/anggaran', label: 'Anggaran', desc: 'Batas per kategori & peringatan', icon: 'wallet' },
          { to: '/hemat', label: 'Saran hemat', desc: 'Pos yang bisa dihemat', icon: 'piggy' },
        ].map((l, i) => (
          <Link key={l.to} to={l.to} className={`flex min-h-[62px] items-center gap-3 px-4 py-2 text-ink ${i ? 'border-t border-[#F1EDE6]' : ''}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon name={l.icon} size={18} />
            </span>
            <span className="flex grow flex-col">
              <span className="text-[15px] font-semibold">{l.label}</span>
              <span className="text-xs text-muted">{l.desc}</span>
            </span>
            <Icon name="chevronRight" size={18} className="text-[#B3AC9F]" />
          </Link>
        ))}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
        {rows.map((r, i) => (
          <div key={r.label} className={`flex min-h-[58px] items-center gap-3 px-4 py-2 ${i ? 'border-t border-[#F1EDE6]' : ''}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip text-primary">
              <Icon name={r.icon} size={18} />
            </span>
            <span className="grow text-[15px] font-semibold">{r.label}</span>
            <span className="text-[13px] text-muted">{r.value}</span>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={onLogout}
        className="flex h-[52px] items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-line bg-card text-[15px] font-bold"
      >
        <Icon name="logout" size={20} />
        Keluar
      </button>
      <p className="text-center text-xs text-muted">Catat Duit v0.1.0</p>
    </main>
  );
}

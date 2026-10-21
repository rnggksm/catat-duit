import { Link, NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const tabs = [
  { to: '/', label: 'Beranda', icon: 'home', end: true },
  { to: '/riwayat', label: 'Riwayat', icon: 'list' },
  null,
  { to: '/laporan', label: 'Laporan', icon: 'chart' },
  { to: '/lainnya', label: 'Lainnya', icon: 'grid' },
];

export function BottomNav() {
  return (
    // Latar dan garis atas dipasang di pembungkus, bukan di <nav>: padding bawah untuk home
    // indicator ada di sini, jadi kalau latarnya hanya di <nav> area itu menampilkan warna
    // halaman dan bar navigasi terlihat mengambang di atas pita krem.
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-line bg-card pb-[var(--safe-bottom)]">
      <nav aria-label="Navigasi utama" className="grid h-[78px] grid-cols-5 items-start px-1.5 pt-2">
        {tabs.map((t) =>
          t ? (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </NavLink>
          ) : (
            <div key="fab" className="flex justify-center">
              <Link
                to="/tambah"
                aria-label="Catat pengeluaran"
                className="-mt-[34px] flex h-[62px] w-[62px] items-center justify-center rounded-[22px] border-4 border-bg bg-primary text-white shadow-[0_10px_24px_rgba(91,63,214,0.35)]"
              >
                <Icon name="plus" size={28} strokeWidth={2.4} />
              </Link>
            </div>
          ),
        )}
      </nav>
    </div>
  );
}

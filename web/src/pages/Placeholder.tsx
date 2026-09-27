import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

/** Layar yang belum dibangun di Tahap 1. */
export function PlaceholderPage({ title, stage, desc }: { title: string; stage: string; desc: string }) {
  return (
    <main className="flex flex-col gap-5 px-5 pb-32 pt-6">
      <h1 className="font-display text-[28px] font-bold tracking-tight">{title}</h1>
      <section className="flex flex-col items-center gap-3 rounded-[28px] border border-line-soft bg-card px-6 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary-soft text-primary">
          <Icon name="sparkle" />
        </span>
        <span className="rounded-full bg-[#FDF1D8] px-3 py-1 text-xs font-bold text-[#7A5405]">{stage}</span>
        <p className="text-sm leading-relaxed text-muted">{desc}</p>
        <Link to="/" className="mt-2 text-sm font-semibold text-primary">
          Kembali ke beranda
        </Link>
      </section>
    </main>
  );
}

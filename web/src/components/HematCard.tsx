import { Link } from 'react-router-dom';
import { formatRupiah } from '../lib/format';
import { useInsights } from '../lib/queries';
import { Icon } from './Icon';

/** Kartu ringkas potensi hemat yang membuka halaman Saran hemat. Tidak tampil bila tak ada saran. */
export function HematCard({ offset = 0 }: { offset?: number }) {
  const insights = useInsights(offset);
  const d = insights.data;
  const count = d?.insights.filter((i) => i.status !== 'DISMISSED').length ?? 0;
  if (!d || count === 0) return null;
  return (
    <Link
      to={`/hemat${offset ? `?periode=${offset}` : ''}`}
      className="flex items-center gap-3 rounded-[22px] border border-[#BFE6D3] bg-[#EAF7F0] p-4 text-ink"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-save text-white">
        <Icon name="piggy" size={22} />
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[13px] text-[#2E5B45]">Potensi hemat periode {d.period.name}</span>
        <span className="font-display text-lg font-bold">
          {formatRupiah(d.totalSaving)} · {count} saran
        </span>
      </span>
      <Icon name="chevronRight" size={18} className="shrink-0 text-[#2E5B45]" />
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { dayKey, formatNumber, formatTime, shortDate } from '../lib/format';
import type { Transaction } from '../lib/types';
import { Icon, iconColor, tint } from './Icon';

/** Satu baris transaksi (riwayat & beranda). */
/** `showDate`: tampilkan tanggal (untuk daftar yang tidak dikelompokkan per hari). Hari ini cukup jam saja. */
export function TxRow({
  tx,
  showTime = true,
  showDate = false,
  bordered = true,
}: {
  tx: Transaction;
  showTime?: boolean;
  showDate?: boolean;
  bordered?: boolean;
}) {
  const root = tx.category.parent ?? tx.category;
  const when = new Date(tx.occurredAt);
  const isToday = dayKey(when) === dayKey(new Date());
  const dateLabel = showDate && !isToday ? `${shortDate(when)}${showTime ? `, ${formatTime(when)}` : ''}` : showTime ? formatTime(when) : '';
  return (
    <Link
      to={`/transaksi/${tx.id}`}
      className={`flex items-center gap-3 py-3 text-ink ${bordered ? 'border-t border-[#F1EDE6] first:border-t-0' : ''}`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
        style={{ background: tint(root.color), color: iconColor(root.color) }}
      >
        <Icon name={root.icon} size={22} />
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{tx.note || tx.category.name}</span>
        {tx.pending ? (
          <span
            className={`self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${
              tx.syncError ? 'bg-[#FDE6E4] text-[#B42E27]' : 'bg-[#FDF1D8] text-[#7A5405]'
            }`}
          >
            {tx.syncError ? `Gagal: ${tx.syncError}` : 'Menunggu sinkron'}
          </span>
        ) : (
          <span className="truncate text-xs text-muted">
            {root.name} · {tx.wallet.name}
            {dateLabel ? ` · ${dateLabel}` : ''}
          </span>
        )}
      </span>
      <span className="whitespace-nowrap font-display text-[15px] font-bold">−Rp {formatNumber(tx.amount)}</span>
    </Link>
  );
}

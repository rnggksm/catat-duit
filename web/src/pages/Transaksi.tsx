import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { db } from '../lib/offline';
import type { Transaction } from '../lib/types';
import { TransactionForm, type TransactionFormInitial } from './TransactionForm';

/** /transaksi/:id — ubah atau hapus transaksi, termasuk yang masih di antrean offline. */
export function TransaksiPage() {
  const { id = '' } = useParams();
  // undefined = masih membaca IndexedDB, null = tidak ada di antrean
  const pending = useLiveQuery(async () => (await db.outbox.get(id)) ?? null, [id]);
  const server = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => api<Transaction>(`/transactions/${id}`),
    enabled: pending === null,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

  let initial: TransactionFormInitial | null = null;
  if (pending && pending.kind === 'upsert' && pending.data) {
    initial = { id, ...pending.data, note: pending.data.note ?? null };
  } else if (server.data) {
    const t = server.data;
    initial = { id: t.id, amount: t.amount, categoryId: t.category.id, walletId: t.wallet.id, occurredAt: t.occurredAt, note: t.note, createdBy: t.createdBy };
  }

  if (initial) return <TransactionForm key={id} initial={initial} />;

  const notFound = pending?.kind === 'delete' || server.isError;
  return (
    <main className="flex min-h-screen-safe flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted">{notFound ? 'Transaksi tidak ditemukan atau sudah dihapus.' : 'Memuat transaksi…'}</p>
      {notFound && (
        <Link to="/riwayat" className="text-sm font-semibold text-primary">
          Kembali ke riwayat
        </Link>
      )}
    </main>
  );
}

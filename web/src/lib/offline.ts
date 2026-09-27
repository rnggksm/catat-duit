import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { api } from './api';
import { queryClient } from './queryClient';
import type { CategoryRef, Transaction, TransactionInput } from './types';

/**
 * Antrean offline (PRD 5.1 & 7.1). Setiap simpan/hapus masuk ke sini dulu, lalu dikirim ke
 * POST /api/sync. ID transaksi dibuat di klien sehingga kirim ulang tidak menimbulkan duplikat.
 */
export interface OutboxOp {
  /** ID transaksi. Satu transaksi hanya punya satu op terakhir di antrean. */
  id: string;
  kind: 'upsert' | 'delete';
  clientUpdatedAt: string;
  data?: TransactionInput;
  /** Info tampilan agar catatan tertunda bisa muncul di riwayat. */
  display?: { category: CategoryRef; walletName: string };
  error?: string;
}

class OfflineDb extends Dexie {
  outbox!: Table<OutboxOp, string>;

  constructor() {
    super('catat-duit');
    this.version(1).stores({ outbox: 'id, clientUpdatedAt' });
  }
}

export const db = new OfflineDb();

export async function queueUpsert(id: string, data: TransactionInput, display: OutboxOp['display']) {
  await db.outbox.put({ id, kind: 'upsert', clientUpdatedAt: new Date().toISOString(), data, display });
  return flushOutbox();
}

export async function queueDelete(id: string) {
  await db.outbox.put({ id, kind: 'delete', clientUpdatedAt: new Date().toISOString() });
  return flushOutbox();
}

let flushing: Promise<void> | null = null;

/** Tunggu sinkron selesai, paling lama `ms`. Offline/lambat → lanjut saja, data tetap aman di antrean. */
export function settle(p: Promise<void>, ms = 2500) {
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
}

/**
 * Kirim antrean ke server. Aman dipanggil berkali-kali (panggilan bersamaan berbagi satu proses).
 *
 * Penanda `flushing` dikosongkan lewat `.finally()` yang dipasang SETELAH promise disimpan. Jangan pindahkan
 * ke `finally` di dalam fungsi async: bila fungsi selesai sebelum `await` pertama (mis. saat offline),
 * `finally` itu berjalan sebelum `flushing` diisi, sehingga `flushing` tertinggal berisi promise yang sudah
 * selesai dan sinkron tidak pernah jalan lagi sampai aplikasi dibuka ulang.
 */
export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve();
  const run = (async () => {
    try {
      const ops = await db.outbox.orderBy('clientUpdatedAt').toArray();
      if (ops.length === 0) return;
      const res = await api<{ results: { id: string; status: 'applied' | 'stale' | 'error'; message?: string }[] }>('/sync', {
        method: 'POST',
        body: JSON.stringify({
          ops: ops.map((o) => ({ kind: o.kind, id: o.id, clientUpdatedAt: o.clientUpdatedAt, data: o.data })),
        }),
      });
      for (const r of res.results) {
        const op = ops.find((o) => o.id === r.id);
        if (!op) continue;
        // Hapus dari antrean hanya jika op yang terkirim masih yang terbaru.
        const latest = await db.outbox.get(r.id);
        if (latest && latest.clientUpdatedAt !== op.clientUpdatedAt) continue;
        if (r.status === 'error') await db.outbox.update(r.id, { error: r.message ?? 'Gagal disimpan' });
        else await db.outbox.delete(r.id);
      }
      // Muat ulang data di latar belakang; tidak ditunggu agar antrean tidak tertahan oleh refetch yang lambat.
      for (const key of ['summary', 'transactions', 'transaction', 'reports', 'insights', 'budgets']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    } catch {
      // Jaringan putus / server mati: biarkan di antrean, coba lagi nanti.
    }
  })();
  flushing = run;
  void run.finally(() => {
    if (flushing === run) flushing = null;
  });
  return run;
}

/** Mulai sinkron otomatis: saat online kembali, saat aplikasi dibuka lagi, dan tiap 30 detik. */
export function startAutoSync() {
  const run = () => void flushOutbox();
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(run, 30_000);
  run();
  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}

export function useOutbox(): OutboxOp[] {
  return useLiveQuery(() => db.outbox.toArray(), [], []) ?? [];
}

/** Ubah op tertunda menjadi baris transaksi untuk ditampilkan. */
export function pendingTransactions(ops: OutboxOp[], meName: string): Transaction[] {
  return ops
    .filter((o): o is OutboxOp & { data: TransactionInput; display: NonNullable<OutboxOp['display']> } =>
      o.kind === 'upsert' && !!o.data && !!o.display,
    )
    .map((o) => ({
      id: o.id,
      amount: o.data.amount,
      occurredAt: o.data.occurredAt,
      note: o.data.note ?? null,
      category: o.display.category,
      wallet: { id: o.data.walletId, name: o.display.walletName },
      createdBy: { id: '', name: meName },
      pending: true,
      syncError: o.error,
    }));
}

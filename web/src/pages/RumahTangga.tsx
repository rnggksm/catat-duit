import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { InviteSheet } from '../components/InviteSheet';
import { useAuth } from '../lib/auth';
import { shortDate } from '../lib/format';
import { useInvites, useMembers, useSwitchHousehold } from '../lib/household';
import { useOutbox } from '../lib/offline';
import type { InviteStatus, MemberRole } from '../lib/types';

const ROLE_LABEL: Record<MemberRole, string> = { OWNER: 'Pemilik', MEMBER: 'Anggota' };

const STATUS_LABEL: Record<InviteStatus, { text: string; className: string }> = {
  PENDING: { text: 'Menunggu', className: 'bg-[#FDF1D8] text-[#7A5405]' },
  ACCEPTED: { text: 'Sudah gabung', className: 'bg-[#E3F5EC] text-[#1F7A52]' },
  REVOKED: { text: 'Dibatalkan', className: 'bg-chip text-muted' },
  EXPIRED: { text: 'Kedaluwarsa', className: 'bg-chip text-muted' },
};

/** Rumah tangga: siapa saja anggotanya, undangan yang masih berjalan, dan pindah rumah tangga. */
export function RumahTanggaPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const members = useMembers();
  const isOwner = me?.households.find((h) => h.id === me.household.id)?.role === 'OWNER';
  const invites = useInvites(isOwner);
  const outbox = useOutbox();
  const switchHousehold = useSwitchHousehold();
  const [inviting, setInviting] = useState(false);

  const pending = invites.data?.filter((i) => i.status === 'PENDING') ?? [];
  const history = invites.data?.filter((i) => i.status !== 'PENDING') ?? [];
  const others = me?.households.filter((h) => h.id !== me.household.id) ?? [];

  function move(householdId: string, name: string) {
    if (outbox.length > 0 && !window.confirm(`${outbox.length} catatan belum tersinkron akan dibuang jika pindah sekarang. Tetap pindah ke ${name}?`)) {
      return;
    }
    switchHousehold.mutate(householdId, { onSuccess: () => navigate('/', { replace: true }) });
  }

  return (
    <main className="flex flex-col gap-[18px] px-5 pb-32 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/lainnya" aria-label="Kembali" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink">
          <Icon name="chevronLeft" size={20} strokeWidth={2} />
        </Link>
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-bold">Rumah tangga</h1>
          <span className="text-xs text-muted">{me?.household.name}</span>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold">Anggota ({members.data?.length ?? '…'})</h2>
        <div className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
          {members.isLoading && <p className="px-5 py-5 text-sm text-muted">Memuat anggota…</p>}
          {members.isError && (
            <p role="alert" className="px-5 py-5 text-sm text-[#8A2A24]">
              Anggota tidak bisa dimuat. Periksa koneksi internet.
            </p>
          )}
          {members.data?.map((m, i) => (
            <div key={m.id} className={`flex min-h-[62px] items-center gap-3 px-4 py-2 ${i ? 'border-t border-[#F1EDE6]' : ''}`}>
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-amber font-display text-base font-extrabold">
                {m.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-semibold">
                  {m.name}
                  {m.id === me?.user.id && <span className="text-muted"> · kamu</span>}
                </span>
                <span className="truncate text-xs text-muted">{m.email}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.role === 'OWNER' ? 'bg-primary-soft text-primary-strong' : 'bg-chip text-muted'}`}>
                {ROLE_LABEL[m.role]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold">Undangan</h2>
          <div className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
            {pending.length === 0 && !invites.isLoading && (
              <p className="px-5 py-5 text-sm leading-relaxed text-muted">
                Belum ada undangan berjalan. Catatan, dompet, dan laporan akan terlihat bersama setelah pasangan
                bergabung.
              </p>
            )}
            {invites.isLoading && <p className="px-5 py-5 text-sm text-muted">Memuat undangan…</p>}
            {pending.map((inv, i) => (
              <div key={inv.id} className={`flex min-h-[62px] items-center gap-3 px-4 py-2 ${i ? 'border-t border-[#F1EDE6]' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-chip text-primary">
                  <Icon name="card" size={18} />
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-semibold">{inv.email}</span>
                  <span className="text-xs text-muted">Berlaku sampai {shortDate(new Date(inv.expiresAt))}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_LABEL[inv.status].className}`}>
                  {STATUS_LABEL[inv.status].text}
                </span>
              </div>
            ))}
            {history.length > 0 && (
              <details className="border-t border-[#F1EDE6] px-4 py-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-muted">
                  Riwayat undangan ({history.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {history.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3">
                      <span className="min-w-0 grow truncate text-[13px]">{inv.email}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_LABEL[inv.status].className}`}>
                        {STATUS_LABEL[inv.status].text}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <button
            type="button"
            onClick={() => setInviting(true)}
            className="flex h-[52px] items-center justify-center gap-2 rounded-[18px] bg-primary text-[15px] font-bold text-white"
          >
            <Icon name="plus" size={20} />
            Undang pasangan
          </button>
        </section>
      )}

      {others.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold">Rumah tangga lain</h2>
          <div className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
            {others.map((h, i) => (
              <button
                key={h.id}
                type="button"
                onClick={() => move(h.id, h.name)}
                disabled={switchHousehold.isPending}
                className={`flex min-h-[62px] w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-60 ${i ? 'border-t border-[#F1EDE6]' : ''}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
                  <Icon name="home" size={18} />
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-semibold">{h.name}</span>
                  <span className="text-xs text-muted">
                    {ROLE_LABEL[h.role]} · pindah ke sini
                  </span>
                </span>
                <Icon name="chevronRight" size={18} className="shrink-0 text-[#B3AC9F]" />
              </button>
            ))}
          </div>
        </section>
      )}

      {switchHousehold.isError && (
        <p role="alert" className="rounded-[18px] bg-[#FDE6E4] px-4 py-3 text-sm text-[#8A2A24]">
          Tidak bisa pindah rumah tangga. Coba lagi.
        </p>
      )}

      {inviting && me && <InviteSheet householdName={me.household.name} onClose={() => setInviting(false)} />}
    </main>
  );
}

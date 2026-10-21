import { useRegisterSW } from 'virtual:pwa-register/react';

/** Notifikasi "Versi baru tersedia" (PRD 7.1). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 z-30 mx-auto flex max-w-[440px] items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
      style={{ top: 'calc(var(--safe-top) + 1rem)' }}
    >
      <span className="grow">Versi baru tersedia.</span>
      <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-11 px-2 text-night-muted">
        Nanti
      </button>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="min-h-11 rounded-xl bg-amber px-3 font-bold text-ink"
      >
        Muat ulang
      </button>
    </div>
  );
}

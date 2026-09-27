import { QueryClient } from '@tanstack/react-query';

/**
 * networkMode 'offlineFirst': permintaan tetap dikirim walau perangkat offline, sehingga service worker
 * (NetworkFirst di vite.config.ts) bisa melayani data terakhir dari cache. Dengan mode bawaan ('online'),
 * React Query menunda semua permintaan saat offline dan halaman tampil kosong / "Rp 0".
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Catat Duit',
        short_name: 'Catat Duit',
        description: 'Catat pengeluaran harian dan lihat laporan per periode gajian.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F3EE',
        theme_color: '#2B2160',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Rute aplikasi harus tetap dilayani index.html oleh service worker supaya tautan
        // undangan (/undang/<token>) yang dibuka dari WhatsApp sampai ke router React walau
        // aplikasi sudah terpasang sebagai PWA. Hanya /api/ yang dikecualikan — jangan
        // menambahkan /undang ke daftar ini, halaman itu justru butuh fallback tersebut.
        navigateFallbackDenylist: [/^\/api\//],
        // Data terakhir (kategori, dompet, ringkasan, riwayat) tetap tampil saat offline.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-get',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    // Mengizinkan akses lewat Caddy (catatduit.localhost) atau tunnel saat tes dari HP.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAuth } from './lib/auth';
import { startAutoSync } from './lib/offline';
import { AnggaranPage } from './pages/Anggaran';
import { BerandaPage } from './pages/Beranda';
import { HematPage } from './pages/Hemat';
import { KategoriLaporanPage } from './pages/KategoriLaporan';
import { LainnyaPage } from './pages/Lainnya';
import { LaporanPage } from './pages/Laporan';
import { MasukPage } from './pages/Masuk';
import { RiwayatPage } from './pages/Riwayat';
import { RumahTanggaPage } from './pages/RumahTangga';
import { TransactionForm } from './pages/TransactionForm';
import { TransaksiPage } from './pages/Transaksi';
import { UndangPage } from './pages/Undang';

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="font-display text-xl font-bold text-muted">Catat Duit</span>
    </div>
  );
}

/** Halaman yang butuh login. Sinkron antrean offline berjalan selama pengguna masuk. */
function RequireAuth() {
  const { status } = useAuth();
  useEffect(() => {
    if (status === 'authed') return startAutoSync();
  }, [status]);
  if (status === 'loading') return <Splash />;
  if (status === 'guest') return <Navigate to="/masuk" replace />;
  return (
    <>
      <OfflineBanner />
      <Outlet />
    </>
  );
}

/** Layar utama dengan navigasi bawah. */
function TabsLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

export function App() {
  const { status } = useAuth();
  return (
    <>
      <UpdatePrompt />
      <Routes>
        <Route path="/masuk" element={status === 'loading' ? <Splash /> : <MasukPage />} />
        {/* Tautan undangan dibuka dari WhatsApp, jadi harus tetap jalan tanpa login. */}
        <Route path="/undang/:token" element={status === 'loading' ? <Splash /> : <UndangPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/tambah" element={<TransactionForm />} />
          <Route path="/transaksi/:id" element={<TransaksiPage />} />
          <Route element={<TabsLayout />}>
            <Route index element={<BerandaPage />} />
            <Route path="/riwayat" element={<RiwayatPage />} />
            <Route path="/laporan" element={<LaporanPage />} />
            <Route path="/laporan/kategori/:id" element={<KategoriLaporanPage />} />
            <Route path="/hemat" element={<HematPage />} />
            <Route path="/anggaran" element={<AnggaranPage />} />
            <Route path="/rumah-tangga" element={<RumahTanggaPage />} />
            <Route path="/lainnya" element={<LainnyaPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

/**
 * Transaksi "besar" (≥ Rp 500.000) seperti bayar kos, cicilan, atau tagihan tahunan biasanya terjadi sekali
 * per periode. Kalau ikut dihitung sebagai laju harian, proyeksi dan pola harian jadi menyesatkan
 * (mis. "Rabu paling boros" hanya karena kos dibayar hari Rabu). Transaksi ini tetap masuk total & laporan.
 */
export const LARGE_TX_MIN = 500_000;

# Catat Duit

Pencatat pengeluaran harian untuk rumah tangga, dengan periode gajian yang bisa dimulai di
tanggal berapa pun (default 25). Satu rumah tangga bisa dipakai berdua: pasangan bergabung lewat
tautan undangan dan langsung melihat catatan, dompet, anggaran, serta laporan yang sama.

Aplikasi web (PWA, bisa dipasang di HP dan dipakai offline) + API NestJS + PostgreSQL.

## Fitur

- Catat pengeluaran dengan kategori, dompet, catatan, dan waktu; antrean offline dengan
  pengiriman ulang otomatis saat jaringan kembali.
- Laporan per periode gajian: total, rata-rata per hari, proyeksi akhir periode, tren,
  kategori terbesar, dan perbandingan dengan periode sebelumnya.
- Anggaran opsional per kategori atau total periode, dengan peringatan saat mendekati batas.
- Saran hemat yang dihitung dari riwayat (aturan di `api/src/insights/rules.ts`).
- **Undang pasangan**: tautan sekali pakai, terikat email, berlaku 7 hari; anggota yang
  dikeluarkan kehilangan akses seketika tanpa kehilangan catatan yang pernah dibuatnya.

## Menjalankan

```bash
cp .env.example .env          # lalu isi JWT_ACCESS_SECRET dengan string acak
docker compose up -d
docker compose exec api npm run seed   # opsional: akun demo + data contoh
```

| Layanan | Alamat |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000/api |
| HTTPS lokal (untuk uji PWA/service worker) | https://catatduit.localhost:8443 |
| Adminer | port sesuai `docker-compose.yml` |

Migrasi Prisma dijalankan otomatis saat kontainer `api` start (lihat `dev:docker` di
`api/package.json`). Seed tidak otomatis — jalankan manual bila perlu.

Data Postgres disimpan di named volume `pgdata`, jadi aman melewati `docker compose down`.
Hanya `down -v` (atau `volume rm`) yang menghapusnya.

## Konfigurasi

Semua variabel ada di `.env.example`. Yang perlu diperhatikan:

| Variabel | Arti |
| --- | --- |
| `JWT_ACCESS_SECRET` | Wajib diganti. `openssl rand -hex 32`. |
| `ACCESS_TOKEN_TTL` | Umur access token, default `15m`. |
| `REFRESH_TOKEN_DAYS` | Umur refresh token (cookie httpOnly), default `30`. |
| `APP_BASE_URL` | Dasar tautan undangan. Set ke alamat yang bisa dibuka pasangan, bukan `localhost`. |
| `INVITE_TTL_DAYS` | Masa berlaku tautan undangan, default `7`. |
| `COOKIE_SECURE` | `true` bila diakses lewat HTTPS. |

## Perintah

```bash
# API
docker compose exec api npm run typecheck
docker compose exec api npm run build
docker compose exec api npm run migrate      # prisma migrate dev (membuat migrasi baru)
docker compose exec api npm run test:e2e     # uji end-to-end undangan (lihat di bawah)

# Web
docker compose exec web npm run typecheck
docker compose exec web npm run build
```

## Alur undangan pasangan

1. Pemilik rumah tangga membuka **Lainnya → Rumah tangga → Undang pasangan**, mengisi email
   pasangan, lalu membagikan tautan `/undang/<token>` (tombol salin atau WhatsApp).
2. Token disimpan server hanya sebagai hash SHA-256, jadi **tautan tidak bisa ditampilkan
   ulang** — kalau hilang, buat undangan baru (undangan lama otomatis dicabut).
3. Penerima membuka tautan:
   - **belum punya akun** → mendaftar dengan email yang diundang; akun langsung bergabung ke
     rumah tangga pengundang dan tidak membuat rumah tangga sendiri;
   - **sudah punya akun** → menekan "Gabung"; ia menjadi anggota dan rumah tangga aktifnya
     pindah ke sana, sementara rumah tangga lamanya tetap utuh dan bisa dipilih lagi.
4. Setelah bergabung, access token diganti (`hid` di dalam token menentukan data mana yang
   dibaca), antrean offline lama dibuang, dan cache query dikosongkan.

Endpoint terkait:

| Metode | Path | Akses |
| --- | --- | --- |
| `GET` | `/api/invites/:token` | publik, isi minimal (nama rumah tangga, pengundang, email tersamar, status) |
| `POST` | `/api/invites/:token/accept` | login, email harus cocok |
| `POST` | `/api/household/invites` | OWNER |
| `GET` | `/api/household/invites` | OWNER |
| `DELETE` | `/api/household/invites/:id` | OWNER |
| `GET` | `/api/household/members` | semua anggota |
| `DELETE` | `/api/household/members/:userId` | OWNER |
| `POST` | `/api/household/switch` | semua anggota |

## Model data singkat

- **Semua tabel transaksi bergantung pada `householdId`.** Tidak ada data per-user; berbagi
  data berarti berbagi rumah tangga. Ini yang membuat fitur undangan murah.
- **`transactions.createdById`** menyimpan siapa yang mengetik catatan, terisi dari token —
  bukan dari input form. Edit tidak mengubahnya.
- **`users.active_household_id`** menyimpan rumah tangga aktif. Login/refresh tidak menebak
  dari urutan keanggotaan, karena satu user bisa menjadi anggota beberapa rumah tangga.
- **Status undangan diturunkan** dari `accepted_at`, `revoked_at`, `expires_at` — tidak ada
  kolom status, jadi tidak ada dua sumber kebenaran.

## Migrasi

```bash
# setelah mengubah prisma/schema.prisma
docker compose exec api npm run migrate
```

Jalankan `migrate deploy` di mesin/CI yang tidak boleh membuat migrasi baru.

Satu jebakan: **partial unique index tidak bisa dinyatakan di schema Prisma**. Index
`... WHERE accepted_at IS NULL` akan terbaca sebagai drift dan memicu `DROP INDEX` pada
`migrate dev` berikutnya. Karena itu aturan "satu undangan aktif per (household, email)"
ditegakkan di `InvitesService.create` (cabut yang lama lalu buat baru dalam satu transaksi).

## Pengujian

Repo ini belum memakai framework test. Yang ada adalah satu skrip E2E yang memukul API nyata:

```bash
docker compose exec -T api npm run test:e2e
```

Skrip itu membuat akun sendiri (domain `@e2e.test`), memeriksa 58 hal — alur dua akun, kasus
negatif undangan, dan proteksi penghapusan anggota — lalu **menghapus semua data ujinya** di
blok `finally`. Aman dijalankan berulang; keluar dengan kode 1 bila ada yang gagal.

## Batasan yang diketahui

- **Belum ada pengiriman email.** Tautan dibagikan manual (salin/WhatsApp) karena stack ini
  tidak punya penyedia email.
- **Pencabutan akses punya batas waktu.** Access token berumur 15 menit; route di luar modul
  household masih menerima token itu sampai kedaluwarsa. Refresh token langsung dicabut, jadi
  akses tidak bisa diperpanjang.
- **Rate limit disimpan di memori** per proses (10 undangan/jam per user, 20 pratinjau/menit).
  Cukup untuk satu instance di belakang Caddy; perlu Redis kalau nanti dijalankan multi-replika.
- **Belum ada privasi per dompet.** Anggota rumah tangga melihat semua catatan. Kolom
  `Wallet.isShared` dan `ownerUserId` sudah ada di schema tapi belum dipakai.
- **Belum ada fitur keluar rumah tangga.** Yang tersedia baru "dikeluarkan oleh pemilik";
  `DELETE /household/members/:userId` menolak permintaan terhadap diri sendiri.

## Struktur

```
api/            NestJS + Prisma
  src/auth/       register/login/refresh, AuthGuard, RolesGuard
  src/household/  undangan, anggota, pindah rumah tangga
  src/common/     rate limit, default kategori/dompet, periode
  prisma/         schema + migrasi
  test/           skrip E2E undangan
web/            React + Vite (PWA)
  src/pages/      layar (Beranda, Riwayat, Laporan, Anggaran, RumahTangga, Undang, ...)
  src/lib/        api client, auth context, query hooks, antrean offline (Dexie)
  src/components/ komponen bersama (sheet, grafik, baris transaksi)
```

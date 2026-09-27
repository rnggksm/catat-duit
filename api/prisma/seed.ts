/**
 * Seed data development: akun demo + 3 periode transaksi contoh + periode berjalan.
 * Jalankan: npm run seed   (atau: docker compose exec api npm run seed)
 */
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHouseholdWithDefaults } from '../src/common/household-defaults';

const prisma = new PrismaClient();

// PRNG deterministik supaya data contoh sama di setiap mesin.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Pattern = {
  category: string;
  notes: string[];
  min: number;
  max: number;
  perDay: number; // peluang muncul per hari (boleh > 1 untuk beberapa kali)
  wallet: string;
};

const PATTERNS: Pattern[] = [
  { category: 'Makan siang', notes: ['Makan siang warteg', 'Ayam geprek', 'Nasi padang', 'Soto ayam'], min: 18000, max: 35000, perDay: 0.85, wallet: 'Tunai' },
  { category: 'Makan malam', notes: ['Makan malam', 'Pecel lele', 'Mie ayam', 'Sate'], min: 20000, max: 60000, perDay: 0.5, wallet: 'Tunai' },
  { category: 'Kopi', notes: ['Kopi susu', 'Es kopi gula aren'], min: 18000, max: 28000, perDay: 0.35, wallet: 'e-Wallet' },
  { category: 'Jajan', notes: ['Martabak manis', 'Gorengan', 'Es teh'], min: 5000, max: 45000, perDay: 0.2, wallet: 'Tunai' },
  { category: 'Transportasi', notes: ['Ojek online ke stasiun', 'KRL', 'Parkir kantor', 'Tol'], min: 5000, max: 30000, perDay: 0.8, wallet: 'e-Wallet' },
  { category: 'Bensin', notes: ['Bensin Pertalite', 'Bensin Pertamax'], min: 40000, max: 70000, perDay: 0.25, wallet: 'e-Wallet' },
  { category: 'Belanja Harian', notes: ['Belanja minimarket', 'Galon', 'Sabun & sampo'], min: 20000, max: 190000, perDay: 0.3, wallet: 'Rekening Bank' },
  { category: 'Hiburan', notes: ['Nonton bioskop', 'Nongkrong kafe'], min: 50000, max: 120000, perDay: 0.12, wallet: 'e-Wallet' },
  { category: 'Laundry', notes: ['Laundry kiloan'], min: 30000, max: 45000, perDay: 0.15, wallet: 'Tunai' },
  { category: 'Lainnya', notes: ['Ongkir', 'Biaya admin', 'Fotokopi'], min: 3000, max: 40000, perDay: 0.4, wallet: 'e-Wallet' },
];

const MONTHLY: { category: string; note: string; amount: number; day: number; wallet: string }[] = [
  { category: 'Tempat Tinggal', note: 'Bayar kos', amount: 1800000, day: 26, wallet: 'Rekening Bank' },
  { category: 'Tagihan', note: 'Internet rumah', amount: 330000, day: 27, wallet: 'Rekening Bank' },
  { category: 'Tagihan', note: 'Paket data', amount: 100000, day: 28, wallet: 'e-Wallet' },
  { category: 'Langganan', note: 'Streaming film', amount: 65000, day: 1, wallet: 'e-Wallet' },
];

function jakarta(y: number, m: number, d: number, h: number, min: number) {
  // Asia/Jakarta = UTC+7, tanpa daylight saving.
  return new Date(Date.UTC(y, m, d, h - 7, min));
}

async function main() {
  const email = process.env.SEED_DEMO_EMAIL ?? 'demo@catatduit.test';
  const password = process.env.SEED_DEMO_PASSWORD ?? 'demo12345';
  const name = process.env.SEED_DEMO_NAME ?? 'Demo';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Akun demo ${email} sudah ada, seed dilewati.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { user, household } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, passwordHash, name } });
    const household = await createHouseholdWithDefaults(tx, { userId: user.id, name: `Rumah ${name}` });
    return { user, household };
  }, { timeout: 30000 });

  const categories = await prisma.category.findMany({ where: { householdId: household.id, type: 'EXPENSE' } });
  const wallets = await prisma.wallet.findMany({ where: { householdId: household.id } });
  const catId = (n: string) => {
    const c = categories.find((x) => x.name === n);
    if (!c) throw new Error(`Kategori ${n} tidak ditemukan`);
    return c.id;
  };
  const walletId = (n: string) => {
    const w = wallets.find((x) => x.name === n);
    if (!w) throw new Error(`Dompet ${n} tidak ditemukan`);
    return w.id;
  };

  const rand = rng(20260925);
  const now = new Date();
  // Mulai dari 3 periode lalu (tanggal 25) sampai hari ini.
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 25));
  const rows: Prisma.TransactionCreateManyInput[] = [];

  for (let d = new Date(start); d <= now; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const weekend = [0, 6].includes(d.getUTCDay());

    for (const p of PATTERNS) {
      let chance = p.perDay * (weekend && ['Hiburan', 'Makan malam', 'Jajan'].includes(p.category) ? 1.8 : 1);
      while (chance > 0) {
        if (rand() < Math.min(chance, 1)) {
          const amount = Math.round((p.min + rand() * (p.max - p.min)) / 1000) * 1000;
          const at = jakarta(y, m, day, 7 + Math.floor(rand() * 14), Math.floor(rand() * 60));
          if (at <= now) {
            rows.push({
              householdId: household.id,
              walletId: walletId(p.wallet),
              categoryId: catId(p.category),
              createdById: user.id,
              amount: BigInt(amount),
              occurredAt: at,
              note: p.notes[Math.floor(rand() * p.notes.length)],
            });
          }
        }
        chance -= 1;
      }
    }

    for (const t of MONTHLY) {
      if (t.day === day) {
        const at = jakarta(y, m, day, 9, 0);
        if (at <= now) {
          rows.push({
            householdId: household.id,
            walletId: walletId(t.wallet),
            categoryId: catId(t.category),
            createdById: user.id,
            amount: BigInt(t.amount),
            occurredAt: at,
            note: t.note,
          });
        }
      }
    }
  }

  await prisma.transaction.createMany({ data: rows });
  console.log(`Seed selesai: akun ${email}, ${rows.length} transaksi contoh.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

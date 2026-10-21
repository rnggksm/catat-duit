/**
 * Uji end-to-end fitur undangan pasangan (poin 23-25 backlog).
 *
 * Dijalankan DI DALAM kontainer API, karena memakai PrismaClient yang sudah terpasang di sana
 * untuk memeriksa keadaan DB dan membersihkan data uji:
 *
 *   docker compose exec -T api npm run test:e2e
 *
 * Tanpa dependensi baru: hanya fetch bawaan Node 22 dan Prisma yang sudah ada. Semua akun uji
 * memakai domain @e2e.test dan dihapus lagi di blok `finally`, jadi aman diulang berkali-kali.
 *
 * Cakupan:
 *   23. alur dua akun: transaksi pemilik terlihat oleh pasangan yang bergabung
 *   24. kasus negatif undangan: sudah dipakai, email tidak cocok, dicabut, kedaluwarsa,
 *       token tidak dikenal, token salah bentuk
 *   25. proteksi penghapusan: pemilik terakhir tidak bisa keluar, anggota dengan transaksi
 *       bisa dikeluarkan tanpa kehilangan riwayat, dan sesinya langsung diputus
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000/api';
const PASSWORD = 'rahasia123';
const TS = Date.now().toString(36);
const email = (role) => `e2e-${role}-${TS}@e2e.test`;

const prisma = new PrismaClient();
let passed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(label);
    console.log(`  GAGAL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method, path, { body, token, expect } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (expect !== undefined) {
    const allowed = Array.isArray(expect) ? expect : [expect];
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    check(`${method} ${path} → ${res.status}`, allowed.includes(res.status), message);
  }
  return { status: res.status, body: payload };
}

const section = (title) => console.log(`\n${title}`);

async function run() {
  section('23 · Alur dua akun');

  // Pemilik: akun biasa, punya rumah tangga sendiri.
  const owner = await call('POST', '/auth/register', {
    body: { name: 'Pemilik E2E', email: email('owner'), password: PASSWORD },
    expect: 201,
  });
  const ownerToken = owner.body?.accessToken;
  const meOwner = await call('GET', '/auth/me', { token: ownerToken, expect: 200 });
  const ownerHousehold = meOwner.body?.household?.id;
  const ownerId = meOwner.body?.user?.id;
  check('pemilik punya tepat 1 rumah tangga', meOwner.body?.households?.length === 1);

  // Satu transaksi supaya ada data yang bisa dibagi.
  const categories = await call('GET', '/categories?type=EXPENSE', { token: ownerToken, expect: 200 });
  const wallets = await call('GET', '/wallets', { token: ownerToken, expect: 200 });
  const categoryId = categories.body?.[0]?.id;
  const walletId = wallets.body?.[0]?.id;
  const occurredAt = new Date().toISOString();

  await call('POST', '/transactions', {
    token: ownerToken,
    body: { amount: 25000, categoryId, walletId, occurredAt, note: 'E2E kopi pemilik' },
    expect: 201,
  });

  // Pasangan: akun yang sudah ada, rumah tangga sendiri.
  const partnerEmail = email('partner');
  const partner = await call('POST', '/auth/register', {
    body: { name: 'Pasangan E2E', email: partnerEmail, password: PASSWORD },
    expect: 201,
  });
  const partnerToken = partner.body?.accessToken;
  const before = await call('GET', '/transactions?limit=1', { token: partnerToken, expect: 200 });
  check('sebelum gabung pasangan melihat 0 transaksi', before.body?.count === 0);

  // Undang lalu gabung.
  const invite = await call('POST', '/household/invites', {
    token: ownerToken,
    body: { email: partnerEmail },
    expect: 201,
  });
  const token = invite.body?.url?.split('/').pop();

  const preview = await call('GET', `/invites/${token}`, { expect: 200 });
  check('pratinjau publik berstatus PENDING', preview.body?.status === 'PENDING');
  check('pratinjau menyamarkan email', /^\w{1,2}\*+@/.test(preview.body?.email ?? ''), preview.body?.email);

  const accepted = await call('POST', `/invites/${token}/accept`, { token: partnerToken, expect: 201 });
  check('pasangan bergabung ke rumah tangga pemilik', accepted.body?.householdId === ownerHousehold);
  const partnerToken2 = accepted.body?.accessToken;

  const after = await call('GET', '/transactions?limit=1', { token: partnerToken2, expect: 200 });
  check('transaksi pemilik terlihat oleh pasangan', (after.body?.count ?? 0) >= 1, `count=${after.body?.count}`);

  const mePartner = await call('GET', '/auth/me', { token: partnerToken2, expect: 200 });
  check('pasangan punya 2 keanggotaan', mePartner.body?.households?.length === 2);
  check('rumah tangga aktif pasangan = rumah pemilik', mePartner.body?.household?.id === ownerHousehold);
  const partnerId = mePartner.body?.user?.id;

  const members = await call('GET', '/household/members', { token: partnerToken2, expect: 200 });
  check('anggota terbaca 2 orang oleh pasangan', members.body?.length === 2);

  // Jalur akun baru: daftar langsung dengan token undangan.
  const freshEmail = email('fresh');
  const inviteFresh = await call('POST', '/household/invites', {
    token: ownerToken,
    body: { email: freshEmail },
    expect: 201,
  });
  const freshTokenParam = inviteFresh.body?.url?.split('/').pop();
  const fresh = await call('POST', '/auth/register', {
    body: { name: 'Baru E2E', email: freshEmail, password: PASSWORD, inviteToken: freshTokenParam },
    expect: 201,
  });
  const meFresh = await call('GET', '/auth/me', { token: fresh.body?.accessToken, expect: 200 });
  check('akun baru lewat tautan hanya punya 1 keanggotaan', meFresh.body?.households?.length === 1);
  check('akun baru langsung di rumah tangga pemilik', meFresh.body?.household?.id === ownerHousehold);

  section('24 · Kasus negatif undangan');

  await call('POST', `/invites/${token}/accept`, { token: partnerToken2, expect: 400 });

  const inviteOther = await call('POST', '/household/invites', {
    token: ownerToken,
    body: { email: email('lain') },
    expect: 201,
  });
  await call('POST', `/invites/${inviteOther.body?.url?.split('/').pop()}/accept`, {
    token: partnerToken2,
    expect: 400, // email tidak cocok
  });

  const inviteRevoked = await call('POST', '/household/invites', {
    token: ownerToken,
    body: { email: email('dicabut') },
    expect: 201,
  });
  const revokedToken = inviteRevoked.body?.url?.split('/').pop();
  await call('DELETE', `/household/invites/${inviteRevoked.body?.id}`, { token: ownerToken, expect: 200 });
  await call('POST', `/invites/${revokedToken}/accept`, { token: partnerToken2, expect: 400 });

  // Kedaluwarsa: waktu tidak bisa ditunggu, jadi kolomnya digeser langsung lewat Prisma.
  const inviteExpiring = await call('POST', '/household/invites', {
    token: ownerToken,
    body: { email: email('kedaluwarsa') },
    expect: 201,
  });
  const expiredToken = inviteExpiring.body?.url?.split('/').pop();
  await prisma.householdInvite.update({
    where: { id: inviteExpiring.body.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const expiredPreview = await call('GET', `/invites/${expiredToken}`, { expect: 200 });
  check('pratinjau undangan kedaluwarsa berstatus EXPIRED', expiredPreview.body?.status === 'EXPIRED');

  await call('GET', '/invites/tidak-valid', { expect: 404 });
  await call('GET', `/invites/${'a'.repeat(64)}`, { expect: 404 });

  // Pendaftaran dengan token yang sudah dipakai tidak boleh meninggalkan akun yatim.
  const orphanEmail = email('yatim');
  await call('POST', '/auth/register', {
    body: { name: 'Yatim E2E', email: orphanEmail, password: PASSWORD, inviteToken: token },
    expect: 400,
  });
  const orphanCount = await prisma.user.count({ where: { email: orphanEmail } });
  check('token dipakai ulang tidak membuat akun', orphanCount === 0, `users=${orphanCount}`);

  section('25 · Proteksi penghapusan');

  // Pasangan mencatat transaksi, lalu dikeluarkan.
  await call('POST', '/transactions', {
    token: partnerToken2,
    body: { amount: 15000, categoryId, walletId, occurredAt, note: 'E2E bakso pasangan' },
    expect: 201,
  });
  const partnerTxBefore = await prisma.transaction.count({ where: { createdById: partnerId } });
  check('transaksi pasangan tersimpan', partnerTxBefore === 1, `tx=${partnerTxBefore}`);

  // Anggota biasa tidak boleh mengeluarkan siapa pun.
  await call('DELETE', `/household/members/${ownerId}`, { token: fresh.body?.accessToken, expect: 403 });

  // Pemilik tidak bisa mengeluarkan dirinya sendiri (proteksi pemilik terakhir).
  await call('DELETE', `/household/members/${ownerId}`, { token: ownerToken, expect: 409 });

  const removed = await call('DELETE', `/household/members/${partnerId}`, { token: ownerToken, expect: 200 });
  check('pemilik bisa mengeluarkan anggota', removed.body?.removed === true);

  const membershipInOwner = await prisma.householdMember.count({
    where: { userId: partnerId, householdId: ownerHousehold },
  });
  const membershipsTotal = await prisma.householdMember.count({ where: { userId: partnerId } });
  const userLeft = await prisma.user.count({ where: { email: partnerEmail } });
  const txLeft = await prisma.transaction.count({ where: { createdById: partnerId } });
  check('keanggotaan pasangan di rumah pemilik terhapus', membershipInOwner === 0, `membership=${membershipInOwner}`);
  check('rumah tangga sendiri pasangan tidak ikut terhapus', membershipsTotal === 1, `total=${membershipsTotal}`);
  check('akun pasangan tidak ikut terhapus', userLeft === 1, `users=${userLeft}`);
  check('transaksi pasangan tetap tersimpan', txLeft === partnerTxBefore, `tx=${txLeft}`);

  const ownerView = await call('GET', '/transactions?limit=50', { token: ownerToken, expect: 200 });
  const partnerTx = ownerView.body?.items?.find((t) => t.note === 'E2E bakso pasangan');
  check('riwayat transaksi pasangan masih terbaca setelah dikeluarkan', !!partnerTx);
  check('pencatat transaksi tetap nama pasangan', partnerTx?.createdBy?.name === 'Pasangan E2E', partnerTx?.createdBy?.name);

  // Sesi lama pasangan harus mati walau access token belum kedaluwarsa.
  await call('GET', '/household/members', { token: partnerToken2, expect: 403 });

  const revokedTokens = await prisma.refreshToken.count({
    where: { userId: partnerId, revokedAt: null },
  });
  check('refresh token pasangan dicabut semua', revokedTokens === 0, `aktif=${revokedTokens}`);

  section('Regresi jalur lama');
  const solo = await call('POST', '/auth/register', {
    body: { name: 'Mandiri E2E', email: email('solo'), password: PASSWORD },
    expect: 201,
  });
  const meSolo = await call('GET', '/auth/me', { token: solo.body?.accessToken, expect: 200 });
  check('daftar tanpa undangan tetap punya rumah tangga sendiri', meSolo.body?.households?.length === 1);
}

async function cleanup() {
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@e2e.test' } },
    select: { id: true },
  });
  const ids = testUsers.map((u) => u.id);

  // Urutannya penting: undangan dan transaksi menahan penghapusan user (FK Restrict).
  await prisma.householdInvite.deleteMany({
    where: { OR: [{ invitedById: { in: ids } }, { email: { endsWith: '@e2e.test' } }] },
  });
  await prisma.transaction.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.household.deleteMany({ where: { members: { none: {} } } });

  console.log(`\nBersih-bersih: ${ids.length} akun uji dihapus.`);
}

try {
  await run();
} catch (error) {
  failures.push('skrip berhenti karena error tak terduga');
  console.error('\nError tak terduga:', error);
} finally {
  await cleanup();
  await prisma.$disconnect();
}

const total = passed + failures.length;
console.log(`\n${passed}/${total} pemeriksaan lolos.`);
if (failures.length) {
  console.log('Gagal:');
  for (const f of failures) console.log(` - ${f}`);
  process.exitCode = 1;
}

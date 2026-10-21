-- Backfill untuk akun yang sudah ada sebelum kolom active_household_id dibuat.
-- Aturannya sama dengan fallback di AuthService.resolveActiveHouseholdId: pakai keanggotaan
-- terlama. Tanpa ini, akun lama baru mendapat nilainya saat login berikutnya.
UPDATE "users" u
SET "active_household_id" = m."household_id"
FROM (
    SELECT DISTINCT ON ("user_id") "user_id", "household_id"
    FROM "household_members"
    ORDER BY "user_id", "joined_at" ASC
) m
WHERE m."user_id" = u."id"
  AND u."active_household_id" IS NULL;

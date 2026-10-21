-- AlterTable
-- Household aktif per user. Satu user bisa menjadi anggota lebih dari satu household
-- (mis. ikut undangan pasangan), jadi login/refresh tidak boleh menebak dari urutan keanggotaan.
ALTER TABLE "users" ADD COLUMN     "active_household_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_active_household_id_fkey" FOREIGN KEY ("active_household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

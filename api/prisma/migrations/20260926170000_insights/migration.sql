-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('NEW', 'DISMISSED', 'TRYING');

-- CreateTable
CREATE TABLE "insights" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "rule_code" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "potential_saving" BIGINT NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" "InsightStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insights_household_id_period_start_idx" ON "insights"("household_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "insights_household_id_period_start_rule_code_subject_key_key" ON "insights"("household_id", "period_start", "rule_code", "subject_key");

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

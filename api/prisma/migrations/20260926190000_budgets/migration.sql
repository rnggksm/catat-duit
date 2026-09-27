-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "subject_key" TEXT NOT NULL,
    "category_id" UUID,
    "amount" BIGINT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_household_id_effective_from_idx" ON "budgets"("household_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_household_id_subject_key_effective_from_key" ON "budgets"("household_id", "subject_key", "effective_from");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

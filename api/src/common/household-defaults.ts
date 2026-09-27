import { Prisma } from '@prisma/client';
import {
  DefaultCategory,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_WALLETS,
  toNameKey,
} from './defaults';

type Tx = Prisma.TransactionClient;

async function createCategories(
  tx: Tx,
  householdId: string,
  type: 'EXPENSE' | 'INCOME',
  list: DefaultCategory[],
) {
  for (const [i, c] of list.entries()) {
    const parent = await tx.category.create({
      data: {
        householdId,
        type,
        name: c.name,
        nameKey: toNameKey(c.name),
        icon: c.icon,
        color: c.color,
        isEssential: c.isEssential,
        sortOrder: i,
      },
    });
    for (const [j, child] of (c.children ?? []).entries()) {
      await tx.category.create({
        data: {
          householdId,
          parentId: parent.id,
          type,
          name: child,
          nameKey: toNameKey(child),
          icon: c.icon,
          color: c.color,
          isEssential: c.isEssential,
          sortOrder: j,
        },
      });
    }
  }
}

/** Membuat household baru lengkap dengan dompet & kategori default. */
export async function createHouseholdWithDefaults(
  tx: Tx,
  params: { userId: string; name: string },
) {
  const household = await tx.household.create({
    data: {
      name: params.name,
      members: { create: { userId: params.userId, role: 'OWNER' } },
    },
  });

  await tx.wallet.createMany({
    data: DEFAULT_WALLETS.map((w, i) => ({
      householdId: household.id,
      name: w.name,
      type: w.type,
      sortOrder: i,
    })),
  });

  await createCategories(tx, household.id, 'EXPENSE', DEFAULT_EXPENSE_CATEGORIES);
  await createCategories(tx, household.id, 'INCOME', DEFAULT_INCOME_CATEGORIES);

  return household;
}

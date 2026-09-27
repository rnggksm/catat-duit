import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { BudgetOverview, Category, CategoryReport, InsightStatus, InsightsResponse, NoteSuggestion, PeriodReport, Summary, TransactionPage, Wallet } from './types';

export const useCategories = () =>
  useQuery({ queryKey: ['categories', 'EXPENSE'], queryFn: () => api<Category[]>('/categories?type=EXPENSE') });

export const useWallets = () => useQuery({ queryKey: ['wallets'], queryFn: () => api<Wallet[]>('/wallets') });

export const useSummary = () => useQuery({ queryKey: ['summary', 'current'], queryFn: () => api<Summary>('/summary/current') });

export interface TxFilter {
  from?: string;
  to?: string;
  categoryId?: string;
  walletId?: string;
  q?: string;
}

export function useTransactions(filter: TxFilter) {
  return useInfiniteQuery({
    queryKey: ['transactions', filter],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
      if (pageParam) params.set('cursor', pageParam);
      params.set('limit', '50');
      return api<TransactionPage>(`/transactions?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useNoteSuggestions(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['notes', term],
    queryFn: () => api<NoteSuggestion[]>(`/transactions/notes${term ? `?q=${encodeURIComponent(term)}` : ''}`),
    staleTime: 60_000,
  });
}

/** Urutkan kategori: paling sering dipakai lebih dulu, lalu urutan manual. */
export function byUsage(list: Category[]) {
  return [...list].sort((a, b) => b.usage - a.usage || a.sortOrder - b.sortOrder);
}

export const usePeriodReport = (offset: number) =>
  useQuery({ queryKey: ['reports', 'period', offset], queryFn: () => api<PeriodReport>(`/reports/period?offset=${offset}`) });

export const useCategoryReport = (id: string, offset: number) =>
  useQuery({
    queryKey: ['reports', 'category', id, offset],
    queryFn: () => api<CategoryReport>(`/reports/category/${id}?offset=${offset}`),
  });

export const useInsights = (offset: number) =>
  useQuery({ queryKey: ['insights', offset], queryFn: () => api<InsightsResponse>(`/insights?offset=${offset}`) });

/** Tandai saran: "Akan saya coba" (TRYING), "Abaikan" (DISMISSED), atau kembalikan (NEW). */
export function useSetInsightStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InsightStatus }) =>
      api<{ id: string; status: InsightStatus }>(`/insights/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  });
}

export const useBudgets = (offset = 0) =>
  useQuery({ queryKey: ['budgets', offset], queryFn: () => api<BudgetOverview>(`/budgets?offset=${offset}`) });

/** Pasang/ubah anggaran (amount 0 = hapus). categoryId kosong = anggaran total. Berlaku mulai periode berjalan. */
export function useSetBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { categoryId?: string; amount: number }) =>
      api<{ subjectKey: string; amount: number | null }>('/budgets', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['budgets'] });
      await qc.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

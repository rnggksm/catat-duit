import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post, setAccessToken } from './api';
import { useAuth } from './auth';
import type { CreatedInvite, HouseholdInvite, HouseholdMember, JoinedHousehold } from './types';

export const useMembers = () =>
  useQuery({ queryKey: ['household', 'members'], queryFn: () => api<HouseholdMember[]>('/household/members') });

/**
 * Daftar undangan hanya bisa dibaca OWNER (403 untuk anggota), jadi pemanggilan dimatikan
 * untuk peran lain alih-alih memicu error yang tidak perlu.
 */
export function useInvites(enabled: boolean) {
  return useQuery({
    queryKey: ['household', 'invites'],
    queryFn: () => api<HouseholdInvite[]>('/household/invites'),
    enabled,
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => post<CreatedInvite>('/household/invites', { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household', 'invites'] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string; status: string }>(`/household/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household', 'invites'] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<{ id: string; removed: boolean }>(`/household/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household', 'members'] }),
  });
}

/**
 * Pindah rumah tangga aktif. Token akses diganti dengan yang menunjuk rumah tangga baru, lalu
 * antrean offline + cache dibuang karena isinya milik rumah tangga sebelumnya.
 */
export function useSwitchHousehold() {
  const { resetAfterHouseholdChange } = useAuth();
  return useMutation({
    mutationFn: (householdId: string) => post<JoinedHousehold>('/household/switch', { householdId }),
    onSuccess: async (result) => {
      setAccessToken(result.accessToken);
      await resetAfterHouseholdChange();
    },
  });
}

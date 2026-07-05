"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAccount,
  deleteAccount,
  setAccountArchived,
  updateAccount,
} from "@/actions/accounts";
import type { AccountInput } from "@/lib/schemas";
import type { ClientAccount } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson, unwrap } from "@/hooks/api";

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: () => fetchJson<ClientAccount[]>("/api/accounts"),
  });
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.accounts }),
      queryClient.invalidateQueries({ queryKey: qk.dashboard }),
    ]);
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: AccountInput) => createAccount(input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AccountInput }) =>
      updateAccount(id, input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useSetAccountArchived() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setAccountArchived(id, archived).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id).then(unwrap),
    onSuccess: invalidate,
  });
}

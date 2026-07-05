"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvestmentTransaction,
  deleteInvestmentTransaction,
  updateInvestmentTransaction,
} from "@/actions/investments";
import {
  collectFixedTerm,
  createFixedTerm,
  deleteFixedTerm,
  updateFixedTerm,
} from "@/actions/fixed-terms";
import type { FixedTermInput, InvestmentTransactionInput } from "@/lib/schemas";
import type { ClientFixedTerm, ClientInvestmentTransaction, Holding } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson, unwrap } from "@/hooks/api";

export type InvestmentsResponse = {
  transactions: ClientInvestmentTransaction[];
  holdings: Holding[];
  mep: number | null;
};

export function useInvestments() {
  return useQuery({
    queryKey: qk.investments,
    queryFn: () => fetchJson<InvestmentsResponse>("/api/investments"),
  });
}

export function useFixedTerms() {
  return useQuery({
    queryKey: qk.fixedTerms,
    queryFn: () => fetchJson<ClientFixedTerm[]>("/api/fixed-terms"),
  });
}

function useInvalidateInvestments() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.investments }),
      queryClient.invalidateQueries({ queryKey: qk.fixedTerms }),
      queryClient.invalidateQueries({ queryKey: qk.accounts }),
      queryClient.invalidateQueries({ queryKey: qk.quotes }),
      queryClient.invalidateQueries({ queryKey: qk.dashboard }),
    ]);
}

export function useCreateInvestment() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: (input: InvestmentTransactionInput) =>
      createInvestmentTransaction(input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useUpdateInvestment() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: InvestmentTransactionInput }) =>
      updateInvestmentTransaction(id, input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useDeleteInvestment() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: (id: string) => deleteInvestmentTransaction(id).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useCreateFixedTerm() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: (input: FixedTermInput) => createFixedTerm(input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useUpdateFixedTerm() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FixedTermInput }) =>
      updateFixedTerm(id, input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useCollectFixedTerm() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      collectFixedTerm(id, accountId).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useDeleteFixedTerm() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: (id: string) => deleteFixedTerm(id).then(unwrap),
    onSuccess: invalidate,
  });
}

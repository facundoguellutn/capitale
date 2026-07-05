"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createIncome, deleteIncome, updateIncome } from "@/actions/incomes";
import type { IncomeInput } from "@/lib/schemas";
import type { ClientIncome } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson, unwrap } from "@/hooks/api";

export function useIncomes(month?: string) {
  return useQuery({
    queryKey: qk.incomes(month),
    queryFn: () =>
      fetchJson<ClientIncome[]>(
        month ? `/api/incomes?month=${month}` : "/api/incomes"
      ),
  });
}

function useInvalidateIncomes() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["incomes"] }),
      queryClient.invalidateQueries({ queryKey: qk.accounts }),
      queryClient.invalidateQueries({ queryKey: qk.dashboard }),
    ]);
}

export function useCreateIncome() {
  const invalidate = useInvalidateIncomes();
  return useMutation({
    mutationFn: (input: IncomeInput) => createIncome(input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useUpdateIncome() {
  const invalidate = useInvalidateIncomes();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IncomeInput }) =>
      updateIncome(id, input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useDeleteIncome() {
  const invalidate = useInvalidateIncomes();
  return useMutation({
    mutationFn: (id: string) => deleteIncome(id).then(unwrap),
    onSuccess: invalidate,
  });
}

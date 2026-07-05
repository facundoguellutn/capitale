"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createExpense, deleteExpense, updateExpense } from "@/actions/expenses";
import type { ExpenseInput } from "@/lib/schemas";
import type { ClientExpense } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson, unwrap } from "@/hooks/api";

export function useExpenses(month?: string) {
  return useQuery({
    queryKey: qk.expenses(month),
    queryFn: () =>
      fetchJson<ClientExpense[]>(
        month ? `/api/expenses?month=${month}` : "/api/expenses"
      ),
  });
}

function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: qk.accounts }),
      queryClient.invalidateQueries({ queryKey: qk.dashboard }),
    ]);
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExpenseInput }) =>
      updateExpense(id, input).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id).then(unwrap),
    onSuccess: invalidate,
  });
}

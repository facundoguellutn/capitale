"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { expenseSchema, type ExpenseInput } from "@/lib/schemas";
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from "@/lib/constants";
import type { ClientAccount, ClientExpense } from "@/lib/types";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { AccountSelect } from "@/components/accounts/account-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExpenseFormValues = z.input<typeof expenseSchema>;

function defaults(): ExpenseFormValues {
  return {
    date: new Date().toISOString().slice(0, 10),
    amount: "" as unknown as number,
    currency: "ARS",
    category: "comida",
    accountId: "",
    note: "",
  };
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ClientExpense | null;
  accounts: ClientAccount[];
}) {
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const isEdit = !!expense;

  const form = useForm<ExpenseFormValues, unknown, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) {
      form.reset(
        expense
          ? {
              date: expense.date.slice(0, 10),
              amount: expense.amount,
              currency: expense.currency,
              category: expense.category,
              accountId: expense.accountId,
              note: expense.note ?? "",
            }
          : defaults()
      );
    }
  }, [open, expense, form]);

  function onSubmit(values: ExpenseInput) {
    const options = {
      onSuccess: () => {
        toast.success(isEdit ? "Gasto actualizado" : "Gasto registrado");
        onOpenChange(false);
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Error al guardar"),
    };
    if (isEdit) {
      updateMutation.mutate({ id: expense!.id, input: values }, options);
    } else {
      createMutation.mutate(values, options);
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          <DialogDescription>
            Registrá tus gastos para llevar el control mensual.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input id="expense-date" type="date" {...form.register("date")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Categoría</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {EXPENSE_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-amount">Monto</Label>
              <Input
                id="expense-amount"
                type="number"
                step="any"
                min="0"
                {...form.register("amount")}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Moneda</Label>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cuenta origen</Label>
            <Controller
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <AccountSelect
                  accounts={accounts}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
            {errors.accountId && (
              <p className="text-sm text-destructive">Elegí una cuenta</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-note">Nota (opcional)</Label>
            <Input id="expense-note" {...form.register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

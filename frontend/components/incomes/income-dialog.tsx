"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { incomeSchema, type IncomeInput } from "@/lib/schemas";
import { CURRENCIES, INCOME_KINDS, INCOME_KIND_LABELS } from "@/lib/constants";
import type { ClientAccount, ClientIncome } from "@/lib/types";
import { useCreateIncome, useUpdateIncome } from "@/hooks/use-incomes";
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

type IncomeFormValues = z.input<typeof incomeSchema>;

function defaults(): IncomeFormValues {
  return {
    date: new Date().toISOString().slice(0, 10),
    amount: "" as unknown as number,
    currency: "ARS",
    kind: "sueldo",
    source: "",
    accountId: "",
    note: "",
  };
}

export function IncomeDialog({
  open,
  onOpenChange,
  income,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: ClientIncome | null;
  accounts: ClientAccount[];
}) {
  const createMutation = useCreateIncome();
  const updateMutation = useUpdateIncome();
  const isEdit = !!income;

  const form = useForm<IncomeFormValues, unknown, IncomeInput>({
    resolver: zodResolver(incomeSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) {
      form.reset(
        income
          ? {
              date: income.date.slice(0, 10),
              amount: income.amount,
              currency: income.currency,
              kind: income.kind,
              source: income.source,
              accountId: income.accountId,
              note: income.note ?? "",
            }
          : defaults()
      );
    }
  }, [open, income, form]);

  function onSubmit(values: IncomeInput) {
    const options = {
      onSuccess: () => {
        toast.success(isEdit ? "Ingreso actualizado" : "Ingreso registrado");
        onOpenChange(false);
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Error al guardar"),
    };
    if (isEdit) {
      updateMutation.mutate({ id: income!.id, input: values }, options);
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
          <DialogTitle>{isEdit ? "Editar ingreso" : "Nuevo ingreso"}</DialogTitle>
          <DialogDescription>
            Sueldos, pagos de proyectos y otros ingresos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-date">Fecha</Label>
              <Input id="income-date" type="date" {...form.register("date")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOME_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {INCOME_KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="income-source">Fuente</Label>
            <Input
              id="income-source"
              placeholder="Empleador, proyecto o cliente"
              {...form.register("source")}
            />
            {errors.source && (
              <p className="text-sm text-destructive">{errors.source.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-amount">Monto</Label>
              <Input
                id="income-amount"
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
            <Label>Cuenta destino</Label>
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
            <Label htmlFor="income-note">Nota (opcional)</Label>
            <Input id="income-note" {...form.register("note")} />
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

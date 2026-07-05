"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { accountSchema, type AccountInput } from "@/lib/schemas";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  CURRENCIES,
} from "@/lib/constants";
import type { ClientAccount } from "@/lib/types";
import { useCreateAccount, useUpdateAccount } from "@/hooks/use-accounts";
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

type AccountFormValues = z.input<typeof accountSchema>;

const DEFAULTS: AccountFormValues = {
  name: "",
  type: "banco",
  currency: "ARS",
  balance: 0,
};

export function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: ClientAccount | null;
}) {
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const isEdit = !!account;
  const mutation = isEdit ? updateMutation : createMutation;

  const form = useForm<AccountFormValues, unknown, AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        account
          ? {
              name: account.name,
              type: account.type,
              currency: account.currency,
              balance: account.balance,
            }
          : DEFAULTS
      );
    }
  }, [open, account, form]);

  function onSubmit(values: AccountInput) {
    const options = {
      onSuccess: () => {
        toast.success(isEdit ? "Cuenta actualizada" : "Cuenta creada");
        onOpenChange(false);
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Error al guardar"),
    };
    if (isEdit) {
      updateMutation.mutate({ id: account!.id, input: values }, options);
    } else {
      createMutation.mutate(values, options);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            Bancos, billeteras virtuales, brokers, exchanges o efectivo.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-name">Nombre</Label>
            <Input
              id="account-name"
              placeholder="Ej: Galicia, Mercado Pago, Binance"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ACCOUNT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Moneda</Label>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
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
            <Label htmlFor="account-balance">
              {isEdit ? "Saldo (ajuste manual)" : "Saldo inicial"}
            </Label>
            <Input
              id="account-balance"
              type="number"
              step="any"
              {...form.register("balance")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

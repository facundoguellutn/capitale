"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { fixedTermSchema, type FixedTermInput } from "@/lib/schemas";
import { CURRENCIES } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import type { ClientAccount, ClientFixedTerm } from "@/lib/types";
import {
  useCollectFixedTerm,
  useCreateFixedTerm,
  useUpdateFixedTerm,
} from "@/hooks/use-investments";
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

type FormValues = z.input<typeof fixedTermSchema>;

function defaults(): FormValues {
  return {
    bankName: "",
    principal: "" as unknown as number,
    currency: "ARS",
    tna: "" as unknown as number,
    startDate: new Date().toISOString().slice(0, 10),
    maturityDate: "",
    note: "",
  };
}

export function FixedTermDialog({
  open,
  onOpenChange,
  deposit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deposit?: ClientFixedTerm | null;
}) {
  const createMutation = useCreateFixedTerm();
  const updateMutation = useUpdateFixedTerm();
  const isEdit = !!deposit;

  const form = useForm<FormValues, unknown, FixedTermInput>({
    resolver: zodResolver(fixedTermSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) {
      form.reset(
        deposit
          ? {
              bankName: deposit.bankName,
              principal: deposit.principal,
              currency: deposit.currency,
              tna: deposit.tna,
              startDate: deposit.startDate.slice(0, 10),
              maturityDate: deposit.maturityDate.slice(0, 10),
              note: deposit.note ?? "",
            }
          : defaults()
      );
    }
  }, [open, deposit, form]);

  function onSubmit(values: FixedTermInput) {
    const options = {
      onSuccess: () => {
        toast.success(isEdit ? "Plazo fijo actualizado" : "Plazo fijo creado");
        onOpenChange(false);
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Error al guardar"),
    };
    if (isEdit) {
      updateMutation.mutate({ id: deposit!.id, input: values }, options);
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
          <DialogTitle>{isEdit ? "Editar plazo fijo" : "Nuevo plazo fijo"}</DialogTitle>
          <DialogDescription>
            El capital no se descuenta de ninguna cuenta; al cobrarlo se acredita
            capital + interés en la cuenta que elijas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ft-bank">Banco / Entidad</Label>
            <Input id="ft-bank" placeholder="Ej: Galicia" {...form.register("bankName")} />
            {errors.bankName && (
              <p className="text-sm text-destructive">{errors.bankName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ft-principal">Capital</Label>
              <Input
                id="ft-principal"
                type="number"
                step="any"
                min="0"
                {...form.register("principal")}
              />
              {errors.principal && (
                <p className="text-sm text-destructive">{errors.principal.message}</p>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="ft-tna">TNA %</Label>
              <Input
                id="ft-tna"
                type="number"
                step="any"
                min="0"
                placeholder="39.5"
                {...form.register("tna")}
              />
              {errors.tna && (
                <p className="text-sm text-destructive">{errors.tna.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ft-start">Inicio</Label>
              <Input id="ft-start" type="date" {...form.register("startDate")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ft-maturity">Vencimiento</Label>
              <Input id="ft-maturity" type="date" {...form.register("maturityDate")} />
              {errors.maturityDate && (
                <p className="text-sm text-destructive">
                  {errors.maturityDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ft-note">Nota (opcional)</Label>
            <Input id="ft-note" {...form.register("note")} />
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

export function CollectFixedTermDialog({
  open,
  onOpenChange,
  deposit,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deposit: ClientFixedTerm | null;
  accounts: ClientAccount[];
}) {
  const collectMutation = useCollectFixedTerm();
  const [accountId, setAccountId] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setAccountId(null);
    onOpenChange(next);
  }

  if (!deposit) return null;

  const finalValue =
    deposit.principal *
    (1 +
      (deposit.tna / 100) *
        ((new Date(deposit.maturityDate).getTime() -
          new Date(deposit.startDate).getTime()) /
          (1000 * 60 * 60 * 24) /
          365));

  function handleCollect() {
    if (!accountId || !deposit) return;
    collectMutation.mutate(
      { id: deposit.id, accountId },
      {
        onSuccess: () => {
          toast.success("Plazo fijo cobrado");
          handleOpenChange(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobrar plazo fijo</DialogTitle>
          <DialogDescription>
            Se van a acreditar{" "}
            <span className="font-medium text-foreground">
              {formatMoney(finalValue, deposit.currency)}
            </span>{" "}
            (capital + interés) en la cuenta que elijas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>Cuenta destino</Label>
          <AccountSelect
            accounts={accounts}
            value={accountId}
            onValueChange={setAccountId}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCollect}
            disabled={!accountId || collectMutation.isPending}
          >
            {collectMutation.isPending ? "Cobrando..." : "Cobrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

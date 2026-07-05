"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import {
  investmentTransactionSchema,
  type InvestmentTransactionInput,
} from "@/lib/schemas";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  CURRENCIES,
  TRANSACTION_SIDES,
} from "@/lib/constants";
import type { ClientAccount, ClientInvestmentTransaction } from "@/lib/types";
import { useCreateInvestment, useUpdateInvestment } from "@/hooks/use-investments";
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

type FormValues = z.input<typeof investmentTransactionSchema>;

function defaults(): FormValues {
  return {
    assetType: "accion",
    ticker: "",
    coingeckoId: "",
    side: "compra",
    quantity: "" as unknown as number,
    price: "" as unknown as number,
    currency: "ARS",
    date: new Date().toISOString().slice(0, 10),
    accountId: "",
    fee: "" as unknown as number,
    note: "",
  };
}

export function InvestmentDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: ClientInvestmentTransaction | null;
  accounts: ClientAccount[];
}) {
  const createMutation = useCreateInvestment();
  const updateMutation = useUpdateInvestment();
  const isEdit = !!transaction;

  const form = useForm<FormValues, unknown, InvestmentTransactionInput>({
    resolver: zodResolver(investmentTransactionSchema),
    defaultValues: defaults(),
  });

  const assetType = form.watch("assetType");

  useEffect(() => {
    if (open) {
      form.reset(
        transaction
          ? {
              assetType: transaction.assetType,
              ticker: transaction.ticker,
              coingeckoId: transaction.coingeckoId ?? "",
              side: transaction.side,
              quantity: transaction.quantity,
              price: transaction.price,
              currency: transaction.currency,
              date: transaction.date.slice(0, 10),
              accountId: transaction.accountId,
              fee: transaction.fee ?? ("" as unknown as number),
              note: transaction.note ?? "",
            }
          : defaults()
      );
    }
  }, [open, transaction, form]);

  function onSubmit(values: InvestmentTransactionInput) {
    const options = {
      onSuccess: () => {
        toast.success(isEdit ? "Operación actualizada" : "Operación registrada");
        onOpenChange(false);
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Error al guardar"),
    };
    if (isEdit) {
      updateMutation.mutate({ id: transaction!.id, input: values }, options);
    } else {
      createMutation.mutate(values, options);
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar operación" : "Nueva operación"}</DialogTitle>
          <DialogDescription>
            Compra o venta de acciones, CEDEARs, bonos o cripto. El efectivo se
            ajusta en la cuenta elegida.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Tipo de activo</Label>
              <Controller
                control={form.control}
                name="assetType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ASSET_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Operación</Label>
              <Controller
                control={form.control}
                name="side"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_SIDES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s === "compra" ? "Compra" : "Venta"}
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
              <Label htmlFor="inv-ticker">Ticker</Label>
              <Input
                id="inv-ticker"
                placeholder={assetType === "cripto" ? "BTC" : "GGAL, AAPL, AL30"}
                {...form.register("ticker")}
              />
              {errors.ticker && (
                <p className="text-sm text-destructive">{errors.ticker.message}</p>
              )}
            </div>
            {assetType === "cripto" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="inv-coingecko">Id de CoinGecko</Label>
                <Input
                  id="inv-coingecko"
                  placeholder="bitcoin, ethereum, tether"
                  {...form.register("coingeckoId")}
                />
                {errors.coingeckoId && (
                  <p className="text-sm text-destructive">
                    {errors.coingeckoId.message}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-date">Fecha</Label>
              <Input id="inv-date" type="date" {...form.register("date")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-quantity">
                {assetType === "bono" ? "Nominales" : "Cantidad"}
              </Label>
              <Input
                id="inv-quantity"
                type="number"
                step="any"
                min="0"
                {...form.register("quantity")}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-price">
                {assetType === "bono" ? "Precio (por 100)" : "Precio unitario"}
              </Label>
              <Input
                id="inv-price"
                type="number"
                step="any"
                min="0"
                {...form.register("price")}
              />
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price.message}</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Cuenta (efectivo)</Label>
              <Controller
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Elegí una cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.accountId && (
                <p className="text-sm text-destructive">Elegí una cuenta</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-fee">Comisión (opcional)</Label>
              <Input
                id="inv-fee"
                type="number"
                step="any"
                min="0"
                {...form.register("fee")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-note">Nota (opcional)</Label>
            <Input id="inv-note" {...form.register("note")} />
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

"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { accountSchema, type AccountInput } from "@/lib/schemas";
import {
  ACCOUNT_PROVIDERS,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  CURRENCIES,
  getAccountProvider,
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountFormValues = z.input<typeof accountSchema>;

const CUSTOM = "custom";

const DEFAULTS: AccountFormValues = {
  name: "",
  provider: "",
  type: "banco",
  currency: "ARS",
  balance: 0,
};

// Para cuentas viejas sin provider: si el nombre coincide con el catálogo, le asignamos el logo
function matchProviderByName(name: string) {
  const normalized = name.trim().toLowerCase();
  return ACCOUNT_PROVIDERS.find((p) => p.name.toLowerCase() === normalized);
}

function ProviderOption({ providerId }: { providerId: string }) {
  if (providerId === CUSTOM) {
    return <span className="text-muted-foreground">Otra (nombre manual)</span>;
  }
  const provider = getAccountProvider(providerId);
  if (!provider) return null;
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={provider.logo}
        alt=""
        width={16}
        height={16}
        className="shrink-0 rounded-sm"
      />
      {provider.name}
    </span>
  );
}

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

  // Proveedor elegido en el select ("custom" = nombre manual)
  const [providerId, setProviderId] = useState<string>(ACCOUNT_PROVIDERS[0].id);

  const form = useForm<AccountFormValues, unknown, AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (account) {
      const matched = account.provider
        ? getAccountProvider(account.provider)
        : matchProviderByName(account.name);
      setProviderId(matched?.id ?? CUSTOM);
      form.reset({
        name: account.name,
        provider: matched?.id ?? "",
        type: account.type,
        currency: account.currency,
        balance: account.balance,
      });
    } else {
      const first = ACCOUNT_PROVIDERS[0];
      setProviderId(first.id);
      form.reset({
        ...DEFAULTS,
        name: first.name,
        provider: first.id,
        type: first.type,
      });
    }
  }, [open, account, form]);

  function handleProviderChange(value: string | null) {
    const id = value ?? CUSTOM;
    setProviderId(id);
    const provider = getAccountProvider(id);
    if (provider) {
      form.setValue("provider", provider.id);
      form.setValue("name", provider.name);
      form.setValue("type", provider.type);
      form.clearErrors("name");
    } else {
      form.setValue("provider", "");
      form.setValue("name", account && !account.provider ? account.name : "");
    }
  }

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
            Elegí una de tus cuentas habituales o cargá otra a mano.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label>Cuenta</Label>
            <Select value={providerId} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  <ProviderOption providerId={providerId} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <ProviderOption providerId={p.id} />
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={CUSTOM}>
                  <ProviderOption providerId={CUSTOM} />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {providerId === CUSTOM && (
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
          )}

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

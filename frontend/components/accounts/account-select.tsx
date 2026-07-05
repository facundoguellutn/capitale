"use client";

import { useMemo } from "react";
import type { ClientAccount } from "@/lib/types";
import { AccountLabel } from "@/components/accounts/account-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Select de cuentas con logo. Nunca muestra el id crudo: resuelve el nombre
// de la lista e incluye la cuenta seleccionada aunque esté archivada.
export function AccountSelect({
  accounts,
  value,
  onValueChange,
  placeholder = "Elegí una cuenta",
}: {
  accounts: ClientAccount[];
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  const options = useMemo(
    () => accounts.filter((a) => !a.archived || a.id === value),
    [accounts, value]
  );
  const selected = value ? accounts.find((a) => a.id === value) : undefined;

  return (
    <Select
      value={value || null}
      onValueChange={(v) => {
        if (v != null) onValueChange(v);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          {selected ? (
            <AccountLabel
              name={`${selected.name} (${selected.currency})`}
              provider={selected.provider}
            />
          ) : value ? (
            <span className="text-muted-foreground">Cuenta eliminada</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <AccountLabel
              name={`${account.name} (${account.currency})${account.archived ? " · archivada" : ""}`}
              provider={account.provider}
            />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

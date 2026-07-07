"use client";

import { useMemo } from "react";
import {
  ASSET_TYPE_LABELS,
  isPer100,
  type AssetType,
  type Currency,
} from "@/lib/constants";
import type { ImportRowDraft } from "@/lib/import/types";
import { cn, formatMoney } from "@/lib/utils";
import { AssetLogo } from "@/components/asset-logo";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SummaryRow = {
  ticker: string;
  assetType: AssetType;
  currency: Currency;
  operations: number;
  boughtQty: number;
  soldQty: number;
  netCash: number;
};

// Efectivo de una fila con la misma regla que el server (cashEffect):
// compra resta bruto + comisión, venta suma bruto - comisión
function rowCash(values: ImportRowDraft["values"]): number {
  const qty = values.quantity ?? 0;
  const price = values.price ?? 0;
  const gross =
    values.assetType && isPer100(values.assetType)
      ? (qty * price) / 100
      : qty * price;
  const fee = values.fee ?? 0;
  return values.side === "compra" ? -(gross + fee) : gross - fee;
}

// Totales por activo de las filas que se van a importar, para chequear
// contra el resumen del broker antes de confirmar
export function ImportSummary({ drafts }: { drafts: ImportRowDraft[] }) {
  const { rows, totals } = useMemo(() => {
    const byKey = new Map<string, SummaryRow>();
    const totalsByCurrency = new Map<Currency, number>();

    for (const draft of drafts) {
      const { ticker, assetType, currency, side, quantity } = draft.values;
      if (!ticker || !assetType || !currency || !side) continue;
      const key = `${ticker}|${currency}`;
      const row = byKey.get(key) ?? {
        ticker,
        assetType,
        currency,
        operations: 0,
        boughtQty: 0,
        soldQty: 0,
        netCash: 0,
      };
      row.operations += 1;
      if (side === "compra") row.boughtQty += quantity ?? 0;
      else row.soldQty += quantity ?? 0;
      row.netCash += rowCash(draft.values);
      byKey.set(key, row);

      totalsByCurrency.set(
        currency,
        (totalsByCurrency.get(currency) ?? 0) + rowCash(draft.values)
      );
    }

    const rows = [...byKey.values()].sort((a, b) =>
      a.ticker.localeCompare(b.ticker)
    );
    return { rows, totals: [...totalsByCurrency.entries()] };
  }, [drafts]);

  if (rows.length === 0) return null;

  const fmtQty = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 8 });

  return (
    <div className="w-full">
      <p className="mb-2 text-sm font-medium">Resumen por activo</p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
              <TableHead className="text-right">Comprado</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="text-right">Cantidad neta</TableHead>
              <TableHead className="text-right">Efecto en efectivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.ticker}|${row.currency}`}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <AssetLogo ticker={row.ticker} assetType={row.assetType} />
                    {row.ticker}
                    <Badge variant="secondary">
                      {ASSET_TYPE_LABELS[row.assetType]}
                    </Badge>
                  </span>
                </TableCell>
                <TableCell className="text-right">{row.operations}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.boughtQty > 0 ? fmtQty(row.boughtQty) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.soldQty > 0 ? fmtQty(row.soldQty) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtQty(row.boughtQty - row.soldQty)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums",
                    row.netCash >= 0 ? "text-positive" : "text-negative"
                  )}
                >
                  {row.netCash >= 0 ? "+" : ""}
                  {formatMoney(row.netCash, row.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Efecto total en la cuenta:{" "}
        {totals.map(([currency, total], i) => (
          <span key={currency}>
            {i > 0 && " · "}
            <span
              className={cn(
                "font-medium",
                total >= 0 ? "text-positive" : "text-negative"
              )}
            >
              {total >= 0 ? "+" : ""}
              {formatMoney(total, currency)}
            </span>
          </span>
        ))}{" "}
        (compras y comisiones restan, ventas suman)
      </p>
    </div>
  );
}

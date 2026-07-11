"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  type Currency,
} from "@/lib/constants";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { convertAmount, formatMoneyIn } from "@/lib/fx";
import { useDisplayCurrency } from "@/components/display-currency";
import type { Holding } from "@/lib/types";
import { AssetLogo } from "@/components/asset-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALL_TYPES = "todos";

type SortKey =
  | "ticker"
  | "assetType"
  | "quantity"
  | "avgPrice"
  | "currentPrice"
  | "value"
  | "pnl";

type SortDir = "asc" | "desc";

function PnlText({
  pnl,
  pnlPct,
  currency,
}: {
  pnl: number | null;
  pnlPct: number | null;
  currency: Currency;
}) {
  if (pnl == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "font-medium",
        pnl >= 0 ? "text-positive" : "text-negative"
      )}
    >
      {pnl >= 0 ? "+" : ""}
      {formatMoney(pnl, currency)}
      {pnlPct != null && ` (${formatPercent(pnlPct)})`}
    </span>
  );
}

function getHoldingValue(
  holding: Holding,
  displayCurrency: Currency
): number | null {
  return displayCurrency === "ARS" ? holding.valueARS : holding.valueUSD;
}

function getHoldingPnl(
  holding: Holding,
  displayCurrency: Currency,
  mep: number | null
): number | null {
  if (holding.pnl == null) return null;
  return convertAmount(holding.pnl, "ARS", displayCurrency, mep) ?? holding.pnl;
}

function compareNullable(
  a: number | null,
  b: number | null,
  dir: SortDir
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

function compareString(a: string, b: string, dir: SortDir): number {
  const cmp = a.localeCompare(b, "es");
  return dir === "asc" ? cmp : -cmp;
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  sortDir,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  sortDir: SortDir;
  align?: "left" | "right";
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeKey === sortKey;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <Button
        variant="ghost"
        size="xs"
        className={cn(align === "right" && "-mr-2")}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {!isActive && <ArrowUpDown data-icon="inline-end" />}
        {isActive && sortDir === "desc" && <ArrowDown data-icon="inline-end" />}
        {isActive && sortDir === "asc" && <ArrowUp data-icon="inline-end" />}
      </Button>
    </TableHead>
  );
}

type HoldingsTableProps = {
  holdings: Holding[];
  mep: number | null;
};

export function HoldingsTable({ holdings, mep }: HoldingsTableProps) {
  const { displayCurrency } = useDisplayCurrency();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const hasFilters =
    search.trim() !== "" || typeFilter !== ALL_TYPES;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" || key === "assetType" ? "asc" : "desc");
    }
  }

  const visibleHoldings = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = [...holdings];

    if (query) {
      list = list.filter((h) => h.ticker.toLowerCase().includes(query));
    }

    if (typeFilter !== ALL_TYPES) {
      list = list.filter((h) => h.assetType === typeFilter);
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case "ticker":
          return compareString(a.ticker, b.ticker, sortDir);
        case "assetType":
          return compareString(
            ASSET_TYPE_LABELS[a.assetType],
            ASSET_TYPE_LABELS[b.assetType],
            sortDir
          );
        case "quantity":
          return compareNullable(a.quantity, b.quantity, sortDir);
        case "avgPrice":
          return compareNullable(a.avgPrice, b.avgPrice, sortDir);
        case "currentPrice":
          return compareNullable(a.currentPrice, b.currentPrice, sortDir);
        case "value":
          return compareNullable(
            getHoldingValue(a, displayCurrency),
            getHoldingValue(b, displayCurrency),
            sortDir
          );
        case "pnl":
          return compareNullable(
            getHoldingPnl(a, displayCurrency, mep),
            getHoldingPnl(b, displayCurrency, mep),
            sortDir
          );
        default:
          return 0;
      }
    });

    return list;
  }, [holdings, search, typeFilter, sortKey, sortDir, displayCurrency, mep]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ticker…"
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as string)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Todos los tipos</SelectItem>
            {ASSET_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ASSET_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && holdings.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {visibleHoldings.length} de {holdings.length} posiciones
        </p>
      )}

      {visibleHoldings.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Ticker"
                sortKey="ticker"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHead
                label="Tipo"
                sortKey="assetType"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHead
                label="Cantidad"
                sortKey="quantity"
                activeKey={sortKey}
                sortDir={sortDir}
                align="right"
                onSort={handleSort}
              />
              <SortableHead
                label="PPC"
                sortKey="avgPrice"
                activeKey={sortKey}
                sortDir={sortDir}
                align="right"
                onSort={handleSort}
              />
              <SortableHead
                label="Precio actual"
                sortKey="currentPrice"
                activeKey={sortKey}
                sortDir={sortDir}
                align="right"
                onSort={handleSort}
              />
              <SortableHead
                label={`Valor (${displayCurrency})`}
                sortKey="value"
                activeKey={sortKey}
                sortDir={sortDir}
                align="right"
                onSort={handleSort}
              />
              <SortableHead
                label="Resultado"
                sortKey="pnl"
                activeKey={sortKey}
                sortDir={sortDir}
                align="right"
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleHoldings.map((holding) => (
              <TableRow key={holding.ticker}>
                <TableCell className="font-medium">
                  <Link
                    href={`/inversiones/${encodeURIComponent(holding.ticker)}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <AssetLogo
                      ticker={holding.ticker}
                      assetType={holding.assetType}
                    />
                    {holding.ticker}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {ASSET_TYPE_LABELS[holding.assetType]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {holding.quantity.toLocaleString("es-AR", {
                    maximumFractionDigits: 8,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoneyIn(
                    holding.avgPrice,
                    holding.currency,
                    displayCurrency,
                    mep
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {holding.currentPrice != null ? (
                    formatMoneyIn(
                      holding.currentPrice,
                      holding.assetType === "cripto" ? "USD" : "ARS",
                      displayCurrency,
                      mep
                    )
                  ) : (
                    <Badge variant="secondary">Sin cotización</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const value =
                      displayCurrency === "ARS"
                        ? holding.valueARS
                        : holding.valueUSD;
                    if (value != null)
                      return formatMoney(value, displayCurrency);
                    if (holding.valueARS != null)
                      return formatMoney(holding.valueARS, "ARS");
                    if (holding.valueUSD != null)
                      return formatMoney(holding.valueUSD, "USD");
                    return "—";
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const converted =
                      holding.pnl != null
                        ? convertAmount(
                            holding.pnl,
                            "ARS",
                            displayCurrency,
                            mep
                          )
                        : null;
                    return converted != null ? (
                      <PnlText
                        pnl={converted}
                        pnlPct={holding.pnlPct}
                        currency={displayCurrency}
                      />
                    ) : (
                      <PnlText
                        pnl={holding.pnl}
                        pnlPct={holding.pnlPct}
                        currency="ARS"
                      />
                    );
                  })()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay posiciones que coincidan con tu búsqueda.
        </p>
      )}
    </>
  );
}

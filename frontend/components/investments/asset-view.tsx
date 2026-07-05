"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ASSET_TYPE_LABELS, type Currency } from "@/lib/constants";
import { cn, formatDate, formatMoney, formatPercent } from "@/lib/utils";
import type { AssetCandle } from "@/lib/types";
import { useInvestments } from "@/hooks/use-investments";
import { useAssetHistory } from "@/hooks/use-assets";
import { AssetChart } from "@/components/investments/asset-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function PctBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "font-medium",
        value >= 0 ? "text-positive" : "text-negative"
      )}
    >
      {formatPercent(value)}
    </span>
  );
}

// Variación porcentual entre el último cierre y el cierre en/antes de `fromTime`
function pctChangeSince(candles: AssetCandle[], fromTime: number): number | null {
  if (candles.length < 2) return null;
  const last = candles[candles.length - 1];
  let base: AssetCandle | null = null;
  for (const candle of candles) {
    if (candle.time <= fromTime) base = candle;
    else break;
  }
  if (!base || base.close === 0 || base.time === last.time) return null;
  return (last.close - base.close) / base.close;
}

export function AssetView({ ticker }: { ticker: string }) {
  const upper = ticker.toUpperCase();
  const { data, isPending } = useInvestments();

  const transactions = useMemo(
    () =>
      (data?.transactions ?? []).filter(
        (tx) => tx.ticker.toUpperCase() === upper
      ),
    [data, upper]
  );
  const holding = data?.holdings.find((h) => h.ticker === upper);

  const assetType = holding?.assetType ?? transactions[0]?.assetType;
  const coingeckoId =
    holding?.coingeckoId ?? transactions.find((tx) => tx.coingeckoId)?.coingeckoId;

  const history = useAssetHistory(upper, assetType, coingeckoId);
  const candles = history.data?.candles ?? [];
  const priceCurrency: Currency = history.data?.currency ?? "ARS";

  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : null;
  const currentPrice = holding?.currentPrice ?? lastClose;

  const variations = useMemo(() => {
    if (candles.length === 0) return [];
    const lastTime = candles[candles.length - 1].time;
    const startOfYear = Math.floor(
      Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000
    );
    return [
      { label: "1 semana", value: pctChangeSince(candles, lastTime - 7 * 86400) },
      { label: "1 mes", value: pctChangeSince(candles, lastTime - 30 * 86400) },
      { label: "YTD", value: pctChangeSince(candles, startOfYear) },
      { label: "1 año", value: pctChangeSince(candles, lastTime - 365 * 86400) },
    ];
  }, [candles]);

  const dailyChange =
    holding?.pctChange != null
      ? holding.pctChange / 100
      : candles.length >= 2
        ? (candles[candles.length - 1].close - candles[candles.length - 2].close) /
          candles[candles.length - 2].close
        : null;

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!assetType) {
    return (
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/inversiones" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a inversiones
        </Button>
        <p className="py-16 text-center text-sm text-muted-foreground">
          No encontramos operaciones con el activo {upper}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2"
          render={<Link href="/inversiones" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Inversiones
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{upper}</h1>
            <Badge variant="secondary">{ASSET_TYPE_LABELS[assetType]}</Badge>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">
              {currentPrice != null
                ? formatMoney(currentPrice, priceCurrency)
                : "Sin cotización"}
            </p>
            {dailyChange != null && (
              <p className="text-sm">
                Hoy: <PctBadge value={dailyChange} />
              </p>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent>
          {history.isPending ? (
            <Skeleton className="h-[380px] w-full" />
          ) : history.isError ? (
            <p className="py-16 text-center text-sm text-destructive">
              No se pudo cargar el histórico de precios.
            </p>
          ) : (
            <AssetChart candles={candles} />
          )}
        </CardContent>
      </Card>

      {variations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          {variations.map((variation) => (
            <Card key={variation.label}>
              <CardHeader>
                <CardDescription>{variation.label}</CardDescription>
                <CardTitle className="text-xl">
                  <PctBadge value={variation.value} />
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tu posición</CardTitle>
            <CardDescription>
              {holding
                ? "Tenencia actual calculada desde tus operaciones"
                : "No tenés posición abierta en este activo"}
            </CardDescription>
          </CardHeader>
          {holding && (
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Cantidad</dt>
                  <dd className="font-medium">
                    {holding.quantity.toLocaleString("es-AR", {
                      maximumFractionDigits: 8,
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Precio promedio</dt>
                  <dd className="font-medium">
                    {formatMoney(holding.avgPrice, holding.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Costo total</dt>
                  <dd className="font-medium">
                    {formatMoney(holding.costBasis, holding.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Valor actual</dt>
                  <dd className="font-medium">
                    {holding.valueARS != null
                      ? formatMoney(holding.valueARS, "ARS")
                      : "—"}
                    {holding.valueUSD != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatMoney(holding.valueUSD, "USD")}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Resultado</dt>
                  <dd>
                    {holding.pnl != null ? (
                      <span
                        className={cn(
                          "text-lg font-semibold",
                          holding.pnl >= 0 ? "text-positive" : "text-negative"
                        )}
                      >
                        {holding.pnl >= 0 ? "+" : ""}
                        {formatMoney(holding.pnl, "ARS")}
                        {holding.pnlPct != null &&
                          ` (${formatPercent(holding.pnlPct)})`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operaciones</CardTitle>
            <CardDescription>
              Tu historial de compras y ventas de {upper}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Operación</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDate(tx.date)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            tx.side === "compra" ? "text-positive" : "text-negative"
                          )}
                        >
                          {tx.side === "compra" ? "Compra" : "Venta"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.quantity.toLocaleString("es-AR", {
                          maximumFractionDigits: 8,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(tx.price, tx.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin operaciones registradas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

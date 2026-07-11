"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  ASSET_TYPE_LABELS,
  sameInstrument,
  type AssetType,
  type Currency,
} from "@/lib/constants";
import { cn, formatDate, formatMoney, formatPercent } from "@/lib/utils";
import { convertAmount, formatMoneyIn } from "@/lib/fx";
import { computeZones } from "@/lib/analytics";
import { getFixedIncomeInstrument } from "@/lib/fixed-income";
import type { AssetCandle } from "@/lib/types";
import { useDisplayCurrency } from "@/components/display-currency";
import { useInvestments } from "@/hooks/use-investments";
import { useAssetHistory } from "@/hooks/use-assets";
import { AssetChart, type TradeMarker } from "@/components/investments/asset-chart";
import { AssetMetrics } from "@/components/investments/asset-metrics";
import { PositionEvolution } from "@/components/investments/position-evolution";
import { PositionSimulator } from "@/components/investments/position-simulator";
import { FixedIncomePanel } from "@/components/investments/fixed-income-panel";
import { InflationComparison } from "@/components/investments/inflation-comparison";
import { AssetLogo } from "@/components/asset-logo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

// Métrica destacada de la fila "Tu posición"
function Stat({
  label,
  sub,
  className,
  children,
}: {
  label: string;
  sub?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>
        <span
          className={cn(
            "mt-1 block text-2xl font-semibold tracking-tight",
            className
          )}
        >
          {children}
        </span>
        {sub && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {sub}
          </span>
        )}
      </dd>
    </div>
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

export function AssetView({
  ticker,
  initialType,
  initialCoingeckoId,
}: {
  ticker: string;
  initialType?: AssetType;
  initialCoingeckoId?: string;
}) {
  const upper = ticker.toUpperCase();
  const { data, isPending } = useInvestments();
  const { displayCurrency } = useDisplayCurrency();
  const mep = data?.mep ?? null;

  const transactions = useMemo(
    () =>
      (data?.transactions ?? []).filter((tx) =>
        sameInstrument(tx.ticker, upper, initialType ?? tx.assetType)
      ),
    [data, upper, initialType]
  );
  const holding = data?.holdings.find((h) => h.ticker === upper);

  const assetType = initialType ?? holding?.assetType ?? transactions[0]?.assetType;
  const coingeckoId =
    initialCoingeckoId ??
    holding?.coingeckoId ??
    transactions.find((tx) => tx.coingeckoId)?.coingeckoId;

  const history = useAssetHistory(upper, assetType, coingeckoId);
  const historyCandles = history.data?.candles;
  const candles = useMemo(() => historyCandles ?? [], [historyCandles]);
  const priceCurrency: Currency = history.data?.currency ?? "ARS";
  const fixedIncomeInstrument = assetType
    ? getFixedIncomeInstrument(upper, assetType)
    : null;

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

  // Marcadores de operaciones propias para el gráfico de precios
  const trades = useMemo<TradeMarker[]>(
    () =>
      transactions.map((tx) => ({
        time: Math.floor(new Date(tx.date).getTime() / 1000),
        side: tx.side,
        quantity: tx.quantity,
      })),
    [transactions]
  );

  const zones = useMemo(() => computeZones(candles), [candles]);

  // PPC en la moneda de las velas (convertido al MEP actual si difiere)
  const ppc =
    holding != null
      ? convertAmount(holding.avgPrice, holding.currency, priceCurrency, mep)
      : null;
  const ppcApprox = holding != null && holding.currency !== priceCurrency;

  const dailyChange =
    holding?.pctChange != null
      ? holding.pctChange / 100
      : candles.length >= 2
        ? (candles[candles.length - 1].close - candles[candles.length - 2].close) /
          candles[candles.length - 2].close
        : null;

  if (isPending && !initialType) {
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
        <Link
          href="/inversiones"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft data-icon="inline-start" />
          Volver a inversiones
        </Link>
        <p className="py-16 text-center text-sm text-muted-foreground">
          No encontramos operaciones con el activo {upper}. Probá buscarlo con
          Ctrl+K para ver su cotización.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/inversiones"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-2"
          )}
        >
          <ArrowLeft data-icon="inline-start" />
          Inversiones
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <AssetLogo ticker={upper} assetType={assetType} className="size-9 text-xs" />
            <h1 className="text-3xl font-semibold tracking-tight">{upper}</h1>
            <Badge variant="secondary">{ASSET_TYPE_LABELS[assetType]}</Badge>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">
              {currentPrice != null
                ? formatMoneyIn(currentPrice, priceCurrency, displayCurrency, mep)
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
            <>
              {history.data?.fallbackUsed && (
                <div className="mb-3 rounded-md border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-muted-foreground">
                  La especie {history.data.requestedTicker} no tiene histórico propio. Se muestra la serie en ARS de {history.data.resolvedTicker}.
                </div>
              )}
              <AssetChart
                candles={candles}
                trades={trades}
                ppc={ppc}
                ppcApprox={ppcApprox}
                zones={zones}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Precios en {priceCurrency} (moneda de cotización)
                {ppc != null &&
                  " · el PPC incluye comisiones de compra (es tu break-even)"}
                {ppc != null && ppcApprox && " · PPC convertido al MEP actual"}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {fixedIncomeInstrument && (
        <FixedIncomePanel
          instrument={fixedIncomeInstrument}
          price={
            currentPrice != null
              ? convertAmount(currentPrice, priceCurrency, fixedIncomeInstrument.currency, mep)
              : null
          }
          quantity={holding?.quantity ?? 100}
        />
      )}

      {holding && (
        <Card>
          <CardHeader>
            <CardTitle>Tu posición</CardTitle>
            <CardDescription>
              Tenencia actual calculada desde tus operaciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Cantidad">
                {holding.quantity.toLocaleString("es-AR", {
                  maximumFractionDigits: 8,
                })}
              </Stat>
              <Stat label="Precio promedio" sub="Con comisiones incluidas">
                {formatMoneyIn(
                  holding.avgPrice,
                  holding.currency,
                  displayCurrency,
                  mep
                )}
              </Stat>
              <Stat label="Costo total">
                {formatMoneyIn(
                  holding.costBasis,
                  holding.currency,
                  displayCurrency,
                  mep
                )}
              </Stat>
              {(() => {
                const primary =
                  displayCurrency === "ARS" ? holding.valueARS : holding.valueUSD;
                const secondary =
                  displayCurrency === "ARS" ? holding.valueUSD : holding.valueARS;
                const secondaryCurrency =
                  displayCurrency === "ARS" ? "USD" : "ARS";
                return (
                  <Stat
                    label="Valor actual"
                    sub={
                      primary != null && secondary != null
                        ? formatMoney(secondary, secondaryCurrency)
                        : undefined
                    }
                  >
                    {primary != null
                      ? formatMoney(primary, displayCurrency)
                      : secondary != null
                        ? formatMoney(secondary, secondaryCurrency)
                        : "—"}
                  </Stat>
                );
              })()}
              <Stat
                label="Resultado"
                className={cn(
                  holding.pnl != null &&
                    (holding.pnl >= 0 ? "text-positive" : "text-negative")
                )}
                sub={
                  holding.pnlPct != null ? (
                    <span
                      className={cn(
                        "font-medium",
                        holding.pnl != null && holding.pnl >= 0
                          ? "text-positive"
                          : "text-negative"
                      )}
                    >
                      {formatPercent(holding.pnlPct)}
                    </span>
                  ) : undefined
                }
              >
                {holding.pnl != null ? (
                  <>
                    {holding.pnl >= 0 ? "+" : ""}
                    {(() => {
                      const converted = convertAmount(
                        holding.pnl,
                        "ARS",
                        displayCurrency,
                        mep
                      );
                      return converted != null
                        ? formatMoney(converted, displayCurrency)
                        : formatMoney(holding.pnl, "ARS");
                    })()}
                  </>
                ) : (
                  "—"
                )}
              </Stat>
            </dl>
          </CardContent>
        </Card>
      )}

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

      {transactions.length > 0 && (
        <PositionEvolution
          transactions={transactions}
          candles={candles}
          assetType={assetType}
          priceCurrency={priceCurrency}
          mep={mep}
        />
      )}

      {candles.length > 0 && (
        <>
          <InflationComparison candles={candles} currency={priceCurrency} instrument={fixedIncomeInstrument} />
          <AssetMetrics
            candles={candles}
            assetType={assetType}
            priceCurrency={priceCurrency}
            currentPrice={currentPrice}
            holding={holding}
            allHoldings={data?.holdings ?? []}
            transactions={transactions}
            mep={mep}
          />
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <PositionSimulator
          holding={holding}
          assetType={assetType}
          currentPrice={currentPrice}
          priceCurrency={priceCurrency}
          mep={mep}
        />

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

"use client";

import { useMemo } from "react";
import type { AssetType, Currency } from "@/lib/constants";
import {
  annualizedVolatility,
  bestWorstDay,
  computeRealized,
  computeZones,
  rangeStats,
  sma,
} from "@/lib/analytics";
import { convertAmount, formatMoneyIn } from "@/lib/fx";
import type { AssetCandle, ClientInvestmentTransaction, Holding } from "@/lib/types";
import { cn, formatDate, formatMoney, formatPercent } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/display-currency";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Metric({
  label,
  children,
  title,
}: {
  label: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div title={title}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function Pct({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn(value >= 0 ? "text-positive" : "text-negative")}>
      {formatPercent(value)}
    </span>
  );
}

// Barra del rango de 52 semanas tintada por terciles, con el precio actual
// y el PPC marcados
function RangeGauge({
  low,
  high,
  price,
  ppc,
  currency,
}: {
  low: number;
  high: number;
  price: number;
  ppc: number | null;
  currency: Currency;
}) {
  const pos = (value: number) =>
    `${Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100))}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <div className="flex h-2 overflow-hidden rounded-full">
          <div className="w-1/3 bg-positive/25" />
          <div className="w-1/3 bg-muted" />
          <div className="w-1/3 bg-negative/25" />
        </div>
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
          style={{ left: pos(price) }}
          title={`Precio actual: ${formatMoney(price, currency)}`}
        />
        {ppc != null && ppc >= low && ppc <= high && (
          <div
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass"
            style={{ left: pos(ppc) }}
            title={`Tu precio promedio: ${formatMoney(ppc, currency)}`}
          />
        )}
      </div>
      <div className="flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
        <span>{formatMoney(low, currency)}</span>
        <span>{formatMoney(high, currency)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Rango de 52 semanas · ● precio actual
        {ppc != null && (
          <>
            {" "}
            · <span className="text-brass">●</span> tu PPC
          </>
        )}{" "}
        · Zonas orientativas por terciles, no es una recomendación.
      </p>
    </div>
  );
}

export function AssetMetrics({
  candles,
  assetType,
  priceCurrency,
  currentPrice,
  holding,
  allHoldings,
  transactions,
  mep,
}: {
  candles: AssetCandle[];
  assetType: AssetType;
  priceCurrency: Currency;
  currentPrice: number | null;
  holding?: Holding;
  allHoldings: Holding[];
  transactions: ClientInvestmentTransaction[];
  mep: number | null;
}) {
  const { displayCurrency } = useDisplayCurrency();

  const stats = useMemo(() => rangeStats(candles), [candles]);
  const zones = useMemo(() => computeZones(candles), [candles]);
  const volatility = useMemo(
    () => annualizedVolatility(candles, assetType === "cripto" ? 365 : 252),
    [candles, assetType]
  );
  const extremes = useMemo(() => bestWorstDay(candles), [candles]);
  const trend = useMemo(() => {
    const sma50 = sma(candles, 50);
    const sma200 = sma(candles, 200);
    const last50 = sma50.length > 0 ? sma50[sma50.length - 1].value : null;
    const last200 = sma200.length > 0 ? sma200[sma200.length - 1].value : null;
    return { sma50: last50, sma200: last200 };
  }, [candles]);
  const realized = useMemo(
    () => (transactions.length > 0 ? computeRealized(transactions, assetType) : null),
    [transactions, assetType]
  );

  // PPC llevado a la moneda de las velas para comparar contra el precio
  const ppcInPriceCurrency =
    holding != null
      ? convertAmount(holding.avgPrice, holding.currency, priceCurrency, mep)
      : null;
  const vsPpc =
    currentPrice != null && ppcInPriceCurrency != null && ppcInPriceCurrency !== 0
      ? (currentPrice - ppcInPriceCurrency) / ppcInPriceCurrency
      : null;

  const portfolioWeight = useMemo(() => {
    if (holding?.valueARS == null) return null;
    const total = allHoldings.reduce(
      (acc, h) => acc + (h.valueARS ?? 0),
      0
    );
    return total > 0 ? holding.valueARS / total : null;
  }, [holding, allHoldings]);

  const trendLabel =
    currentPrice == null || trend.sma50 == null
      ? null
      : trend.sma200 == null
        ? currentPrice >= trend.sma50
          ? "Alcista"
          : "Bajista"
        : currentPrice >= trend.sma50 && currentPrice >= trend.sma200
          ? "Alcista"
          : currentPrice < trend.sma50 && currentPrice < trend.sma200
            ? "Bajista"
            : "Neutral";

  const insufficient = (
    <span className="text-xs text-muted-foreground">Datos insuficientes</span>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métricas</CardTitle>
        <CardDescription>
          Indicadores del último año para ayudarte a decidir · orientativos, no
          son una recomendación
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {stats && zones && currentPrice != null && (
          <RangeGauge
            low={stats.low}
            high={stats.high}
            price={currentPrice}
            ppc={ppcInPriceCurrency}
            currency={priceCurrency}
          />
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <Metric label="Máx 52 semanas">
            {stats ? formatMoney(stats.high, priceCurrency) : insufficient}
          </Metric>
          <Metric label="Mín 52 semanas">
            {stats ? formatMoney(stats.low, priceCurrency) : insufficient}
          </Metric>
          <Metric
            label="Desde el máximo"
            title="Cuánto cayó el precio desde el máximo de 52 semanas"
          >
            {stats ? <Pct value={stats.pctFromHigh} /> : insufficient}
          </Metric>
          <Metric
            label="Sobre el mínimo"
            title="Cuánto subió el precio desde el mínimo de 52 semanas"
          >
            {stats ? <Pct value={stats.pctAboveLow} /> : insufficient}
          </Metric>
          <Metric
            label="Tendencia"
            title="Posición del precio respecto de las medias móviles de 50 y 200 ruedas"
          >
            {trendLabel ? (
              <Badge
                variant="secondary"
                className={cn(
                  trendLabel === "Alcista" && "text-positive",
                  trendLabel === "Bajista" && "text-negative"
                )}
              >
                {trendLabel}
              </Badge>
            ) : (
              insufficient
            )}
          </Metric>
          <Metric
            label="Volatilidad anual"
            title="Desvío estándar de los retornos diarios, anualizado. Más alto = más riesgo."
          >
            {volatility != null ? (
              new Intl.NumberFormat("es-AR", {
                style: "percent",
                maximumFractionDigits: 1,
              }).format(volatility)
            ) : (
              insufficient
            )}
          </Metric>
          <Metric label="Mejor día del año">
            {extremes ? (
              <>
                <Pct value={extremes.best.ret} />{" "}
                <span className="text-xs text-muted-foreground">
                  {formatDate(new Date(extremes.best.time * 1000))}
                </span>
              </>
            ) : (
              insufficient
            )}
          </Metric>
          <Metric label="Peor día del año">
            {extremes ? (
              <>
                <Pct value={extremes.worst.ret} />{" "}
                <span className="text-xs text-muted-foreground">
                  {formatDate(new Date(extremes.worst.time * 1000))}
                </span>
              </>
            ) : (
              insufficient
            )}
          </Metric>
        </dl>

        {holding && (
          <div className="border-t pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <div className="col-span-2">
                <dt className="text-muted-foreground">Precio actual vs tu PPC</dt>
                <dd
                  className={cn(
                    "font-mono text-2xl font-semibold tabular-nums",
                    vsPpc == null
                      ? "text-muted-foreground"
                      : vsPpc >= 0
                        ? "text-positive"
                        : "text-negative"
                  )}
                >
                  {vsPpc != null ? formatPercent(vsPpc) : "—"}
                </dd>
              </div>
              <Metric
                label="Peso en tu cartera"
                title="Porcentaje del valor total de tus inversiones"
              >
                {portfolioWeight != null ? (
                  new Intl.NumberFormat("es-AR", {
                    style: "percent",
                    maximumFractionDigits: 1,
                  }).format(portfolioWeight)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Metric>
              <Metric
                label="Resultado realizado"
                title="Ganancia o pérdida ya concretada en tus ventas"
              >
                {realized ? (
                  <span
                    className={cn(
                      realized.realized >= 0 ? "text-positive" : "text-negative"
                    )}
                  >
                    {realized.realized >= 0 ? "+" : ""}
                    {formatMoneyIn(
                      realized.realized,
                      realized.currency,
                      displayCurrency,
                      mep
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sin ventas todavía
                  </span>
                )}
              </Metric>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

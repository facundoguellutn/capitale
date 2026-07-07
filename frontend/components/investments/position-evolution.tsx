"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import type { AssetType, Currency } from "@/lib/constants";
import { buildPositionSeries } from "@/lib/analytics";
import { convertAmount } from "@/lib/fx";
import type { AssetCandle, ClientInvestmentTransaction } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const evolutionConfig = {
  value: { label: "Valor de tu posición", color: "var(--chart-1)" },
  invested: { label: "Capital invertido", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const compactNumber = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const monthTick = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  year: "2-digit",
});

const fullDate = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function PositionEvolution({
  transactions,
  candles,
  assetType,
  priceCurrency,
  mep,
}: {
  transactions: ClientInvestmentTransaction[];
  candles: AssetCandle[];
  assetType: AssetType;
  priceCurrency: Currency;
  mep: number | null;
}) {
  const txCurrency: Currency = transactions[0]?.currency ?? priceCurrency;
  const needsConversion = txCurrency !== priceCurrency;

  const { series, investedHidden } = useMemo(() => {
    const raw = buildPositionSeries(transactions, candles, assetType);
    if (!needsConversion) return { series: raw, investedHidden: false };
    // Capital invertido en otra moneda: se lleva a la de las velas al MEP
    // actual; sin MEP se muestra solo el valor
    if (mep == null) {
      return {
        series: raw.map((p) => ({ ...p, invested: null as number | null })),
        investedHidden: true,
      };
    }
    return {
      series: raw.map((p) => ({
        ...p,
        invested: convertAmount(p.invested, txCurrency, priceCurrency, mep)!,
      })),
      investedHidden: false,
    };
  }, [transactions, candles, assetType, needsConversion, txCurrency, priceCurrency, mep]);

  if (transactions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución de tu inversión</CardTitle>
        <CardDescription>
          Valor de tu posición vs. capital invertido desde tu primera compra ·
          la brecha entre ambos es tu resultado
          {needsConversion &&
            !investedHidden &&
            " · capital invertido convertido al MEP actual"}
          {investedHidden &&
            " · sin MEP disponible para convertir el capital invertido"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {series.length > 0 ? (
          <>
            <ChartContainer config={evolutionConfig} className="h-64 w-full">
              <ComposedChart data={series} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tickFormatter={(t) => monthTick.format(new Date(t * 1000))}
                />
                <YAxis
                  tickFormatter={(v) => compactNumber.format(v)}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const time = payload?.[0]?.payload?.time;
                        return time != null
                          ? fullDate.format(new Date(time * 1000))
                          : "";
                      }}
                      formatter={(value, name) => (
                        <span>
                          {
                            evolutionConfig[name as keyof typeof evolutionConfig]
                              ?.label
                          }
                          : {formatMoney(Number(value), priceCurrency)}
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  fill="var(--color-value)"
                  fillOpacity={0.15}
                />
                {!investedHidden && (
                  <Line
                    type="stepAfter"
                    dataKey="invested"
                    stroke="var(--color-invested)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                )}
                <ChartLegend content={<ChartLegendContent />} />
              </ComposedChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Valores en {priceCurrency} (moneda de cotización)
            </p>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Todavía no hay histórico de precios desde tu primera compra.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

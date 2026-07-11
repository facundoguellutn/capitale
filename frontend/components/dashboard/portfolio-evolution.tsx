"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import type { AssetType } from "@/lib/constants";
import { cn, formatMoney } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/display-currency";
import { usePortfolioHistory } from "@/hooks/use-portfolio-history";
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
import { Skeleton } from "@/components/ui/skeleton";

const evolutionConfig = {
  value: { label: "Valor de la cartera", color: "var(--chart-1)" },
  invested: { label: "Capital invertido", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

// Etiquetas cortas para los filtros (las de ASSET_TYPE_LABELS son largas)
const TYPE_LABEL: Record<AssetType | "todos", string> = {
  todos: "Todo",
  accion: "Acciones",
  cedear: "CEDEARs",
  bono: "Bonos",
  letra: "Letras",
  on: "ONs",
  cripto: "Cripto",
};

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

const DAY = 86400;
const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1A", days: 365 },
  { label: "Máx", days: Infinity },
] as const;

const pillBase =
  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors";

export function PortfolioEvolution() {
  const { data, isPending, isError } = usePortfolioHistory();
  const { displayCurrency } = useDisplayCurrency();
  const [rangeDays, setRangeDays] = useState<number>(Infinity);
  const [assetType, setAssetType] = useState<AssetType | "todos">("todos");

  const useUSD = displayCurrency === "USD" && data?.mep != null;

  // Serie del tipo elegido (fallback a "todos" si el filtro ya no tiene datos)
  const selected =
    data?.series.find((s) => s.assetType === assetType) ??
    data?.series.find((s) => s.assetType === "todos") ??
    null;

  const series = useMemo(() => {
    if (!selected || selected.points.length === 0) return [];
    const points = selected.points;
    const cutoff = points[points.length - 1].time - rangeDays * DAY;
    const rate = useUSD ? data!.mep! : 1;
    return points
      .filter((p) => p.time >= cutoff)
      .map((p) => ({
        time: p.time,
        value: p.valueARS / rate,
        invested: p.investedARS / rate,
      }));
  }, [selected, rangeDays, useUSD, data]);

  const currency = useUSD ? "USD" : "ARS";

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Evolución de la cartera</CardTitle>
            <CardDescription>
              Valor de mercado vs. capital invertido · conversión al MEP actual
              {data && data.excludedTickers.length > 0 &&
                ` · sin histórico: ${data.excludedTickers.join(", ")}`}
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-1">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setRangeDays(r.days)}
                className={cn(
                  pillBase,
                  "tabular-nums",
                  rangeDays === r.days
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {data && data.series.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.series.map((s) => (
              <button
                key={s.assetType}
                type="button"
                onClick={() => setAssetType(s.assetType)}
                className={cn(
                  pillBase,
                  assetType === s.assetType
                    ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/60"
                )}
              >
                {TYPE_LABEL[s.assetType]}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : isError ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No se pudo cargar la evolución de la cartera.
          </p>
        ) : series.length > 0 ? (
          <ChartContainer config={evolutionConfig} className="h-72 w-full">
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
                        {evolutionConfig[name as keyof typeof evolutionConfig]?.label}
                        : {formatMoney(Number(value), currency)}
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
              <Line
                type="stepAfter"
                dataKey="invested"
                stroke="var(--color-invested)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Cargá inversiones con histórico de precios para ver la evolución.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

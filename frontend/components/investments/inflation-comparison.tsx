"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useInflation } from "@/hooks/use-inflation";
import { useFxHistory } from "@/hooks/use-fx-history";
import { buildTotalReturnSeries } from "@/lib/total-return";
import type { AssetCandle } from "@/lib/types";
import type { Currency } from "@/lib/constants";
import type { FixedIncomeInstrument } from "@/lib/fixed-income";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type ChartRow = {
  time: number;
  price: number;
  total: number;
  inflation: number;
  real: number;
  interestContribution: number;
  amortizationContribution: number;
};

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "positive" | "brass" }) {
  return <div className="rounded-md bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("font-mono text-lg font-semibold", tone === "positive" && "text-positive", tone === "brass" && "text-brass")}>{pct(value)}</p></div>;
}

export function InflationComparison({ candles, currency, instrument }: {
  candles: AssetCandle[];
  currency: Currency;
  instrument?: FixedIncomeInstrument | null;
}) {
  const [targetCurrency, setTargetCurrency] = useState<Currency>(currency);
  const inflation = useInflation();
  const needsFx = targetCurrency !== currency || (instrument != null && instrument.currency !== targetCurrency);
  const fx = useFxHistory(needsFx);

  const comparison = useMemo(() => {
    const rawCpi = targetCurrency === "ARS" ? inflation.data?.ars : inflation.data?.usd;
    const cpi = rawCpi ? [...rawCpi].sort((a, b) => a.time - b.time) : [];
    if (!cpi.length || candles.length < 2 || (needsFx && !fx.data?.points.length)) return { rows: [] as ChartRow[], hasFlows: false };
    const from = Math.max(candles[0].time, cpi[0].time, candles[candles.length - 1].time - 365 * 86400);
    const selected = candles.filter((c) => c.time >= from);
    if (selected.length < 2) return { rows: [] as ChartRow[], hasFlows: false };
    const end = selected[selected.length - 1].time;
    const applicableFlows = (instrument?.flows ?? []).filter((flow) => {
      const time = Math.floor(new Date(`${flow.date}T00:00:00Z`).getTime() / 1000);
      return time > from && time <= end;
    });
    const returns = buildTotalReturnSeries({
      candles: selected,
      priceCurrency: currency,
      targetCurrency,
      fx: fx.data?.points ?? [],
      cashFlows: applicableFlows.map((flow) => ({
        date: flow.date,
        interest: flow.interest,
        amortization: flow.amortization,
        currency: instrument!.currency,
      })),
    });
    if (!returns.length) return { rows: [] as ChartRow[], hasFlows: false };
    let cpiIndex = 0;
    while (cpiIndex + 1 < cpi.length && cpi[cpiIndex + 1].time <= returns[0].time) cpiIndex++;
    const baseCpi = cpi[cpiIndex].value;
    const rows = returns.map((point) => {
      while (cpiIndex + 1 < cpi.length && cpi[cpiIndex + 1].time <= point.time) cpiIndex++;
      const inflationIndex = cpi[cpiIndex].value / baseCpi * 100;
      return {
        time: point.time * 1000,
        price: point.priceIndex,
        total: point.totalReturnIndex,
        inflation: inflationIndex,
        real: point.totalReturnIndex / inflationIndex * 100,
        interestContribution: point.interestContribution,
        amortizationContribution: point.amortizationContribution,
      };
    });
    return { rows, hasFlows: applicableFlows.length > 0 };
  }, [candles, currency, targetCurrency, inflation.data, fx.data, instrument, needsFx]);

  const latest = comparison.rows.at(-1);
  const pending = inflation.isPending || (needsFx && fx.isPending);
  const title = comparison.hasFlows ? "Retorno total" : "Variación del precio";

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle>Contra la inflación</CardTitle><CardDescription>Base 100 · {title.toLowerCase()} sin reinversión frente al {targetCurrency === "ARS" ? "IPC argentino" : "CPI de Estados Unidos"}</CardDescription></div>
        <div className="flex rounded-md border p-0.5" aria-label="Moneda de comparación">
          {(["ARS", "USD"] as const).map((item) => <Button key={item} size="sm" variant={targetCurrency === item ? "secondary" : "ghost"} onClick={() => setTargetCurrency(item)}>{item}</Button>)}
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {pending ? <Skeleton className="h-80 w-full" /> : comparison.rows.length && latest ? <>
        <div className={cn("mb-5 grid gap-3 text-sm", comparison.hasFlows ? "grid-cols-2 lg:grid-cols-6" : "grid-cols-3")}>
          <Kpi label="Variación del precio" value={latest.price - 100} />
          {comparison.hasFlows && <><Kpi label="Rentas cobradas" value={latest.interestContribution} /><Kpi label="Capital amortizado" value={latest.amortizationContribution} /><Kpi label="Retorno total" value={latest.total - 100} tone="positive" /></>}
          <Kpi label="Inflación acumulada" value={latest.inflation - 100} tone="brass" />
          <Kpi label="Rendimiento real" value={latest.real - 100} />
        </div>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={comparison.rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => new Intl.DateTimeFormat("es-AR", { month: "short" }).format(new Date(v))} />
          <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `${v.toFixed(0)}`} />
          <Tooltip labelFormatter={(v) => new Intl.DateTimeFormat("es-AR").format(new Date(Number(v)))} formatter={(v) => Number(v).toFixed(1)} />
          <Legend />
          <Line dataKey="price" name="Precio" stroke="var(--muted-foreground)" dot={false} strokeWidth={1} />
          <Line dataKey="total" name={title} stroke="var(--chart-2)" dot={false} strokeWidth={2} />
          <Line dataKey="inflation" name="Inflación" stroke="var(--chart-3)" dot={false} strokeWidth={2} connectNulls />
          <Line dataKey="real" name="Poder de compra" stroke="var(--chart-1)" dot={false} strokeDasharray="5 4" />
        </LineChart></ResponsiveContainer></div>
      </> : <p className="py-12 text-center text-sm text-muted-foreground">No hay suficientes datos coincidentes de precio, inflación y tipo de cambio.</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        {comparison.hasFlows ? "Rentas y amortizaciones convertidas con el MEP implícito de cada fecha; los cobros se acumulan sin reinversión. " : "No hay flujos completos disponibles: se muestra sólo el precio. "}
        ARS: IPC Nacional (Datos Argentina/INDEC) · USD: CPI-U (U.S. BLS).
      </p>
    </CardContent>
  </Card>;
}

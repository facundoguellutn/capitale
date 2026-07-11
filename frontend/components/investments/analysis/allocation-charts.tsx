"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle } from "lucide-react";
import { ASSET_TYPE_LABELS } from "@/lib/constants";
import { convertAmount } from "@/lib/fx";
import {
  buildAllocation,
  isDollarExposure,
  topConcentration,
  type AllocationSlice,
} from "@/lib/portfolio-analysis";
import type { ClientFixedTerm, Holding } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--muted-foreground)",
];

const CONCENTRATION_ALERT = 0.3;

function pct(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function Donut({ title, slices }: { title: string; slices: AllocationSlice[] }) {
  if (slices.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Sin datos valuados.
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="valueARS"
              nameKey="label"
              innerRadius="60%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((slice, index) => (
                <Cell key={slice.key} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${formatMoney(Number(value), "ARS")}`, String(name)]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {slices.map((slice, index) => (
          <li key={slice.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              {slice.label}
            </span>
            <span className="font-mono tabular-nums">{pct(slice.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AllocationCharts({
  holdings,
  fixedTerms,
  mep,
}: {
  holdings: Holding[];
  fixedTerms: ClientFixedTerm[];
  mep: number | null;
}) {
  const { byType, byCurrency, concentration } = useMemo(() => {
    const activeTerms = fixedTerms.filter((ft) => ft.status === "activo");

    const byType = buildAllocation([
      ...holdings.map((h) => ({
        key: h.assetType,
        label: ASSET_TYPE_LABELS[h.assetType],
        valueARS: h.valueARS,
      })),
      ...activeTerms.map((ft) => ({
        key: "plazo-fijo",
        label: "Plazo fijo",
        valueARS: convertAmount(ft.accruedValue, ft.currency, "ARS", mep),
      })),
    ]);

    const byCurrency = buildAllocation([
      ...holdings.map((h) => {
        const dollar = isDollarExposure(h);
        return {
          key: dollar ? "usd" : "ars",
          label: dollar ? "Dólar" : "Pesos",
          valueARS: h.valueARS,
        };
      }),
      ...activeTerms.map((ft) => ({
        key: ft.currency === "USD" ? "usd" : "ars",
        label: ft.currency === "USD" ? "Dólar" : "Pesos",
        valueARS: convertAmount(ft.accruedValue, ft.currency, "ARS", mep),
      })),
    ]);

    return { byType, byCurrency, concentration: topConcentration(holdings, 5) };
  }, [holdings, fixedTerms, mep]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composición de la cartera</CardTitle>
        <CardDescription>
          Distribución por tipo de activo y por moneda de exposición, con la concentración de tus
          principales posiciones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-3">
          <Donut title="Por tipo de activo" slices={byType} />
          <Donut title="Por moneda" slices={byCurrency} />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Concentración (top 5)
            </p>
            {concentration.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Sin posiciones valuadas.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {concentration.map((row) => {
                  const alert = row.pct >= CONCENTRATION_ALERT;
                  return (
                    <li key={row.ticker}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          {row.ticker}
                          {alert && (
                            <span className="flex items-center gap-1 text-brass">
                              <AlertTriangle className="size-3.5" />
                            </span>
                          )}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {pct(row.pct)} · {formatMoney(row.valueARS, "ARS")}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", alert ? "bg-brass" : "bg-primary")}
                          style={{ width: `${Math.min(100, row.pct * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {concentration.some((row) => row.pct >= CONCENTRATION_ALERT) && (
              <p className="mt-3 text-xs text-muted-foreground">
                Una posición supera el {pct(CONCENTRATION_ALERT)} de la cartera: diversificar reduce el
                riesgo específico.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

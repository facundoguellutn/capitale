"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useInflation } from "@/hooks/use-inflation";
import type { InflationPoint } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Mode = "mensual" | "interanual" | "acumulada";

const MODE_LABELS: Record<Mode, string> = {
  mensual: "Mensual",
  interanual: "Interanual",
  acumulada: "Acumulada",
};

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  mensual: "variación del índice contra el mes anterior",
  interanual: "variación contra el mismo mes del año anterior",
  acumulada: "inflación acumulada desde el inicio del período",
};

const WINDOW_YEARS = 3;

function pct(value: number, digits = 1) {
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(value);
}

// Series de variación a partir del índice de precios mensual.
function buildRows(ars: InflationPoint[], usd: InflationPoint[], mode: Mode) {
  const compute = (raw: InflationPoint[]) => {
    const points = [...raw].sort((a, b) => a.time - b.time);
    const map = new Map<number, number>();
    if (points.length === 0) return map;
    if (mode === "acumulada") {
      const cutoff = points[points.length - 1].time - WINDOW_YEARS * 365 * 86400;
      const window = points.filter((p) => p.time >= cutoff);
      const base = window[0]?.value;
      if (base && base > 0) {
        for (const point of window) map.set(point.time, point.value / base - 1);
      }
      return map;
    }
    const lag = mode === "mensual" ? 1 : 12;
    for (let i = lag; i < points.length; i++) {
      const prev = points[i - lag].value;
      if (prev > 0) map.set(points[i].time, points[i].value / prev - 1);
    }
    return map;
  };
  const arsMap = compute(ars);
  const usdMap = compute(usd);

  const times = [...new Set([...arsMap.keys(), ...usdMap.keys()])].sort((a, b) => a - b);
  const cutoff = times.length > 0 ? times[times.length - 1] - WINDOW_YEARS * 365 * 86400 : 0;
  return times
    .filter((time) => time >= cutoff)
    .map((time) => ({
      time: time * 1000,
      ars: arsMap.get(time) ?? null,
      usd: usdMap.get(time) ?? null,
    }));
}

export function InflationChart() {
  const inflation = useInflation();
  const [mode, setMode] = useState<Mode>("interanual");

  const rows = useMemo(() => {
    if (!inflation.data) return [];
    return buildRows(inflation.data.ars, inflation.data.usd, mode);
  }, [inflation.data, mode]);

  const latest = rows.at(-1);
  const latestArs = [...rows].reverse().find((r) => r.ars != null)?.ars ?? null;
  const latestUsd = [...rows].reverse().find((r) => r.usd != null)?.usd ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Inflación: Argentina vs Estados Unidos</CardTitle>
            <CardDescription>
              IPC Nacional (INDEC) y CPI-U (BLS) · {MODE_DESCRIPTIONS[mode]}
            </CardDescription>
          </div>
          <div className="flex rounded-md border p-0.5" aria-label="Modo de comparación">
            {(Object.keys(MODE_LABELS) as Mode[]).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={mode === item ? "secondary" : "ghost"}
                onClick={() => setMode(item)}
              >
                {MODE_LABELS[item]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {inflation.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length > 0 && latest ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {latestArs != null && (
                <Badge variant="secondary">
                  Argentina: <span className="font-mono tabular-nums">{pct(latestArs)}</span> último dato
                </Badge>
              )}
              {latestUsd != null && (
                <Badge variant="secondary">
                  EE.UU.: <span className="font-mono tabular-nums">{pct(latestUsd)}</span> último dato
                </Badge>
              )}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) =>
                      new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" }).format(
                        new Date(v)
                      )
                    }
                  />
                  <YAxis tickFormatter={(v) => pct(Number(v), 0)} width={55} />
                  <Tooltip
                    labelFormatter={(v) =>
                      new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
                        new Date(Number(v))
                      )
                    }
                    formatter={(v) => pct(Number(v), 2)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend />
                  <Line
                    dataKey="ars"
                    name="Argentina (IPC)"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    dataKey="usd"
                    name="EE.UU. (CPI)"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Últimos {WINDOW_YEARS} años. El CPI de EE.UU. es la referencia si medís tu cartera en
              dólares; el IPC argentino, si la medís en pesos.
            </p>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay datos de inflación disponibles.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

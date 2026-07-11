"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/display-currency";
import type { DashboardData } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const netWorthConfig = {
  total: { label: "Patrimonio total", color: "var(--chart-2)" },
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

export function NetWorthChart({
  snapshots,
  mep,
}: {
  snapshots: DashboardData["snapshots"];
  mep: number | null;
}) {
  const { displayCurrency } = useDisplayCurrency();
  const useUSD = displayCurrency === "USD" && mep != null;
  const currency = useUSD ? "USD" : "ARS";

  const series = useMemo(
    () =>
      snapshots.map((s) => ({
        time: Math.floor(new Date(s.date).getTime() / 1000),
        total: useUSD ? s.totalUSD : s.totalARS,
      })),
    [snapshots, useUSD]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del patrimonio</CardTitle>
        <CardDescription>Total registrado día a día</CardDescription>
      </CardHeader>
      <CardContent>
        {series.length >= 2 ? (
          <ChartContainer config={netWorthConfig} className="h-64 w-full">
            <AreaChart data={series} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
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
                    formatter={(value) => (
                      <span>
                        Patrimonio: {formatMoney(Number(value), currency)}
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-total)"
                strokeWidth={2}
                fill="var(--color-total)"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            El historial se construye día a día a medida que usás la app.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

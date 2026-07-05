"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/constants";
import { currentMonth, monthLabel } from "@/lib/month";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { useDashboard } from "@/hooks/use-dashboard";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const flowConfig = {
  incomeARS: { label: "Ingresos", color: "var(--chart-2)" },
  expenseARS: { label: "Gastos", color: "var(--chart-6)" },
} satisfies ChartConfig;

const expensesConfig = {
  totalARS: { label: "Gasto", color: "var(--chart-1)" },
} satisfies ChartConfig;

const compactARS = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function DashboardView() {
  const [month, setMonth] = useState(currentMonth());
  const { data, isPending, isError } = useDashboard(month);

  if (isPending) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Resumen de tu patrimonio" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <p className="py-8 text-center text-sm text-destructive">
          Error al cargar el dashboard. Verificá la conexión a la base de datos.
        </p>
      </div>
    );
  }

  const assetTypeData = data.byAssetType.map((entry, i) => ({
    ...entry,
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const assetTypeConfig = Object.fromEntries(
    data.byAssetType.map((entry, i) => [
      entry.name,
      { label: entry.name, color: SLICE_COLORS[i % SLICE_COLORS.length] },
    ])
  ) satisfies ChartConfig;

  const expensesData = data.expensesByCategory.map((entry) => ({
    ...entry,
    label: EXPENSE_CATEGORY_LABELS[entry.category as ExpenseCategory],
  }));

  const flowData = data.monthlyFlow.map((entry) => ({
    ...entry,
    label: monthLabel(entry.month).slice(0, 3),
  }));

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen de tu patrimonio">
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <section className="mb-6 border-b border-border pb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Patrimonio total
            </p>
            <p className="mt-1.5 font-heading text-5xl font-medium tracking-tight tabular-nums">
              {formatMoney(data.totalARS, "ARS")}
            </p>
          </div>
          <dl className="flex divide-x divide-border">
            <div className="pr-8">
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                En dólares (MEP)
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums">
                {formatMoney(data.totalUSD, "USD")}
              </dd>
            </div>
            <div className="pl-8">
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Dólar MEP
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums text-brass">
                {data.mep != null ? formatMoney(data.mep, "ARS") : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por tipo de activo</CardTitle>
            <CardDescription>Valuado en pesos al MEP</CardDescription>
          </CardHeader>
          <CardContent>
            {assetTypeData.length > 0 ? (
              <ChartContainer config={assetTypeConfig} className="mx-auto h-64 w-full">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <span>
                            {name}: {formatMoney(Number(value), "ARS")}
                          </span>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={assetTypeData}
                    dataKey="valueARS"
                    nameKey="name"
                    innerRadius={55}
                    strokeWidth={2}
                    stroke="var(--card)"
                  />
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Cargá cuentas e inversiones para ver la distribución.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por cuenta</CardTitle>
            <CardDescription>Saldos de efectivo por banco/app</CardDescription>
          </CardHeader>
          <CardContent>
            {data.byAccount.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.byAccount.map((account) => {
                  const total = data.byAccount.reduce((s, a) => s + a.valueARS, 0);
                  const share = total > 0 ? account.valueARS / total : 0;
                  return (
                    <div key={account.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{account.name}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatMoney(account.valueARS, "ARS")} ·{" "}
                          {formatPercent(share).replace("+", "")}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[var(--chart-1)]"
                          style={{ width: `${Math.max(2, share * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Sin cuentas con saldo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription>{monthLabel(month)} · en pesos al MEP</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesData.length > 0 ? (
              <ChartContainer config={expensesConfig} className="h-64 w-full">
                <BarChart data={expensesData} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => compactARS.format(v)}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatMoney(Number(value), "ARS")}
                      />
                    }
                  />
                  <Bar
                    dataKey="totalARS"
                    fill="var(--chart-1)"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No hay gastos en {monthLabel(month)}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos vs gastos</CardTitle>
            <CardDescription>Últimos 12 meses · en pesos al MEP</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={flowConfig} className="h-64 w-full">
              <LineChart data={flowData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => compactARS.format(v)}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span>
                          {flowConfig[name as keyof typeof flowConfig]?.label}:{" "}
                          {formatMoney(Number(value), "ARS")}
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="incomeARS"
                  stroke="var(--color-incomeARS)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expenseARS"
                  stroke="var(--color-expenseARS)"
                  strokeWidth={2}
                  dot={false}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rendimiento de inversiones</CardTitle>
          <CardDescription>Costo vs. valor actual (al MEP de hoy)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.holdings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Valor actual</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.holdings.map((holding) => (
                  <TableRow key={holding.ticker}>
                    <TableCell className="font-medium">{holding.ticker}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatMoney(holding.costBasis, holding.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {holding.valueARS != null ? (
                        formatMoney(holding.valueARS, "ARS")
                      ) : (
                        <Badge variant="secondary">Sin cotización</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {holding.pnl != null ? (
                        <span
                          className={cn(
                            "font-medium",
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargá tus inversiones para ver el rendimiento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

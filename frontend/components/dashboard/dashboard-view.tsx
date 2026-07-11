"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { currentMonth, monthLabel } from "@/lib/month";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { convertAmount, formatMoneyIn } from "@/lib/fx";
import { useDisplayCurrency } from "@/components/display-currency";
import { useDashboard } from "@/hooks/use-dashboard";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { AssetLogo } from "@/components/asset-logo";
import { StatCard } from "@/components/stat-card";
import { PortfolioEvolution } from "@/components/dashboard/portfolio-evolution";
import { NetWorthChart } from "@/components/dashboard/net-worth-chart";
import { PortfolioMovers } from "@/components/dashboard/movers-cards";
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

const compactARS = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function DashboardView() {
  const [month, setMonth] = useState(currentMonth());
  const { data, isPending, isError } = useDashboard();
  const { displayCurrency } = useDisplayCurrency();

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

  const mep = data.mep;

  // Monto con signo en la moneda de display (para resultados y variaciones)
  const signedMoney = (ars: number) => {
    const s = formatMoneyIn(ars, "ARS", displayCurrency, mep);
    return ars > 0 ? `+${s}` : s;
  };
  const toneOf = (n: number) =>
    n > 0 ? "positive" : n < 0 ? "negative" : "neutral";

  const kpis = data.portfolioKpis;

  // Ahorro del mes elegido (ingresos − gastos); "—" si está fuera de los 12 meses
  const monthEntry = data.monthlyFlow.find((f) => f.month === month);
  const savingsARS = monthEntry
    ? monthEntry.incomeARS - monthEntry.expenseARS
    : null;
  const savingsRate =
    monthEntry && monthEntry.incomeARS > 0
      ? savingsARS! / monthEntry.incomeARS
      : null;

  // Valores del pie convertidos a la moneda de display (fallback a ARS sin MEP)
  const pieCurrency: "ARS" | "USD" =
    displayCurrency === "USD" && mep != null ? "USD" : "ARS";
  const assetTypeData = data.byAssetType.map((entry, i) => ({
    ...entry,
    valueARS:
      convertAmount(entry.valueARS, "ARS", pieCurrency, mep) ?? entry.valueARS,
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const assetTypeConfig = Object.fromEntries(
    data.byAssetType.map((entry, i) => [
      entry.name,
      { label: entry.name, color: SLICE_COLORS[i % SLICE_COLORS.length] },
    ])
  ) satisfies ChartConfig;

  const flowData = data.monthlyFlow.map((entry) => ({
    ...entry,
    label: monthLabel(entry.month).slice(0, 3),
  }));

  const accountTotal = data.byAccount.reduce((s, a) => s + a.valueARS, 0);

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
              {displayCurrency === "USD" && mep != null
                ? formatMoney(data.totalUSD, "USD")
                : formatMoney(data.totalARS, "ARS")}
            </p>
          </div>
          <dl className="flex divide-x divide-border">
            <div className="pr-8">
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {displayCurrency === "USD" && mep != null
                  ? "En pesos"
                  : "En dólares (MEP)"}
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums">
                {displayCurrency === "USD" && mep != null
                  ? formatMoney(data.totalARS, "ARS")
                  : formatMoney(data.totalUSD, "USD")}
              </dd>
            </div>
            <div className="pl-8">
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Dólar MEP
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums text-brass">
                {mep != null ? formatMoney(mep, "ARS") : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Valor de cartera"
          value={formatMoneyIn(kpis.valueARS, "ARS", displayCurrency, mep)}
          sub={`Invertido: ${formatMoneyIn(kpis.investedARS, "ARS", displayCurrency, mep)}`}
        />
        <StatCard
          label="Resultado total"
          value={signedMoney(kpis.pnlARS)}
          tone={toneOf(kpis.pnlARS)}
          sub={kpis.pnlPct != null ? formatPercent(kpis.pnlPct) : undefined}
        />
        <StatCard
          label="Variación hoy"
          value={signedMoney(kpis.dayChangeARS)}
          tone={toneOf(kpis.dayChangeARS)}
          sub={
            kpis.dayChangePct != null ? formatPercent(kpis.dayChangePct) : undefined
          }
        />
        <StatCard
          label={`Ahorro de ${monthLabel(month)}`}
          value={savingsARS != null ? signedMoney(savingsARS) : "—"}
          tone={savingsARS != null ? toneOf(savingsARS) : "neutral"}
          sub={
            savingsRate != null
              ? `Tasa de ahorro: ${formatPercent(savingsRate)}`
              : undefined
          }
        />
      </div>

      <PortfolioEvolution />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <NetWorthChart snapshots={data.snapshots} mep={mep} />

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

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por cuenta</CardTitle>
            <CardDescription>Efectivo + inversiones por cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            {data.byAccount.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.byAccount.map((account) => {
                  const share =
                    accountTotal > 0 ? account.valueARS / accountTotal : 0;
                  const hasBoth =
                    account.cashARS > 0 && account.investmentsARS > 0;
                  return (
                    <div key={account.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{account.name}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatMoneyIn(
                            account.valueARS,
                            "ARS",
                            displayCurrency,
                            mep
                          )}{" "}
                          · {formatPercent(share).replace("+", "")}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[var(--chart-1)]"
                          style={{ width: `${Math.max(2, share * 100)}%` }}
                        />
                      </div>
                      {hasBoth && (
                        <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                          Efectivo{" "}
                          {formatMoneyIn(
                            account.cashARS,
                            "ARS",
                            displayCurrency,
                            mep
                          )}{" "}
                          · Inversiones{" "}
                          {formatMoneyIn(
                            account.investmentsARS,
                            "ARS",
                            displayCurrency,
                            mep
                          )}
                        </p>
                      )}
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

        <Card>
          <CardHeader>
            <CardTitle>Distribución por tipo de activo</CardTitle>
            <CardDescription>
              Valuado en {pieCurrency === "ARS" ? "pesos" : "dólares"} al MEP
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assetTypeData.length > 0 ? (
              <ChartContainer
                config={assetTypeConfig}
                className="mx-auto h-64 w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <span>
                            {name}: {formatMoney(Number(value), pieCurrency)}
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
      </div>

      <div className="mb-4">
        <PortfolioMovers holdings={data.holdings} mep={mep} />
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
                  <TableHead className="text-right">Hoy</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.holdings.map((holding) => (
                  <TableRow key={holding.ticker}>
                    <TableCell className="p-0 font-medium">
                      <Link
                        href={`/inversiones/${encodeURIComponent(holding.ticker)}?type=${holding.assetType}${holding.coingeckoId ? `&coingeckoId=${encodeURIComponent(holding.coingeckoId)}` : ""}`}
                        className="flex items-center gap-2 px-2 py-2 hover:underline"
                      >
                        <AssetLogo
                          ticker={holding.ticker}
                          assetType={holding.assetType}
                        />
                        {holding.ticker}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatMoneyIn(
                        holding.costBasis,
                        holding.currency,
                        displayCurrency,
                        mep
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {(() => {
                        const value =
                          displayCurrency === "ARS"
                            ? holding.valueARS
                            : holding.valueUSD;
                        if (value != null)
                          return formatMoney(value, displayCurrency);
                        if (holding.valueARS != null)
                          return formatMoney(holding.valueARS, "ARS");
                        return <Badge variant="secondary">Sin cotización</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {holding.pctChange != null ? (
                        <span
                          className={cn(
                            "font-medium",
                            holding.pctChange >= 0
                              ? "text-positive"
                              : "text-negative"
                          )}
                        >
                          {formatPercent(holding.pctChange / 100)}
                        </span>
                      ) : (
                        "—"
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

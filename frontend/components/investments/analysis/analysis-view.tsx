"use client";

import { useFixedTerms, useInvestments } from "@/hooks/use-investments";
import { PortfolioKpis } from "@/components/investments/analysis/portfolio-kpis";
import { AllocationCharts } from "@/components/investments/analysis/allocation-charts";
import { RealReturns } from "@/components/investments/analysis/real-returns";
import { InflationChart } from "@/components/investments/analysis/inflation-chart";
import { IncomeCalendar } from "@/components/investments/analysis/income-calendar";
import { RateCalculator } from "@/components/investments/analysis/rate-calculator";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalysisView() {
  const { data, isPending } = useInvestments();
  const { data: fixedTerms, isPending: ftPending } = useFixedTerms();

  if (isPending || ftPending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const holdings = data?.holdings ?? [];
  const transactions = data?.transactions ?? [];
  const mep = data?.mep ?? null;
  const terms = fixedTerms ?? [];

  if (holdings.length === 0 && terms.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Registrá operaciones o plazos fijos para analizar tu cartera.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PortfolioKpis holdings={holdings} fixedTerms={terms} mep={mep} />
      <AllocationCharts holdings={holdings} fixedTerms={terms} mep={mep} />
      <RealReturns holdings={holdings} transactions={transactions} mep={mep} />
      <div className="grid gap-4 xl:grid-cols-2">
        <InflationChart />
        <IncomeCalendar holdings={holdings} fixedTerms={terms} mep={mep} />
      </div>
      <RateCalculator holdings={holdings} fixedTerms={terms} mep={mep} />
    </div>
  );
}

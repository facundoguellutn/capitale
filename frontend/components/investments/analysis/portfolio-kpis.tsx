"use client";

import { useMemo } from "react";
import { Banknote, CalendarClock, DollarSign, Percent, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { convertAmount } from "@/lib/fx";
import { summarizeFixedIncome } from "@/lib/portfolio-analysis";
import { isDollarExposure } from "@/lib/portfolio-analysis";
import type { ClientFixedTerm, Holding } from "@/lib/types";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

function pctPlain(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </p>
        <p
          className={cn(
            "mt-1.5 font-mono text-xl font-semibold tabular-nums",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative"
          )}
        >
          {value}
        </p>
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export function PortfolioKpis({
  holdings,
  fixedTerms,
  mep,
}: {
  holdings: Holding[];
  fixedTerms: ClientFixedTerm[];
  mep: number | null;
}) {
  const kpis = useMemo(() => {
    const activeTerms = fixedTerms.filter((ft) => ft.status === "activo");

    const holdingsARS = holdings.reduce((sum, h) => sum + (h.valueARS ?? 0), 0);
    const termsARS = activeTerms.reduce(
      (sum, ft) => sum + (convertAmount(ft.accruedValue, ft.currency, "ARS", mep) ?? 0),
      0
    );
    const totalARS = holdingsARS + termsARS;
    const totalUSD = mep != null ? totalARS / mep : null;

    // Costo al MEP actual, espejo del criterio de valueHoldings
    let investedARS = 0;
    for (const h of holdings) {
      const cost = convertAmount(h.costBasis, h.currency, "ARS", mep);
      if (cost != null) investedARS += cost;
    }
    const pnlARS = holdingsARS - investedARS;
    const pnlPct = investedARS > 0 ? pnlARS / investedARS : null;

    let dollarARS = 0;
    for (const h of holdings) {
      if (h.valueARS != null && isDollarExposure(h)) dollarARS += h.valueARS;
    }
    for (const ft of activeTerms) {
      if (ft.currency === "USD") {
        dollarARS += convertAmount(ft.accruedValue, "USD", "ARS", mep) ?? 0;
      }
    }
    const dollarPct = totalARS > 0 ? dollarARS / totalARS : null;

    const fixedIncome = summarizeFixedIncome({ holdings, fixedTerms, mep });

    return { totalARS, totalUSD, investedARS, pnlARS, pnlPct, dollarPct, fixedIncome };
  }, [holdings, fixedTerms, mep]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Kpi
        icon={Wallet}
        label="Valor total"
        value={formatMoney(kpis.totalARS, "ARS")}
        detail={
          kpis.totalUSD != null
            ? `${formatMoney(kpis.totalUSD, "USD")} MEP · incluye plazos fijos`
            : "incluye plazos fijos"
        }
      />
      <Kpi
        icon={TrendingUp}
        label="Resultado no realizado"
        value={formatMoney(kpis.pnlARS, "ARS")}
        detail={
          kpis.pnlPct != null
            ? `${formatPercent(kpis.pnlPct)} sobre ${formatMoney(kpis.investedARS, "ARS")} invertidos`
            : undefined
        }
        tone={kpis.pnlARS >= 0 ? "positive" : "negative"}
      />
      <Kpi
        icon={DollarSign}
        label="Cartera dolarizada"
        value={kpis.dollarPct != null ? pctPlain(kpis.dollarPct) : "—"}
        detail="USD, hard-dollar y cripto"
      />
      <Kpi
        icon={Banknote}
        label="Renta anual proyectada"
        value={formatMoney(kpis.fixedIncome.annualInterestARS, "ARS")}
        detail="Cupones 12 meses + interés de plazos fijos"
      />
      <Kpi
        icon={Percent}
        label="TIR renta fija"
        value={kpis.fixedIncome.weightedYtm != null ? pctPlain(kpis.fixedIncome.weightedYtm) : "—"}
        detail="Promedio ponderado por valuación"
      />
      <Kpi
        icon={CalendarClock}
        label="Duration renta fija"
        value={
          kpis.fixedIncome.weightedDuration != null
            ? `${kpis.fixedIncome.weightedDuration.toFixed(2)} años`
            : "—"
        }
        detail={`${kpis.fixedIncome.count} instrumento${kpis.fixedIncome.count === 1 ? "" : "s"} con flujos`}
      />
    </div>
  );
}

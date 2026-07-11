"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock } from "lucide-react";
import {
  collectUpcomingPayments,
  projectMonthlyIncome,
  PAYMENT_KIND_LABELS,
} from "@/lib/portfolio-analysis";
import type { ClientFixedTerm, Holding } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const compactARS = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const monthLabel = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const PREVIEW_COUNT = 6;

function DaysBadge({ days }: { days: number }) {
  const text = days === 0 ? "Hoy" : days === 1 ? "Mañana" : `${days.toLocaleString("es-AR")} días`;
  return (
    <Badge variant="secondary">
      <Clock className="size-3.5" /> {text}
    </Badge>
  );
}

export function IncomeCalendar({
  holdings,
  fixedTerms,
  mep,
}: {
  holdings: Holding[];
  fixedTerms: ClientFixedTerm[];
  mep: number | null;
}) {
  const [showAll, setShowAll] = useState(false);

  const { payments, monthly, totalNextYearARS } = useMemo(() => {
    const payments = collectUpcomingPayments({ holdings, fixedTerms, mep });
    const monthly = projectMonthlyIncome(payments, 12);
    return {
      payments,
      monthly,
      totalNextYearARS: monthly.reduce((sum, m) => sum + m.totalARS, 0),
    };
  }, [holdings, fixedTerms, mep]);

  const visible = showAll ? payments : payments.slice(0, PREVIEW_COUNT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos cobros</CardTitle>
        <CardDescription>
          Cupones y amortizaciones de tu renta fija más los vencimientos de plazos fijos, con la
          proyección mensual del próximo año
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {payments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay cobros futuros: cargá bonos, letras o plazos fijos para ver el calendario.
          </p>
        ) : (
          <>
            <div>
              <ul className="divide-y">
                {visible.map((payment, index) => (
                  <li
                    key={`${payment.source}-${payment.date}-${payment.kind}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {payment.source}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {PAYMENT_KIND_LABELS[payment.kind]}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(payment.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <DaysBadge days={payment.days} />
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold tabular-nums">
                          {formatMoney(payment.amount, payment.currency)}
                        </p>
                        {payment.currency !== "ARS" && payment.amountARS != null && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            ≈ {formatMoney(payment.amountARS, "ARS")}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {payments.length > PREVIEW_COUNT && (
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Mostrar menos" : `Ver los ${payments.length} cobros`}
                </Button>
              )}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Proyección mensual (12 meses)
                </p>
                <p className="text-xs text-muted-foreground">
                  Total próximo año:{" "}
                  <span className={cn("font-mono font-semibold tabular-nums text-foreground")}>
                    {formatMoney(totalNextYearARS, "ARS")}
                  </span>
                </p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(t) => monthLabel.format(new Date(Number(t) * 1000))}
                    />
                    <YAxis tickFormatter={(v) => compactARS.format(Number(v))} width={55} />
                    <Tooltip
                      labelFormatter={(t) =>
                        new Intl.DateTimeFormat("es-AR", {
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        }).format(new Date(Number(t) * 1000))
                      }
                      formatter={(v) => formatMoney(Number(v), "ARS")}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="interestARS"
                      name="Renta (cupones)"
                      stackId="income"
                      fill="var(--chart-2)"
                    />
                    <Bar
                      dataKey="amortizationARS"
                      name="Amortización"
                      stackId="income"
                      fill="var(--chart-3)"
                    />
                    <Bar
                      dataKey="fixedTermARS"
                      name="Plazos fijos"
                      stackId="income"
                      fill="var(--chart-1)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Montos en ARS al MEP actual. Sólo AL30/GD30 tienen cronograma de cupones cargado; de las
          letras se proyecta la redención al vencimiento (inferida del ticker) y las obligaciones
          negociables todavía no tienen flujos en el catálogo.
        </p>
      </CardContent>
    </Card>
  );
}

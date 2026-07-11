"use client";

import { Fragment, useState, type ReactNode } from "react";
import { CalendarClock, ChevronDown, Clock, Info, Landmark } from "lucide-react";
import type { Currency } from "@/lib/constants";
import {
  daysUntil,
  fixedIncomeMetrics,
  futureFlows,
  zeroCouponYield,
  type FixedIncomeCashFlow,
  type FixedIncomeInstrument,
} from "@/lib/fixed-income";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Porcentaje sin el signo "+" que fuerza formatPercent: para tasas de un cobro
// futuro el signo confunde más de lo que ayuda.
function pct(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 2 }).format(value);
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

const HELP = {
  tna: "Tasa Nominal Anual: proyecta linealmente la ganancia del período a 365 días, sin reinvertir intereses.",
  tea: "Tasa Efectiva Anual: rendimiento equivalente a un año componiendo la ganancia. Es lo comparable con un plazo fijo.",
  tir: "Tasa Interna de Retorno anual estimada con el último precio disponible, sin impuestos ni comisiones.",
  parity: "Paridad: precio dividido el valor técnico. Menor a 100% significa que cotiza bajo la par.",
  technical: "Valor técnico: capital que todavía no se amortizó más los intereses corridos, por cada 100 nominales.",
  residual: "Capital residual: porcentaje del capital original que todavía no te devolvieron.",
  duration: "Duration: plazo promedio de los flujos en años, ponderado por valor presente. A mayor duration, más sensible es el precio a cambios de tasa.",
  remaining: "Suma de renta y capital que todavía te queda por cobrar hasta el vencimiento, según tu tenencia.",
  amortization: "Amortización: devolución del capital. Muchos bonos lo devuelven de a partes en cada cobro, no todo al final.",
} as const;

type PanelProps = {
  instrument: FixedIncomeInstrument;
  price: number | null;
  quantity: number;
  factor: number;
};

function Help({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex cursor-help text-muted-foreground/60 hover:text-foreground">
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

function MetricWithHelp({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label} <Help text={help} />
      </dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function DaysBadge({ days }: { days: number }) {
  const text = days < 0 ? "Vencida" : days === 0 ? "Vence hoy" : `Faltan ${days.toLocaleString("es-AR")} días`;
  return (
    <Badge variant="secondary">
      <Clock className="size-3.5" /> {text}
    </Badge>
  );
}

function classifyFlow(flow: FixedIncomeCashFlow, isFinal: boolean) {
  if (isFinal) return "Pago final";
  if (flow.interest > 0 && flow.amortization > 0) return "Renta + amortización";
  if (flow.amortization > 0) return "Amortización";
  return "Renta (cupón)";
}

// Letras / bonos cero cupón: un único flujo al vencimiento. El interés es el
// descuento, así que mostramos la economía de la operación en lugar de "Renta $0".
function LetraPanel({ instrument, price, quantity, factor }: PanelProps) {
  const flow = instrument.flows[instrument.flows.length - 1];
  const days = daysUntil(instrument.maturityDate);
  const yields = price != null ? zeroCouponYield(price, days) : null;
  const metrics = price != null ? fixedIncomeMetrics(instrument, price) : null;
  const redemption = flow.interest + flow.amortization; // 100 por cada 100 nominales
  const investment = price != null ? price * factor : null;
  const gain = price != null ? (redemption - price) * factor : null;
  const isCer = instrument.kind === "cer";

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="flex flex-col gap-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <CalendarClock className="size-4" /> Vencimiento
            </p>
            <p className="mt-3 font-heading text-3xl">{formatDate(instrument.maturityDate)}</p>
            <div className="mt-2">
              <DaysBadge days={days} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Para tus {quantity.toLocaleString("es-AR")} nominales
            </p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Inversión</p>
              <p className="font-mono font-semibold tabular-nums">
                {investment != null ? formatMoney(investment, instrument.currency) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total a cobrar</p>
              <p className="font-mono font-semibold tabular-nums text-primary">
                {formatMoney(redemption * factor, instrument.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ganancia</p>
              <p className="font-mono font-semibold tabular-nums text-positive">
                {gain != null ? formatMoney(gain, instrument.currency) : "—"}
              </p>
              {yields && <p className="text-[11px] text-muted-foreground">{pct(yields.totalReturn)} directo</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Rendimiento</CardTitle>
              <CardDescription>
                El interés de una letra es el descuento: pagás menos de 100 y cobrás 100 al vencer
              </CardDescription>
            </div>
            <Badge variant="outline">
              <Landmark /> Vence {formatDate(instrument.maturityDate)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <MetricWithHelp label="TNA" help={HELP.tna}>{yields ? pct(yields.tna) : "—"}</MetricWithHelp>
            <MetricWithHelp label="TEA" help={HELP.tea}>{yields ? pct(yields.tea) : "—"}</MetricWithHelp>
            <MetricWithHelp label="TIR" help={HELP.tir}>
              {metrics?.ytm != null ? pct(metrics.ytm) : "—"}
            </MetricWithHelp>
            <MetricWithHelp label="Paridad" help={HELP.parity}>
              {metrics ? pct(metrics.parity) : "—"}
            </MetricWithHelp>
          </dl>

          {price == null && (
            <p className="text-xs text-muted-foreground">Sin cotización disponible para estimar el rendimiento.</p>
          )}

          <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {price != null
              ? `En una letra no hay cupones: pagás ${formatMoney(price, instrument.currency)} y cobrás ${formatMoney(redemption, instrument.currency)} por cada 100 nominales al vencimiento. Esa diferencia es tu interés.`
              : "En una letra no hay cupones: el interés es el descuento con el que la comprás y cobrás su valor nominal (100) al vencer."}
            {isCer &&
              " El capital ajusta por CER (inflación), así que el monto final en pesos será mayor: estas tasas son reales, por encima de la inflación."}
          </p>

          <p className="text-xs text-muted-foreground">Fuente: {instrument.source}. Estimación sin impuestos ni comisiones.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Bonos con múltiples flujos (cupón + amortización).
function BonoPanel({ instrument, price, quantity, factor }: PanelProps) {
  const [showTable, setShowTable] = useState(false);
  const flows = futureFlows(instrument);
  const next = flows[0];
  const metrics = price != null ? fixedIncomeMetrics(instrument, price) : null;

  if (!next) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Este título ya venció: no quedan cobros pendientes.
        </CardContent>
      </Card>
    );
  }

  const days = daysUntil(next.date);
  const isFinal = next.date === instrument.maturityDate;
  const residualNow = next.residualAfter + next.amortization;
  const amortizedPct = (100 - residualNow) / 100;
  const totalInterest = flows.reduce((sum, f) => sum + f.interest, 0);
  const totalAmortization = flows.reduce((sum, f) => sum + f.amortization, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="flex flex-col gap-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <CalendarClock className="size-4" /> Próximo cobro
            </p>
            <p className="mt-3 font-heading text-3xl">{formatDate(next.date)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <DaysBadge days={days} />
              <Badge variant="outline">{classifyFlow(next, isFinal)}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Para tus {quantity.toLocaleString("es-AR")} nominales
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Vas a cobrar</p>
            <p className="mt-1 font-heading text-4xl tabular-nums text-primary">
              {formatMoney((next.interest + next.amortization) * factor, instrument.currency)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {next.amortization > 0 ? (
                <>
                  Renta {formatMoney(next.interest * factor, instrument.currency)} + Amortización{" "}
                  {formatMoney(next.amortization * factor, instrument.currency)}
                </>
              ) : (
                <>Cupón de renta</>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Calendario de cobros</CardTitle>
              <CardDescription>Renta y devolución de capital por cada 100 nominales</CardDescription>
            </div>
            <Badge variant="outline">
              <Landmark /> Vence {formatDate(instrument.maturityDate)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sección 1 — Lo que te falta cobrar (mi posición restante) */}
          <section className="space-y-4">
            <SectionLabel>Lo que te falta cobrar</SectionLabel>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <MetricWithHelp label="Te falta cobrar" help={HELP.remaining}>
                {formatMoney((totalInterest + totalAmortization) * factor, instrument.currency)}
              </MetricWithHelp>
              <div>
                <dt className="text-xs text-muted-foreground">Renta restante</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
                  {formatMoney(totalInterest * factor, instrument.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Capital a devolver</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
                  {formatMoney(totalAmortization * factor, instrument.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Cobros pendientes</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{flows.length}</dd>
              </div>
            </dl>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  Amortización del capital <Help text={HELP.amortization} />
                </span>
                <span className="font-mono tabular-nums">{pct(amortizedPct)} devuelto</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brass"
                  style={{ width: `${Math.min(100, Math.max(0, amortizedPct * 100))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Residual {residualNow.toFixed(2)} por cada 100 nominales
              </p>
            </div>
          </section>

          <Separator />

          {/* Sección 2 — Cronograma de pagos */}
          <section className="space-y-4">
            <SectionLabel>Cronograma de pagos</SectionLabel>
            {flows.length > 0 && (
              <div className="space-y-3">
                <div className="flex w-full items-start pt-4 pb-2">
                  {flows.slice(0, 10).map((flow, index) => {
                    const final = flow.date === instrument.maturityDate;
                    const color = final ? "bg-primary" : flow.amortization > 0 ? "bg-brass" : "bg-muted-foreground";
                    return (
                      <Fragment key={flow.date}>
                        {index > 0 && <div className="mt-3 h-px min-w-1 flex-1 bg-border" />}
                        <div className="flex shrink-0 flex-col items-center text-center">
                          <span
                            className={cn(
                              "block size-6 rounded-full border-4 border-card",
                              color,
                              index === 0 && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                            )}
                          />
                          <p className="mt-2 text-xs font-medium">{monthLabel(flow.date)}</p>
                          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {(flow.interest + flow.amortization).toFixed(2)}
                          </p>
                        </div>
                      </Fragment>
                    );
                  })}
                  {flows.length > 10 && (
                    <>
                      <div className="mt-3 h-px min-w-1 flex-1 bg-border" />
                      <div className="shrink-0 self-center text-center text-xs text-muted-foreground">
                        +{flows.length - 10} más
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-muted-foreground" /> Sólo renta
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-brass" /> Con amortización
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-primary" /> Pago final
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? "Ocultar detalle" : "Ver detalle completo"}
                <ChevronDown className={cn("transition-transform", showTable && "rotate-180")} />
              </Button>
              <span className="text-[11px] text-muted-foreground">Montos por cada 100 nominales</span>
            </div>

            {showTable && (
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Renta</TableHead>
                      <TableHead className="text-right">Amortización</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Residual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flows.map((flow, index) => (
                      <TableRow key={flow.date} className={index === 0 ? "bg-muted/40" : undefined}>
                        <TableCell>{formatDate(flow.date)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{flow.interest.toFixed(3)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {flow.amortization.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {(flow.interest + flow.amortization).toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {flow.residualAfter.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <Separator />

          {/* Sección 3 — Indicadores de mercado */}
          <section className="space-y-4">
            <SectionLabel>Indicadores de mercado</SectionLabel>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
              <MetricWithHelp label="TIR" help={HELP.tir}>
                {metrics?.ytm != null ? pct(metrics.ytm) : "—"}
              </MetricWithHelp>
              <MetricWithHelp label="Paridad" help={HELP.parity}>
                {metrics ? pct(metrics.parity) : "—"}
              </MetricWithHelp>
              <MetricWithHelp label="Valor técnico" help={HELP.technical}>
                {metrics ? metrics.technicalValue.toFixed(2) : "—"}
              </MetricWithHelp>
              <MetricWithHelp label="Capital residual" help={HELP.residual}>
                {metrics ? `${metrics.residual.toFixed(2)}%` : "—"}
              </MetricWithHelp>
              <MetricWithHelp label="Duration" help={HELP.duration}>
                {metrics?.durationYears != null ? `${metrics.durationYears.toFixed(2)} años` : "—"}
              </MetricWithHelp>
            </dl>
            <p className="text-xs text-muted-foreground">
              Fuente: {instrument.source}. TIR estimada con el último precio disponible, sin impuestos ni comisiones.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

export function FixedIncomePanel({
  instrument,
  price,
  quantity = 100,
}: {
  instrument: FixedIncomeInstrument;
  price: number | null;
  quantity?: number;
}) {
  const factor = quantity / 100;
  // Una letra tiene un único flujo terminal; un bono, varios cupones.
  const isLetra = instrument.flows.length === 1;
  return isLetra ? (
    <LetraPanel instrument={instrument} price={price} quantity={quantity} factor={factor} />
  ) : (
    <BonoPanel instrument={instrument} price={price} quantity={quantity} factor={factor} />
  );
}

"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { daysUntil, getFixedIncomeInstrument, zeroCouponYield } from "@/lib/fixed-income";
import {
  breakevenMep,
  compoundFinal,
  fixedTermSimpleFinal,
  impliedTea,
} from "@/lib/portfolio-analysis";
import type { ClientFixedTerm, Holding } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function pct(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

type LetraOption = {
  ticker: string;
  tea: number;
  maturityDate: string;
  daysToMaturity: number;
};

type Alternative = {
  key: string;
  title: string;
  detail: string;
  finalValue: number;
  tea: number | null;
};

const MANUAL = "__manual__";

export function RateCalculator({
  holdings,
  fixedTerms,
  mep,
}: {
  holdings: Holding[];
  fixedTerms: ClientFixedTerm[];
  mep: number | null;
}) {
  // TNA promedio de tus plazos fijos activos en pesos como punto de partida
  const defaultTna = useMemo(() => {
    const active = fixedTerms.filter((ft) => ft.status === "activo" && ft.currency === "ARS");
    if (active.length === 0) return 30;
    return Math.round(active.reduce((sum, ft) => sum + ft.tna, 0) / active.length);
  }, [fixedTerms]);

  const letras: LetraOption[] = useMemo(() => {
    const options: LetraOption[] = [];
    for (const holding of holdings) {
      if (holding.assetType !== "letra" || holding.currentPrice == null) continue;
      const instrument = getFixedIncomeInstrument(holding.ticker, holding.assetType);
      if (!instrument) continue;
      const days = daysUntil(instrument.maturityDate);
      if (days <= 0) continue;
      const yields = zeroCouponYield(holding.currentPrice, days);
      if (!yields) continue;
      options.push({
        ticker: holding.ticker,
        tea: yields.tea,
        maturityDate: instrument.maturityDate,
        daysToMaturity: days,
      });
    }
    return options.sort((a, b) => b.tea - a.tea);
  }, [holdings]);

  const [amountText, setAmountText] = useState("1000000");
  const [daysText, setDaysText] = useState("90");
  const [tnaText, setTnaText] = useState(String(defaultTna));
  const [letraKey, setLetraKey] = useState<string>(letras[0]?.ticker ?? MANUAL);
  const [temText, setTemText] = useState("3");

  const amount = Number(amountText) || 0;
  const days = Math.max(0, Math.floor(Number(daysText) || 0));
  const tna = Number(tnaText) || 0;
  const tem = Number(temText) || 0;

  const selectedLetra = letras.find((l) => l.ticker === letraKey) ?? null;

  const alternatives: Alternative[] = useMemo(() => {
    if (amount <= 0 || days <= 0) return [];
    const list: Alternative[] = [];

    const ftFinal = fixedTermSimpleFinal(amount, tna, days);
    list.push({
      key: "plazo-fijo",
      title: "Plazo fijo",
      detail: `TNA ${tna.toLocaleString("es-AR")}% · interés simple`,
      finalValue: ftFinal,
      tea: impliedTea(amount, ftFinal, days),
    });

    if (selectedLetra) {
      const final = compoundFinal(amount, selectedLetra.tea, days);
      list.push({
        key: "lecap",
        title: `Letra ${selectedLetra.ticker}`,
        detail: `TEA ${pct(selectedLetra.tea)} al precio actual · vence ${selectedLetra.maturityDate}`,
        finalValue: final,
        tea: selectedLetra.tea,
      });
    } else {
      const tea = (1 + tem / 100) ** 12 - 1;
      const final = compoundFinal(amount, tea, days);
      list.push({
        key: "lecap",
        title: "Letra (TEM manual)",
        detail: `TEM ${tem.toLocaleString("es-AR")}% ≈ TEA ${pct(tea)}`,
        finalValue: final,
        tea,
      });
    }

    return list;
  }, [amount, days, tna, selectedLetra, tem]);

  const bestKey = useMemo(() => {
    if (alternatives.length === 0) return null;
    return alternatives.reduce((best, alt) => (alt.finalValue > best.finalValue ? alt : best))
      .key;
  }, [alternatives]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora: plazo fijo vs letra vs dólar</CardTitle>
        <CardDescription>
          Cuánto termina valiendo tu plata en cada alternativa y a qué precio tendría que llegar el
          MEP para que dolarizarse hubiera convenido más
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="calc-amount">Monto (ARS)</Label>
            <Input
              id="calc-amount"
              type="number"
              min={0}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-days">Plazo (días)</Label>
            <Input
              id="calc-days"
              type="number"
              min={1}
              value={daysText}
              onChange={(e) => setDaysText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-tna">TNA plazo fijo (%)</Label>
            <Input
              id="calc-tna"
              type="number"
              min={0}
              value={tnaText}
              onChange={(e) => setTnaText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Letra de referencia</Label>
            <div className="flex gap-2">
              <Select value={letraKey} onValueChange={(v) => setLetraKey(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {letras.map((letra) => (
                    <SelectItem key={letra.ticker} value={letra.ticker}>
                      {letra.ticker} · TEA {pct(letra.tea)}
                    </SelectItem>
                  ))}
                  <SelectItem value={MANUAL}>TEM manual</SelectItem>
                </SelectContent>
              </Select>
              {letraKey === MANUAL && (
                <Input
                  aria-label="TEM manual (%)"
                  type="number"
                  min={0}
                  step={0.1}
                  className="w-24"
                  value={temText}
                  onChange={(e) => setTemText(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        {alternatives.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ingresá un monto y un plazo para comparar.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {alternatives.map((alt) => {
              const isBest = alt.key === bestKey;
              const gain = alt.finalValue - amount;
              const breakeven = mep != null ? breakevenMep(amount, alt.finalValue, mep) : null;
              return (
                <div
                  key={alt.key}
                  className={cn(
                    "rounded-lg border p-4",
                    isBest && "border-primary/40 bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{alt.title}</p>
                    {isBest && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <Trophy className="size-3.5" /> Mejor opción
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alt.detail}</p>
                  <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">
                    {formatMoney(alt.finalValue, "ARS")}
                  </p>
                  <p className="text-sm text-positive tabular-nums">
                    +{formatMoney(gain, "ARS")}
                    {alt.tea != null && (
                      <span className="ml-2 text-xs text-muted-foreground">TEA {pct(alt.tea)}</span>
                    )}
                  </p>
                  {breakeven != null && mep != null && (
                    <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                      Empata con el dólar si el MEP llega a{" "}
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatMoney(breakeven, "ARS")}
                      </span>{" "}
                      ({pct(breakeven / mep - 1)} desde {formatMoney(mep, "ARS")}). Si sube menos,
                      ganás en pesos.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          La letra se proyecta capitalizando su TEA al plazo elegido (si el plazo difiere del
          vencimiento, es una aproximación con reinversión a la misma tasa). Sin impuestos ni
          comisiones.
        </p>
      </CardContent>
    </Card>
  );
}

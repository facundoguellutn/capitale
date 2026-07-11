"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ASSET_TYPE_LABELS, type Currency } from "@/lib/constants";
import { useInflation } from "@/hooks/use-inflation";
import { useFxHistory } from "@/hooks/use-fx-history";
import {
  computeRealReturns,
  shareBeatingInflation,
  type RealReturnRow,
} from "@/lib/portfolio-analysis";
import type { ClientInvestmentTransaction, Holding } from "@/lib/types";
import { cn, formatDate, formatPercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function pctShort(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export function RealReturns({
  holdings,
  transactions,
  mep,
}: {
  holdings: Holding[];
  transactions: ClientInvestmentTransaction[];
  mep: number | null;
}) {
  const [targetCurrency, setTargetCurrency] = useState<Currency>("ARS");
  const inflation = useInflation();
  const needsFx = holdings.some((h) => h.currency !== targetCurrency);
  const fx = useFxHistory(needsFx);

  const rows: RealReturnRow[] = useMemo(() => {
    const cpi = targetCurrency === "ARS" ? inflation.data?.ars : inflation.data?.usd;
    if (!cpi?.length) return [];
    return computeRealReturns({
      holdings,
      transactions,
      cpi,
      targetCurrency,
      fx: fx.data?.points ?? [],
      mep,
    });
  }, [holdings, transactions, inflation.data, targetCurrency, fx.data, mep]);

  const beating = useMemo(() => shareBeatingInflation(rows), [rows]);
  const pending = inflation.isPending || (needsFx && fx.isPending);

  const chartRows = useMemo(
    () =>
      rows.map((row) => ({
        ticker: row.ticker,
        real: row.real * 100,
        beats: row.beatsInflation,
      })),
    [rows]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Rendimiento real contra la inflación</CardTitle>
            <CardDescription>
              Retorno de cada posición desde su fecha de compra (promedio ponderado) descontando la
              inflación {targetCurrency === "ARS" ? "argentina (IPC)" : "de EE.UU. (CPI)"} del período
            </CardDescription>
          </div>
          <div className="flex rounded-md border p-0.5" aria-label="Moneda de comparación">
            {(["ARS", "USD"] as const).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={targetCurrency === item ? "secondary" : "ghost"}
                onClick={() => setTargetCurrency(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pending ? (
          <Skeleton className="h-72 w-full" />
        ) : rows.length > 0 ? (
          <>
            {beating != null && (
              <div className="mb-4 rounded-md bg-muted/60 p-3 text-sm">
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {new Intl.NumberFormat("es-AR", {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(beating)}
                </span>{" "}
                <span className="text-muted-foreground">
                  de tu cartera (por valor) le gana a la inflación en {targetCurrency}
                </span>
              </div>
            )}
            <div style={{ height: Math.max(180, chartRows.length * 36 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    domain={["auto", "auto"]}
                  />
                  <YAxis type="category" dataKey="ticker" width={70} tickLine={false} />
                  <ReferenceLine x={0} stroke="var(--muted-foreground)" />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, "Rendimiento real"]}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="real" name="Rendimiento real" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {chartRows.map((row) => (
                      <Cell
                        key={row.ticker}
                        fill={row.beats ? "var(--positive)" : "var(--negative)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px] bg-positive" /> Le gana a la inflación
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px] bg-negative" /> Pierde contra la inflación
              </span>
            </div>

            <div className="mt-4 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activo</TableHead>
                    <TableHead>Comprado</TableHead>
                    <TableHead className="text-right">Retorno nominal</TableHead>
                    <TableHead className="text-right">Inflación del período</TableHead>
                    <TableHead className="text-right">Rendimiento real</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.ticker}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/inversiones/${encodeURIComponent(row.ticker)}?type=${row.assetType}`}
                          className="hover:underline"
                        >
                          {row.ticker}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {ASSET_TYPE_LABELS[row.assetType]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(new Date(row.purchaseTime * 1000))}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatPercent(row.nominal)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-brass">
                        {pctShort(row.inflation)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono font-semibold tabular-nums",
                          row.beatsInflation ? "text-positive" : "text-negative"
                        )}
                      >
                        {formatPercent(row.real)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(row.beatsInflation ? "text-positive" : "text-negative")}
                        >
                          {row.beatsInflation ? "Gana" : "Pierde"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Retorno nominal en {targetCurrency} desde la fecha de compra promedio ponderada de cada
              posición, con el costo convertido al MEP histórico cuando la moneda difiere. No incluye
              cupones cobrados. ARS: IPC Nacional (INDEC) · USD: CPI-U (BLS).
            </p>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay posiciones valuadas con datos de inflación coincidentes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

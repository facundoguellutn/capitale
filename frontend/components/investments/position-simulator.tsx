"use client";

import { useMemo, useState } from "react";
import type { AssetType, Currency } from "@/lib/constants";
import { simulateBuy, simulateSell } from "@/lib/analytics";
import { convertAmount, formatMoneyIn } from "@/lib/fx";
import type { Holding } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/display-currency";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ResultRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{children}</span>
    </div>
  );
}

export function PositionSimulator({
  holding,
  assetType,
  currentPrice,
  priceCurrency,
  mep,
}: {
  holding?: Holding;
  assetType: AssetType;
  // Último precio conocido, en la moneda de cotización
  currentPrice: number | null;
  priceCurrency: Currency;
  mep: number | null;
}) {
  const { displayCurrency } = useDisplayCurrency();
  const [qtyInput, setQtyInput] = useState("");
  const [priceInput, setPriceInput] = useState("");

  // El simulador opera en la moneda de la posición (o de cotización si no hay)
  const simCurrency: Currency = holding?.currency ?? priceCurrency;
  const defaultPrice = useMemo(() => {
    if (currentPrice == null) return null;
    return convertAmount(currentPrice, priceCurrency, simCurrency, mep);
  }, [currentPrice, priceCurrency, simCurrency, mep]);

  if (!holding && currentPrice == null) return null;

  const price = parseNumber(priceInput) ?? defaultPrice;
  const qty = parseNumber(qtyInput);

  const sell =
    holding && price != null && qty != null
      ? simulateSell(holding, qty, price, assetType)
      : null;
  const buy =
    price != null && qty != null
      ? simulateBuy(holding ?? null, qty, price, assetType)
      : null;

  const money = (value: number) =>
    formatMoneyIn(value, simCurrency, displayCurrency, mep);

  const inputs = (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sim-qty">Cantidad</Label>
        <div className="flex gap-1">
          <Input
            id="sim-qty"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="0"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sim-price">Precio ({simCurrency})</Label>
        <Input
          id="sim-price"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder={
            defaultPrice != null
              ? defaultPrice.toLocaleString("es-AR", {
                  maximumFractionDigits: 2,
                  useGrouping: false,
                })
              : "0"
          }
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulador</CardTitle>
        <CardDescription>
          Probá una operación antes de hacerla · estimación sin comisiones ni
          impuestos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={holding ? "venta" : "compra"}>
          <TabsList className="w-full">
            <TabsTrigger value="venta" disabled={!holding}>
              Si vendo
            </TabsTrigger>
            <TabsTrigger value="compra">Si compro</TabsTrigger>
          </TabsList>

          <TabsContent value="venta" className="flex flex-col gap-3 pt-1">
            {inputs}
            {holding && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setQtyInput(String(holding.quantity))}
              >
                Vender todo ({holding.quantity.toLocaleString("es-AR", {
                  maximumFractionDigits: 8,
                })})
              </Button>
            )}
            {sell ? (
              <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <ResultRow label="Recibirías">≈ {money(sell.proceeds)}</ResultRow>
                <ResultRow label="Resultado de esta venta">
                  <span
                    className={cn(
                      sell.realizedPnl >= 0 ? "text-positive" : "text-negative"
                    )}
                  >
                    {sell.realizedPnl >= 0 ? "+" : ""}
                    {money(sell.realizedPnl)}
                    {sell.realizedPct != null &&
                      ` (${formatPercent(sell.realizedPct)})`}
                  </span>
                </ResultRow>
                <ResultRow label="Te quedan">
                  {sell.remainingQty.toLocaleString("es-AR", {
                    maximumFractionDigits: 8,
                  })}
                </ResultRow>
                {sell.remainingQty > 0 && (
                  <ResultRow label="Costo restante">
                    {money(sell.remainingCost)}
                  </ResultRow>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ingresá una cantidad para simular la venta.
              </p>
            )}
          </TabsContent>

          <TabsContent value="compra" className="flex flex-col gap-3 pt-1">
            {inputs}
            {buy ? (
              <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <ResultRow label="Invertirías">≈ {money(buy.cost)}</ResultRow>
                <ResultRow label="Nuevo precio promedio">
                  {money(buy.newAvgPrice)}
                  {buy.prevAvgPrice != null && buy.deltaAvgPct != null && (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      (antes {money(buy.prevAvgPrice)},{" "}
                      {formatPercent(buy.deltaAvgPct)})
                    </span>
                  )}
                </ResultRow>
                <ResultRow label="Nueva cantidad">
                  {buy.newQty.toLocaleString("es-AR", {
                    maximumFractionDigits: 8,
                  })}
                </ResultRow>
                <ResultRow label="Nuevo costo total">
                  {money(buy.newCostBasis)}
                </ResultRow>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ingresá una cantidad para simular la compra.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

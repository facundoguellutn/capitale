import "server-only";

import { isPer100, type AssetType, type Currency } from "@/lib/constants";
import { positionValue } from "@/lib/analytics";
import type { Holding, Quote } from "@/lib/types";

export type PortfolioTransaction = {
  assetType: AssetType;
  ticker: string;
  coingeckoId?: string | null;
  side: "compra" | "venta";
  quantity: number;
  price: number;
  currency: Currency;
  date: Date | string;
  fee?: number | null;
};

// Deriva las posiciones actuales desde el historial de operaciones.
// Costo por precio promedio ponderado: las ventas reducen el costo
// proporcionalmente al PPC vigente al momento de la venta.
export function computeHoldings(
  transactions: PortfolioTransaction[]
): Omit<Holding, "currentPrice" | "valueARS" | "valueUSD" | "pnl" | "pnlPct">[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const positions = new Map<
    string,
    {
      ticker: string;
      assetType: AssetType;
      coingeckoId?: string;
      currency: Currency;
      quantity: number;
      costBasis: number;
    }
  >();

  for (const tx of sorted) {
    const key = tx.ticker.toUpperCase();
    const pos = positions.get(key) ?? {
      ticker: key,
      assetType: tx.assetType,
      coingeckoId: tx.coingeckoId ?? undefined,
      currency: tx.currency,
      quantity: 0,
      costBasis: 0,
    };
    if (tx.coingeckoId) pos.coingeckoId = tx.coingeckoId;

    const tradeValue = positionValue(tx.assetType, tx.quantity, tx.price);
    if (tx.side === "compra") {
      pos.quantity += tx.quantity;
      pos.costBasis += tradeValue + (tx.fee ?? 0);
    } else {
      const avgCostPerUnit = pos.quantity > 0 ? pos.costBasis / pos.quantity : 0;
      pos.quantity -= tx.quantity;
      pos.costBasis -= avgCostPerUnit * tx.quantity;
      if (pos.quantity <= 0.000001) {
        pos.quantity = 0;
        pos.costBasis = 0;
      }
    }
    positions.set(key, pos);
  }

  return [...positions.values()]
    .filter((pos) => pos.quantity > 0.000001)
    .map((pos) => ({
      ticker: pos.ticker,
      assetType: pos.assetType,
      coingeckoId: pos.coingeckoId,
      quantity: pos.quantity,
      costBasis: pos.costBasis,
      // Precio promedio en la convención de mercado (renta fija: por 100)
      avgPrice: isPer100(pos.assetType)
        ? (pos.costBasis / pos.quantity) * 100
        : pos.costBasis / pos.quantity,
      currency: pos.currency,
    }));
}

// Suma valuación actual y P&L a las posiciones, normalizando a ARS y USD con el MEP
export function valueHoldings(
  holdings: ReturnType<typeof computeHoldings>,
  quotes: Quote[],
  mep: number | null
): Holding[] {
  const quoteByTicker = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

  return holdings.map((holding) => {
    const quote = quoteByTicker.get(holding.ticker);
    if (!quote) {
      return {
        ...holding,
        currentPrice: null,
        valueARS: null,
        valueUSD: null,
        pnl: null,
        pnlPct: null,
      };
    }

    const rawValue = positionValue(holding.assetType, holding.quantity, quote.price);
    const valueARS =
      quote.currency === "ARS" ? rawValue : mep != null ? rawValue * mep : null;
    const valueUSD =
      quote.currency === "USD" ? rawValue : mep != null ? rawValue / mep : null;

    // Costo llevado a ARS al MEP actual para comparar contra la valuación
    const costARS =
      holding.currency === "ARS"
        ? holding.costBasis
        : mep != null
          ? holding.costBasis * mep
          : null;

    const pnl = valueARS != null && costARS != null ? valueARS - costARS : null;
    const pnlPct = pnl != null && costARS ? pnl / costARS : null;

    return {
      ...holding,
      currentPrice: quote.price,
      valueARS,
      valueUSD,
      pnl,
      pnlPct,
      pctChange: quote.pctChange,
    };
  });
}

// Interés devengado lineal de un plazo fijo, limitado al vencimiento
export function fixedTermAccruedValue(
  principal: number,
  tna: number,
  startDate: Date | string,
  maturityDate: Date | string,
  asOf: Date = new Date()
): number {
  const start = new Date(startDate).getTime();
  const maturity = new Date(maturityDate).getTime();
  const now = Math.min(asOf.getTime(), maturity);
  const days = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
  return principal * (1 + (tna / 100) * (days / 365));
}

export function fixedTermFinalValue(
  principal: number,
  tna: number,
  startDate: Date | string,
  maturityDate: Date | string
): number {
  return fixedTermAccruedValue(principal, tna, startDate, maturityDate, new Date(maturityDate));
}

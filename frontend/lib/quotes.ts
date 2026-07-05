import "server-only";

import { FX_CASA, type AssetType, type Currency } from "@/lib/constants";
import type { DolarRate, Quote } from "@/lib/types";

// Cache del Data Cache de Next: 5 minutos por fuente para no golpear los rate limits
const REVALIDATE = 300;

type BymaQuote = {
  symbol: string;
  c: number;
  px_bid: number;
  px_ask: number;
  pct_change: number;
};

type BymaKind = "arg_stocks" | "arg_cedears" | "arg_bonds";

const BYMA_KIND_BY_ASSET: Record<Exclude<AssetType, "cripto">, BymaKind> = {
  accion: "arg_stocks",
  cedear: "arg_cedears",
  bono: "arg_bonds",
};

export async function getDolarRates(): Promise<DolarRate[]> {
  const res = await fetch("https://dolarapi.com/v1/dolares", {
    next: { revalidate: REVALIDATE, tags: ["quotes"] },
  });
  if (!res.ok) throw new Error(`DolarAPI respondió ${res.status}`);
  return res.json();
}

// Dólar MEP promedio compra/venta, usado para conversión ARS <-> USD
export function getMepRate(dolares: DolarRate[]): number | null {
  const mep = dolares.find((d) => d.casa === FX_CASA);
  if (!mep) return null;
  return (mep.compra + mep.venta) / 2;
}

async function getBymaQuotes(kind: BymaKind): Promise<BymaQuote[]> {
  const res = await fetch(`https://data912.com/live/${kind}`, {
    next: { revalidate: REVALIDATE, tags: ["quotes"] },
  });
  if (!res.ok) throw new Error(`data912 ${kind} respondió ${res.status}`);
  return res.json();
}

async function getCryptoPrices(ids: string[]): Promise<Record<string, { usd: number }>> {
  if (ids.length === 0) return {};
  // ids ordenados para que la clave de cache del fetch sea estable
  const sorted = [...new Set(ids)].sort().join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(sorted)}&vs_currencies=usd`,
    { next: { revalidate: REVALIDATE, tags: ["quotes"] } }
  );
  if (!res.ok) throw new Error(`CoinGecko respondió ${res.status}`);
  return res.json();
}

export type QuoteRequest = {
  ticker: string;
  assetType: AssetType;
  coingeckoId?: string;
};

// Devuelve cotizaciones para los activos pedidos. Cada fuente falla de forma
// independiente: si una API no responde, los demás precios igual se devuelven.
export async function getQuotes(requests: QuoteRequest[]): Promise<Quote[]> {
  const byKind = new Map<BymaKind, QuoteRequest[]>();
  const cryptoRequests: QuoteRequest[] = [];

  for (const req of requests) {
    if (req.assetType === "cripto") {
      if (req.coingeckoId) cryptoRequests.push(req);
    } else {
      const kind = BYMA_KIND_BY_ASSET[req.assetType];
      const list = byKind.get(kind) ?? [];
      list.push(req);
      byKind.set(kind, list);
    }
  }

  const quotes: Quote[] = [];

  const bymaTasks = [...byKind.entries()].map(async ([kind, reqs]) => {
    try {
      const data = await getBymaQuotes(kind);
      const bySymbol = new Map(data.map((q) => [q.symbol.toUpperCase(), q]));
      for (const req of reqs) {
        const match = bySymbol.get(req.ticker.toUpperCase());
        if (match) {
          quotes.push({
            ticker: req.ticker,
            price: match.c,
            currency: "ARS" as Currency,
            pctChange: match.pct_change,
          });
        }
      }
    } catch (err) {
      console.error(`Error obteniendo cotizaciones de ${kind}:`, err);
    }
  });

  const cryptoTask = (async () => {
    try {
      const ids = cryptoRequests.map((r) => r.coingeckoId!);
      const prices = await getCryptoPrices(ids);
      for (const req of cryptoRequests) {
        const price = prices[req.coingeckoId!]?.usd;
        if (price != null) {
          quotes.push({
            ticker: req.ticker,
            price,
            currency: "USD" as Currency,
          });
        }
      }
    } catch (err) {
      console.error("Error obteniendo precios de CoinGecko:", err);
    }
  })();

  await Promise.all([...bymaTasks, cryptoTask]);
  return quotes;
}

// Valor de mercado de una posición según el tipo de activo.
// Bonos: el precio es por 100 nominales.
export function positionValue(
  assetType: AssetType,
  quantity: number,
  price: number
): number {
  return assetType === "bono" ? (quantity * price) / 100 : quantity * price;
}

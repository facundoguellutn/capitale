import "server-only";

import {
  ASSET_TYPES,
  FX_CASA,
  type AssetType,
  type Currency,
} from "@/lib/constants";
import type {
  AssetCandle,
  AssetHistoryResponse,
  AssetSearchResult,
  DolarRate,
  MarketQuote,
  Quote,
} from "@/lib/types";

// Cache del Data Cache de Next: 5 minutos por fuente para no golpear los rate limits
const REVALIDATE = 300;

type BymaQuote = {
  symbol: string;
  c: number;
  px_bid: number;
  px_ask: number;
  pct_change: number;
};

type BymaKind =
  | "arg_stocks"
  | "arg_cedears"
  | "arg_bonds"
  | "arg_notes"
  | "arg_corp";

const BYMA_KIND_BY_ASSET: Record<Exclude<AssetType, "cripto">, BymaKind> = {
  accion: "arg_stocks",
  cedear: "arg_cedears",
  bono: "arg_bonds",
  letra: "arg_notes",
  on: "arg_corp",
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

export async function getBymaQuotes(kind: BymaKind): Promise<BymaQuote[]> {
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
            assetType: req.assetType,
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
            assetType: req.assetType,
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

type CoinGeckoSearchResponse = {
  coins: {
    id: string;
    name: string;
    symbol: string;
    thumb: string;
    market_cap_rank: number | null;
  }[];
};

// Busca activos por ticker. BYMA: filtra los símbolos del panel en vivo de
// data912 (solo tickers válidos). Cripto: usa el buscador de CoinGecko.
export async function searchAssets(
  assetType: AssetType,
  query: string
): Promise<AssetSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (assetType === "cripto") {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
      { next: { revalidate: 3600, tags: ["asset-search"] } }
    );
    if (!res.ok) throw new Error(`CoinGecko respondió ${res.status}`);
    const data: CoinGeckoSearchResponse = await res.json();
    return data.coins.slice(0, 15).map((coin) => ({
      ticker: coin.symbol.toUpperCase(),
      name: coin.name,
      assetType,
      coingeckoId: coin.id,
      logo: coin.thumb,
    }));
  }

  const kind = BYMA_KIND_BY_ASSET[assetType];
  const data = await getBymaQuotes(kind);
  const upper = q.toUpperCase();
  const symbols = data
    .map((item) => item.symbol.toUpperCase())
    .filter((symbol, i, arr) => arr.indexOf(symbol) === i && symbol.includes(upper))
    // Los que empiezan con la búsqueda primero
    .sort((a, b) => {
      const aStarts = a.startsWith(upper) ? 0 : 1;
      const bStarts = b.startsWith(upper) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b);
    })
    .slice(0, 15);
  return symbols.map((ticker) => ({
    ticker,
    assetType,
    // Parqet tiene logos por símbolo para acciones y CEDEARs
    logo:
      assetType === "accion" || assetType === "cedear"
        ? `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=png`
        : undefined,
  }));
}

// Busca en todos los tipos de activo a la vez (para el command palette).
// Cada fuente falla de forma independiente.
export async function searchAllAssets(query: string): Promise<AssetSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const types: AssetType[] = [...ASSET_TYPES];
  const settled = await Promise.allSettled(
    types.map((type) => searchAssets(type, q))
  );
  const results: AssetSearchResult[] = [];
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value.slice(0, 8));
    } else {
      console.error(`Error buscando activos (${types[i]}):`, outcome.reason);
    }
  }
  return results;
}

// Panel completo de un tipo de activo BYMA con precio y variación diaria
export async function getMarketQuotes(
  assetType: Exclude<AssetType, "cripto">
): Promise<MarketQuote[]> {
  const data = await getBymaQuotes(BYMA_KIND_BY_ASSET[assetType]);
  const seen = new Set<string>();
  const quotes: MarketQuote[] = [];
  for (const item of data) {
    const ticker = item.symbol.toUpperCase();
    if (seen.has(ticker) || item.c == null) continue;
    seen.add(ticker);
    quotes.push({ ticker, price: item.c, pctChange: item.pct_change ?? 0 });
  }
  return quotes.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// Letras y ONs no tienen path histórico propio en data912; el de bonds
// devuelve lo que exista (suele ser poco para letras cortas)
const BYMA_HISTORY_PATH: Record<Exclude<AssetType, "cripto">, string> = {
  accion: "stocks",
  cedear: "cedears",
  bono: "bonds",
  letra: "bonds",
  on: "bonds",
};

type Data912Bar = {
  date: string | null;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  v: number | null;
};

// Histórico OHLC diario. BYMA vía data912 (en ARS), cripto vía CoinGecko (en USD).
export async function getAssetHistory(
  assetType: AssetType,
  ticker: string,
  coingeckoId?: string
): Promise<AssetHistoryResponse> {
  if (assetType === "cripto") {
    if (!coingeckoId) throw new Error("Falta el id de CoinGecko");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}/ohlc?vs_currency=usd&days=365`,
      { next: { revalidate: 3600, tags: ["asset-history"] } }
    );
    if (!res.ok) throw new Error(`CoinGecko respondió ${res.status}`);
    const data: [number, number, number, number, number][] = await res.json();
    const candles: AssetCandle[] = data.map(([ts, open, high, low, close]) => ({
      time: Math.floor(ts / 1000),
      open,
      high,
      low,
      close,
    }));
    return { ticker, currency: "USD", candles };
  }

  const path = BYMA_HISTORY_PATH[assetType];
  const res = await fetch(
    `https://data912.com/historical/${path}/${encodeURIComponent(ticker.toUpperCase())}`,
    { next: { revalidate: 3600, tags: ["asset-history"] } }
  );
  if (!res.ok) throw new Error(`data912 historical respondió ${res.status}`);
  const data: Data912Bar[] = await res.json();
  const candles: AssetCandle[] = data
    .filter(
      (bar) =>
        bar.date != null &&
        bar.o != null &&
        bar.h != null &&
        bar.l != null &&
        bar.c != null
    )
    .map((bar) => ({
      time: Math.floor(new Date(bar.date!).getTime() / 1000),
      open: bar.o!,
      high: bar.h!,
      low: bar.l!,
      close: bar.c!,
      volume: bar.v ?? undefined,
    }))
    .sort((a, b) => a.time - b.time);
  return { ticker, currency: "ARS", candles };
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { canonicalTicker, type AssetType } from "@/lib/constants";
import {
  aggregatePositionSeries,
  buildPositionSeries,
  type AnalyticsTransaction,
  type PositionPoint,
} from "@/lib/analytics";
import { getAssetHistory, getDolarRates, getMepRate } from "@/lib/quotes";
import type {
  PortfolioHistorySeries,
  PortfolioHistoryResponse,
} from "@/lib/types";
import InvestmentTransaction from "@/models/InvestmentTransaction";

type Group = {
  ticker: string;
  assetType: AssetType;
  coingeckoId?: string;
  txs: AnalyticsTransaction[];
};

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();
  const txDocs = await InvestmentTransaction.find().lean();

  let mep: number | null = null;
  try {
    mep = getMepRate(await getDolarRates());
  } catch (err) {
    console.error("Error obteniendo dólares:", err);
  }

  // Agrupar operaciones por ticker (incluye posiciones ya cerradas)
  const groups = new Map<string, Group>();
  for (const d of txDocs) {
    // Unifica las puntas peso/dólar/cable de un bono (ver canonicalTicker)
    const key = canonicalTicker(d.ticker, d.assetType);
    const group: Group = groups.get(key) ?? {
      ticker: key,
      assetType: d.assetType,
      coingeckoId: d.coingeckoId ?? undefined,
      txs: [],
    };
    if (d.coingeckoId) group.coingeckoId = d.coingeckoId;
    group.txs.push({
      side: d.side,
      quantity: d.quantity,
      price: d.price,
      currency: d.currency,
      date: d.date,
      fee: d.fee,
    });
    groups.set(key, group);
  }

  const groupList = [...groups.values()];
  const settled = await Promise.allSettled(
    groupList.map(async (group): Promise<PositionPoint[]> => {
      const history = await getAssetHistory(
        group.assetType,
        group.ticker,
        group.coingeckoId
      );

      // Homogeneizar TODO a ARS al MEP actual ANTES de armar la serie. Un bono
      // operado por dólar MEP mezcla legs en pesos y dólares en la misma
      // posición: hay que convertir cada operación (y el histórico cripto) a
      // pesos por separado, no la serie entera con una sola moneda.
      const needsMep =
        history.currency === "USD" || group.txs.some((t) => t.currency === "USD");
      if (needsMep && mep == null) {
        throw new Error("sin MEP para convertir a ARS");
      }
      const arsTxs: AnalyticsTransaction[] = group.txs.map((t) =>
        t.currency === "USD"
          ? {
              ...t,
              price: t.price * mep!,
              fee: t.fee != null ? t.fee * mep! : t.fee,
              currency: "ARS",
            }
          : t
      );
      const arsCandles =
        history.currency === "USD"
          ? history.candles.map((c) => ({ ...c, close: c.close * mep! }))
          : history.candles;

      const series = buildPositionSeries(arsTxs, arsCandles, group.assetType);
      if (series.length === 0) throw new Error("sin histórico");
      return series; // ya en ARS
    })
  );

  const allSeries: PositionPoint[][] = [];
  const seriesByType = new Map<AssetType, PositionPoint[][]>();
  const excludedTickers: string[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      allSeries.push(outcome.value);
      const at = groupList[i].assetType;
      const list = seriesByType.get(at) ?? [];
      list.push(outcome.value);
      seriesByType.set(at, list);
    } else {
      excludedTickers.push(groupList[i].ticker);
      console.error(`Sin histórico para ${groupList[i].ticker}:`, outcome.reason);
    }
  });

  const toPoints = (agg: ReturnType<typeof aggregatePositionSeries>) =>
    agg.map((p) => ({ time: p.time, investedARS: p.invested, valueARS: p.value }));

  // Serie de la cartera completa + una por tipo de activo con datos
  const series: PortfolioHistorySeries[] = [];
  const allAgg = aggregatePositionSeries(allSeries);
  if (allAgg.length > 0) series.push({ assetType: "todos", points: toPoints(allAgg) });
  for (const [at, list] of seriesByType) {
    const agg = aggregatePositionSeries(list);
    if (agg.length > 0) series.push({ assetType: at, points: toPoints(agg) });
  }

  const body: PortfolioHistoryResponse = { mep, series, excludedTickers };
  return NextResponse.json(body);
}

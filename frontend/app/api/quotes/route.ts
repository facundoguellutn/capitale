import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { getDolarRates, getMepRate, getQuotes, type QuoteRequest } from "@/lib/quotes";
import type { QuotesResponse } from "@/lib/types";
import InvestmentTransaction from "@/models/InvestmentTransaction";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();

  // Tickers únicos con posiciones en cartera
  const grouped = await InvestmentTransaction.aggregate<{
    _id: { ticker: string; assetType: string };
    coingeckoId: string | null;
    quantity: number;
  }>([
    {
      $group: {
        _id: { ticker: "$ticker", assetType: "$assetType" },
        coingeckoId: { $last: "$coingeckoId" },
        quantity: {
          $sum: {
            $cond: [{ $eq: ["$side", "compra"] }, "$quantity", { $multiply: ["$quantity", -1] }],
          },
        },
      },
    },
    { $match: { quantity: { $gt: 0.000001 } } },
  ]);

  const requests: QuoteRequest[] = grouped.map((g) => ({
    ticker: g._id.ticker,
    assetType: g._id.assetType as QuoteRequest["assetType"],
    coingeckoId: g.coingeckoId ?? undefined,
  }));

  let dolares: QuotesResponse["dolares"] = [];
  try {
    dolares = await getDolarRates();
  } catch (err) {
    console.error("Error obteniendo dólares:", err);
  }

  const quotes = await getQuotes(requests);

  const body: QuotesResponse = {
    dolares,
    quotes,
    mep: getMepRate(dolares),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}

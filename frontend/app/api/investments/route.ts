import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { computeHoldings, valueHoldings } from "@/lib/portfolio";
import { getDolarRates, getMepRate, getQuotes } from "@/lib/quotes";
import { serialize } from "@/lib/utils";
import type { ClientInvestmentTransaction, Holding } from "@/lib/types";
import InvestmentTransaction from "@/models/InvestmentTransaction";

export type InvestmentsResponse = {
  transactions: ClientInvestmentTransaction[];
  holdings: Holding[];
  mep: number | null;
};

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();
  const docs = await InvestmentTransaction.find().sort({ date: -1 }).lean();

  const bare = computeHoldings(
    docs.map((d) => ({
      assetType: d.assetType,
      ticker: d.ticker,
      coingeckoId: d.coingeckoId,
      side: d.side,
      quantity: d.quantity,
      price: d.price,
      currency: d.currency,
      date: d.date,
      fee: d.fee,
    }))
  );

  let mep: number | null = null;
  try {
    mep = getMepRate(await getDolarRates());
  } catch (err) {
    console.error("Error obteniendo dólares:", err);
  }

  const quotes = await getQuotes(
    bare.map((h) => ({
      ticker: h.ticker,
      assetType: h.assetType,
      coingeckoId: h.coingeckoId,
    }))
  );

  const body: InvestmentsResponse = {
    transactions: serialize<ClientInvestmentTransaction[]>(docs),
    holdings: valueHoldings(bare, quotes, mep),
    mep,
  };
  return NextResponse.json(body);
}

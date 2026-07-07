import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import type { AssetType } from "@/lib/constants";
import { getDolarRates, getMarketQuotes, getMepRate } from "@/lib/quotes";
import type { MarketsResponse } from "@/lib/types";

const MARKET_TYPES = ["accion", "cedear", "bono", "letra", "on"] as const;
type MarketType = (typeof MARKET_TYPES)[number];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "";
  if (!MARKET_TYPES.includes(type as MarketType)) {
    return NextResponse.json({ error: "Tipo de activo inválido" }, { status: 400 });
  }

  try {
    const [quotes, dolares] = await Promise.all([
      getMarketQuotes(type as MarketType),
      // El MEP es opcional: si DolarAPI falla, el panel se devuelve igual
      getDolarRates().catch(() => [] as Awaited<ReturnType<typeof getDolarRates>>),
    ]);
    const body: MarketsResponse = {
      type: type as AssetType,
      quotes,
      mep: getMepRate(dolares),
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("Error obteniendo panel de mercado:", err);
    return NextResponse.json(
      { error: "Error obteniendo cotizaciones del mercado" },
      { status: 502 }
    );
  }
}

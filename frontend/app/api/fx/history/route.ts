import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAssetHistory } from "@/lib/quotes";
import type { FxHistoryResponse } from "@/lib/types";

// MEP implícito diario: misma especie y mismos flujos, una punta en ARS y la
// otra en USD. El cociente AL30/AL30D evita mezclar cierres de fuentes distintas.
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const [ars, usd] = await Promise.all([
      getAssetHistory("bono", "AL30"),
      getAssetHistory("bono", "AL30D"),
    ]);
    const usdByDay = new Map(usd.candles.map((c) => [c.time, c.close]));
    const points = ars.candles.flatMap((candle) => {
      const usdClose = usdByDay.get(candle.time);
      const mep = usdClose && usdClose > 0 ? candle.close / usdClose : null;
      return mep && Number.isFinite(mep) && mep > 0 ? [{ time: candle.time, mep }] : [];
    });
    const body: FxHistoryResponse = {
      points,
      source: "MEP implícito AL30/AL30D (cierres coincidentes)",
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Error obteniendo MEP histórico:", error);
    return NextResponse.json({ error: "No se pudo obtener el MEP histórico" }, { status: 502 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ASSET_TYPES, type AssetType } from "@/lib/constants";
import { getAssetHistory } from "@/lib/quotes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { ticker } = await params;
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? "";
  const coingeckoId = searchParams.get("coingeckoId") ?? undefined;

  if (!ASSET_TYPES.includes(type as AssetType)) {
    return NextResponse.json({ error: "Tipo de activo inválido" }, { status: 400 });
  }

  try {
    const history = await getAssetHistory(type as AssetType, ticker, coingeckoId);
    return NextResponse.json(history);
  } catch (err) {
    console.error(`Error obteniendo histórico de ${ticker}:`, err);
    return NextResponse.json(
      { error: "No se pudo obtener el histórico" },
      { status: 502 }
    );
  }
}

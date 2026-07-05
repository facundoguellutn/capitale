import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ASSET_TYPES, type AssetType } from "@/lib/constants";
import { searchAssets } from "@/lib/quotes";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? "";
  const q = searchParams.get("q") ?? "";

  if (!ASSET_TYPES.includes(type as AssetType)) {
    return NextResponse.json({ error: "Tipo de activo inválido" }, { status: 400 });
  }

  try {
    const results = await searchAssets(type as AssetType, q);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Error buscando activos:", err);
    return NextResponse.json({ error: "Error buscando activos" }, { status: 502 });
  }
}

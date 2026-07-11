import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { InflationPoint, InflationResponse } from "@/lib/types";

const ARGENTINA_IPC = "148.3_INIVELNAL_DICI_M_26";
const US_CPI = "CUUR0000SA0";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const currentYear = new Date().getUTCFullYear();
    const [arsResponse, usdResponse] = await Promise.all([
      // La API pagina a 100 observaciones por defecto. Sin un límite explícito
      // la serie terminaba antes del período actual y el IPC quedaba constante.
      fetch(`https://apis.datos.gob.ar/series/api/series/?ids=${ARGENTINA_IPC}&start_date=2016-12-01&limit=5000&format=json`, {
        next: { revalidate: 86400, tags: ["inflation"] },
      }),
      fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seriesid: [US_CPI], startyear: "2016", endyear: String(currentYear) }),
        next: { revalidate: 86400, tags: ["inflation"] },
      }),
    ]);
    if (!arsResponse.ok || !usdResponse.ok) throw new Error("Una fuente de inflación no respondió");
    const arsJson = await arsResponse.json() as { data: [string, number | null][] };
    const usdJson = await usdResponse.json() as {
      Results: { series: { data: { year: string; period: string; value: string }[] }[] };
    };
    const ars: InflationPoint[] = arsJson.data
      .filter((row): row is [string, number] => row[1] != null)
      .map(([date, value]) => ({ time: Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000), value }));
    const usd: InflationPoint[] = (usdJson.Results.series[0]?.data ?? [])
      .filter((row) => /^M\d{2}$/.test(row.period))
      .map((row) => ({
        time: Math.floor(Date.UTC(Number(row.year), Number(row.period.slice(1)) - 1, 1) / 1000),
        value: Number(row.value),
      }))
      .filter((row) => Number.isFinite(row.value))
      .sort((a, b) => a.time - b.time);
    const body: InflationResponse = { ars, usd, updatedAt: new Date().toISOString() };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Error obteniendo inflación:", error);
    return NextResponse.json({ error: "No se pudieron obtener las series de inflación" }, { status: 502 });
  }
}

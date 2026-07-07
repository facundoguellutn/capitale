"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import { ChartCandlestick, ChartSpline } from "lucide-react";
import type { TransactionSide } from "@/lib/constants";
import { snapToCandleTime, type PriceZones } from "@/lib/analytics";
import type { AssetCandle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const RANGES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "1A", days: 365 },
  { key: "Máx", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];
type ChartStyle = "velas" | "area";

// Marcador de una operación propia sobre el gráfico
export type TradeMarker = {
  time: number;
  side: TransactionSide;
  quantity: number;
};

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#dc2626";
const LINE_COLOR = "#3b82f6";
const PPC_COLOR = "#f59e0b";
const TEXT_COLOR = "#9ca3af";
const GRID_COLOR = "rgba(156, 163, 175, 0.15)";

export function AssetChart({
  candles,
  trades = [],
  ppc = null,
  ppcApprox = false,
  zones = null,
}: {
  candles: AssetCandle[];
  trades?: TradeMarker[];
  // Precio promedio de compra, ya en la moneda de las velas (null = sin línea)
  ppc?: number | null;
  // true si el PPC fue convertido al MEP actual (se titula "PPC ≈")
  ppcApprox?: boolean;
  zones?: PriceZones | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<RangeKey>("3M");
  const [style, setStyle] = useState<ChartStyle>("velas");
  const [showTrades, setShowTrades] = useState(true);
  const [showZones, setShowZones] = useState(false);

  const visible = useMemo(() => {
    const rangeDef = RANGES.find((r) => r.key === range);
    if (!rangeDef?.days || candles.length === 0) return candles;
    const lastTime = candles[candles.length - 1].time;
    const from = lastTime - rangeDef.days * 86400;
    return candles.filter((c) => c.time >= from);
  }, [candles, range]);

  // Marcadores anclados a la vela más próxima (fechas no bursátiles) y
  // limitados al rango visible
  const visibleMarkers = useMemo(() => {
    if (!showTrades || trades.length === 0 || visible.length === 0) return [];
    const firstTime = visible[0].time;
    const markers: SeriesMarker<UTCTimestamp>[] = [];
    for (const trade of trades) {
      if (trade.time < firstTime) continue;
      const snapped = snapToCandleTime(visible, trade.time);
      if (snapped == null) continue;
      const buy = trade.side === "compra";
      markers.push({
        time: snapped as UTCTimestamp,
        position: buy ? "belowBar" : "aboveBar",
        shape: buy ? "arrowUp" : "arrowDown",
        color: buy ? UP_COLOR : DOWN_COLOR,
        text:
          trades.length <= 20
            ? `${buy ? "C" : "V"} ${trade.quantity.toLocaleString("es-AR", {
                maximumFractionDigits: 4,
              })}`
            : undefined,
      });
    }
    return markers.sort((a, b) => (a.time as number) - (b.time as number));
  }, [trades, visible, showTrades]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || visible.length === 0) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TEXT_COLOR,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      rightPriceScale: { borderColor: GRID_COLOR },
      timeScale: { borderColor: GRID_COLOR },
      crosshair: { mode: 0 },
    });

    let series: ISeriesApi<"Candlestick"> | ISeriesApi<"Area">;
    if (style === "velas") {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderVisible: false,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
      });
      candleSeries.setData(
        visible.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
      series = candleSeries;
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: LINE_COLOR,
        lineWidth: 2,
        topColor: "rgba(59, 130, 246, 0.3)",
        bottomColor: "rgba(59, 130, 246, 0)",
      });
      areaSeries.setData(
        visible.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }))
      );
      series = areaSeries;
    }

    if (visibleMarkers.length > 0) {
      createSeriesMarkers(series, visibleMarkers);
    }

    if (showTrades && ppc != null) {
      series.createPriceLine({
        price: ppc,
        color: PPC_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: ppcApprox ? "PPC ≈" : "PPC",
      });
    }

    if (showZones && zones) {
      series.createPriceLine({
        price: zones.buyBelow,
        color: UP_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        title: "Zona de compra",
      });
      series.createPriceLine({
        price: zones.sellAbove,
        color: DOWN_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        title: "Zona de venta",
      });
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [visible, style, visibleMarkers, showTrades, ppc, ppcApprox, showZones, zones]);

  const hasTradeOverlay = trades.length > 0 || ppc != null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              variant={range === r.key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setRange(r.key)}
            >
              {r.key}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {hasTradeOverlay && (
            <Button
              variant={showTrades ? "secondary" : "ghost"}
              size="sm"
              title="Mostrar tus compras/ventas y precio promedio"
              onClick={() => setShowTrades((v) => !v)}
            >
              Operaciones
            </Button>
          )}
          {zones && (
            <Button
              variant={showZones ? "secondary" : "ghost"}
              size="sm"
              title="Zonas orientativas según el rango de 52 semanas"
              onClick={() => setShowZones((v) => !v)}
            >
              Zonas
            </Button>
          )}
          <Button
            variant={style === "velas" ? "secondary" : "ghost"}
            size="icon-sm"
            title="Velas"
            onClick={() => setStyle("velas")}
          >
            <ChartCandlestick />
          </Button>
          <Button
            variant={style === "area" ? "secondary" : "ghost"}
            size="icon-sm"
            title="Área"
            onClick={() => setStyle("area")}
          >
            <ChartSpline />
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={cn("h-[380px] w-full", visible.length === 0 && "hidden")}
      />
      {visible.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No hay datos históricos para este período.
        </p>
      )}
      {showZones && zones && (
        <p className="text-xs text-muted-foreground">
          Zonas orientativas según el rango de 52 semanas. No es una
          recomendación.
        </p>
      )}
    </div>
  );
}

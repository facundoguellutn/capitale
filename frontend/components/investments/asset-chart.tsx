"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  type UTCTimestamp,
} from "lightweight-charts";
import { ChartCandlestick, ChartSpline } from "lucide-react";
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

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#dc2626";
const LINE_COLOR = "#3b82f6";
const TEXT_COLOR = "#9ca3af";
const GRID_COLOR = "rgba(156, 163, 175, 0.15)";

export function AssetChart({ candles }: { candles: AssetCandle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<RangeKey>("3M");
  const [style, setStyle] = useState<ChartStyle>("velas");

  const visible = useMemo(() => {
    const rangeDef = RANGES.find((r) => r.key === range);
    if (!rangeDef?.days || candles.length === 0) return candles;
    const lastTime = candles[candles.length - 1].time;
    const from = lastTime - rangeDef.days * 86400;
    return candles.filter((c) => c.time >= from);
  }, [candles, range]);

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

    if (style === "velas") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderVisible: false,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
      });
      series.setData(
        visible.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: LINE_COLOR,
        lineWidth: 2,
        topColor: "rgba(59, 130, 246, 0.3)",
        bottomColor: "rgba(59, 130, 246, 0)",
      });
      series.setData(
        visible.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }))
      );
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [visible, style]);

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
        <div className="flex gap-1">
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
    </div>
  );
}

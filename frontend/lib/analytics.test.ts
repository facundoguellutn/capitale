import { describe, expect, it } from "vitest";
import {
  aggregatePositionSeries,
  annualizedVolatility,
  bestWorstDay,
  buildPositionSeries,
  computeRealized,
  computeZones,
  positionValue,
  rangeStats,
  simulateBuy,
  simulateSell,
  sma,
  snapToCandleTime,
  type AnalyticsTransaction,
  type PositionPoint,
} from "@/lib/analytics";
import type { AssetCandle } from "@/lib/types";

const DAY = 86400;
// Epoca base arbitraria alineada a medianoche UTC
const T0 = 1735689600; // 2025-01-01

function candle(day: number, close: number, high = close, low = close): AssetCandle {
  return { time: T0 + day * DAY, open: close, high, low, close };
}

function iso(day: number): string {
  return new Date((T0 + day * DAY) * 1000).toISOString();
}

function buy(day: number, quantity: number, price: number, fee = 0): AnalyticsTransaction {
  return { side: "compra", quantity, price, currency: "ARS", date: iso(day), fee };
}

function sell(day: number, quantity: number, price: number, fee = 0): AnalyticsTransaction {
  return { side: "venta", quantity, price, currency: "ARS", date: iso(day), fee };
}

describe("positionValue", () => {
  it("multiplica cantidad por precio para acciones", () => {
    expect(positionValue("accion", 10, 150)).toBe(1500);
  });

  it("usa precio por 100 nominales para renta fija", () => {
    expect(positionValue("bono", 1000, 95)).toBe(950);
    expect(positionValue("letra", 500, 110)).toBe(550);
  });
});

describe("snapToCandleTime", () => {
  const candles = [candle(0, 10), candle(1, 11), candle(4, 12)];

  it("devuelve la vela exacta si existe", () => {
    expect(snapToCandleTime(candles, T0 + DAY)).toBe(T0 + DAY);
  });

  it("snapea hacia adelante en días sin vela", () => {
    expect(snapToCandleTime(candles, T0 + 2 * DAY)).toBe(T0 + 4 * DAY);
  });

  it("cae a la última vela si la fecha es posterior", () => {
    expect(snapToCandleTime(candles, T0 + 10 * DAY)).toBe(T0 + 4 * DAY);
  });

  it("devuelve null sin velas", () => {
    expect(snapToCandleTime([], T0)).toBeNull();
  });
});

describe("sma", () => {
  it("calcula la media móvil solo con ventana completa", () => {
    const candles = [1, 2, 3, 4, 5].map((c, i) => candle(i, c));
    const result = sma(candles, 3);
    expect(result).toEqual([
      { time: T0 + 2 * DAY, value: 2 },
      { time: T0 + 3 * DAY, value: 3 },
      { time: T0 + 4 * DAY, value: 4 },
    ]);
  });

  it("devuelve vacío si no alcanzan las velas", () => {
    expect(sma([candle(0, 10)], 3)).toEqual([]);
  });
});

describe("annualizedVolatility", () => {
  it("es cero para precios constantes", () => {
    const candles = Array.from({ length: 30 }, (_, i) => candle(i, 100));
    expect(annualizedVolatility(candles, 252)).toBe(0);
  });

  it("devuelve null con pocos datos", () => {
    const candles = Array.from({ length: 10 }, (_, i) => candle(i, 100 + i));
    expect(annualizedVolatility(candles, 252)).toBeNull();
  });
});

describe("rangeStats", () => {
  it("usa máximos y mínimos intradiarios del período", () => {
    const candles = [
      candle(0, 100, 120, 90),
      candle(1, 110, 115, 105),
      candle(2, 108, 112, 100),
    ];
    const stats = rangeStats(candles);
    expect(stats).not.toBeNull();
    expect(stats!.high).toBe(120);
    expect(stats!.low).toBe(90);
    expect(stats!.last).toBe(108);
    expect(stats!.pctFromHigh).toBeCloseTo((108 - 120) / 120);
    expect(stats!.pctAboveLow).toBeCloseTo((108 - 90) / 90);
  });

  it("devuelve null con menos de dos velas", () => {
    expect(rangeStats([candle(0, 100)])).toBeNull();
  });
});

describe("computeZones", () => {
  it("divide el rango en terciles", () => {
    const candles = [candle(0, 100, 100, 100), candle(1, 400, 400, 400)];
    const zones = computeZones(candles);
    expect(zones).not.toBeNull();
    expect(zones!.buyBelow).toBeCloseTo(200);
    expect(zones!.sellAbove).toBeCloseTo(300);
  });

  it("devuelve null si el rango es nulo", () => {
    const candles = [candle(0, 100), candle(1, 100)];
    expect(computeZones(candles)).toBeNull();
  });
});

describe("bestWorstDay", () => {
  it("encuentra el mejor y peor retorno diario", () => {
    const candles = [candle(0, 100), candle(1, 110), candle(2, 99)];
    const result = bestWorstDay(candles);
    expect(result).not.toBeNull();
    expect(result!.best.time).toBe(T0 + DAY);
    expect(result!.best.ret).toBeCloseTo(0.1);
    expect(result!.worst.time).toBe(T0 + 2 * DAY);
    expect(result!.worst.ret).toBeCloseTo(-0.1);
  });
});

describe("buildPositionSeries", () => {
  it("reconstruye cantidad, invertido y valor con ventas al PPC", () => {
    const candles = [
      candle(0, 10),
      candle(1, 10),
      candle(2, 12),
      candle(3, 12),
      candle(4, 15),
    ];
    const txs = [buy(0, 10, 10), sell(2, 5, 12)];
    const series = buildPositionSeries(txs, candles, "accion");

    expect(series).toHaveLength(5);
    // Día 0: compra de 10 a $10
    expect(series[0]).toMatchObject({ quantity: 10, invested: 100, value: 100 });
    // Día 2: venta de 5; el costo baja al PPC ($10 x 5 = $50)
    expect(series[2]).toMatchObject({ quantity: 5, invested: 50, value: 60 });
    // Día 4: sigue con 5 unidades a $15
    expect(series[4]).toMatchObject({ quantity: 5, invested: 50, value: 75 });
  });

  it("siembra operaciones anteriores a la primera vela", () => {
    const candles = [candle(10, 20), candle(11, 22)];
    const txs = [buy(0, 4, 10)];
    const series = buildPositionSeries(txs, candles, "accion");
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ quantity: 4, invested: 40, value: 80 });
  });

  it("arranca en la primera operación, no en la primera vela", () => {
    const candles = [candle(0, 10), candle(1, 10), candle(2, 10)];
    const series = buildPositionSeries([buy(1, 1, 10)], candles, "accion");
    expect(series).toHaveLength(2);
    expect(series[0].time).toBe(T0 + DAY);
  });

  it("valúa renta fija por 100 nominales", () => {
    const candles = [candle(0, 100), candle(1, 110)];
    const series = buildPositionSeries([buy(0, 1000, 100)], candles, "bono");
    expect(series[0]).toMatchObject({ invested: 1000, value: 1000 });
    expect(series[1].value).toBeCloseTo(1100);
  });

  it("clampea la posición a cero al vender todo", () => {
    const candles = [candle(0, 10), candle(1, 12), candle(2, 14)];
    const txs = [buy(0, 10, 10), sell(1, 10, 12)];
    const series = buildPositionSeries(txs, candles, "accion");
    expect(series[1]).toMatchObject({ quantity: 0, invested: 0, value: 0 });
    expect(series[2]).toMatchObject({ quantity: 0, invested: 0, value: 0 });
  });
});

describe("aggregatePositionSeries", () => {
  function point(day: number, invested: number, value: number): PositionPoint {
    return { time: T0 + day * DAY, quantity: 0, invested, value };
  }

  it("suma series con fechas idénticas", () => {
    const a = [point(0, 100, 120), point(1, 100, 130)];
    const b = [point(0, 50, 60), point(1, 50, 55)];
    expect(aggregatePositionSeries([a, b])).toEqual([
      { time: T0, invested: 150, value: 180 },
      { time: T0 + DAY, invested: 150, value: 185 },
    ]);
  });

  it("hace forward-fill de la serie con días faltantes", () => {
    const a = [point(0, 100, 100), point(1, 100, 110), point(2, 100, 120)];
    const b = [point(0, 50, 50), point(2, 50, 70)]; // sin día 1
    const result = aggregatePositionSeries([a, b]);
    // Día 1: b mantiene su último valor conocido (día 0)
    expect(result[1]).toEqual({ time: T0 + DAY, invested: 150, value: 160 });
    expect(result[2]).toEqual({ time: T0 + 2 * DAY, invested: 150, value: 190 });
  });

  it("no cuenta una serie antes de su primer punto", () => {
    const a = [point(0, 100, 100), point(1, 100, 110)];
    const b = [point(1, 50, 50)]; // arranca el día 1
    const result = aggregatePositionSeries([a, b]);
    expect(result[0]).toEqual({ time: T0, invested: 100, value: 100 });
    expect(result[1]).toEqual({ time: T0 + DAY, invested: 150, value: 160 });
  });

  it("mantiene en cero una posición cerrada hacia adelante", () => {
    const a = [point(0, 100, 100), point(1, 0, 0)]; // vendida el día 1
    const b = [point(0, 50, 50), point(1, 50, 60), point(2, 50, 70)];
    const result = aggregatePositionSeries([a, b]);
    expect(result[1]).toEqual({ time: T0 + DAY, invested: 50, value: 60 });
    expect(result[2]).toEqual({ time: T0 + 2 * DAY, invested: 50, value: 70 });
  });

  it("normaliza timestamps intradía al inicio de día UTC", () => {
    const a: PositionPoint[] = [
      { time: T0 + 3600, quantity: 0, invested: 100, value: 100 },
    ];
    const b: PositionPoint[] = [
      { time: T0 + 7200, quantity: 0, invested: 50, value: 60 },
    ];
    expect(aggregatePositionSeries([a, b])).toEqual([
      { time: T0, invested: 150, value: 160 },
    ]);
  });

  it("devuelve vacío sin series o con series vacías", () => {
    expect(aggregatePositionSeries([])).toEqual([]);
    expect(aggregatePositionSeries([[], []])).toEqual([]);
  });
});

describe("computeRealized", () => {
  it("calcula el resultado realizado contra el PPC con fees", () => {
    // Compra 10 a $10 con fee $2 -> costo 102, PPC 10,2
    // Venta 5 a $12 con fee $1 -> 60 - 51 - 1 = 8
    const txs = [buy(0, 10, 10, 2), sell(1, 5, 12, 1)];
    const result = computeRealized(txs, "accion");
    expect(result).not.toBeNull();
    expect(result!.realized).toBeCloseTo(8);
    expect(result!.totalFees).toBe(3);
    expect(result!.sellCount).toBe(1);
    expect(result!.currency).toBe("ARS");
  });

  it("devuelve null sin ventas", () => {
    expect(computeRealized([buy(0, 10, 10)], "accion")).toBeNull();
  });

  it("coincide con el resultado total al vender toda la posición", () => {
    const txs = [buy(0, 10, 10), buy(1, 10, 20), sell(2, 20, 18)];
    // Costo 300, PPC 15; venta 20 x 18 = 360 -> realizado 60
    const result = computeRealized(txs, "accion");
    expect(result!.realized).toBeCloseTo(60);
  });
});

describe("simulateSell", () => {
  const position = { quantity: 10, costBasis: 100 };

  it("calcula lo recibido y el resultado de una venta parcial", () => {
    const sim = simulateSell(position, 4, 15, "accion");
    expect(sim.proceeds).toBe(60);
    expect(sim.realizedPnl).toBe(20);
    expect(sim.realizedPct).toBeCloseTo(0.5);
    expect(sim.remainingQty).toBe(6);
    expect(sim.remainingCost).toBeCloseTo(60);
  });

  it("capea la cantidad a la posición y deja costo cero al vender todo", () => {
    const sim = simulateSell(position, 15, 15, "accion");
    expect(sim.proceeds).toBe(150);
    expect(sim.remainingQty).toBe(0);
    expect(sim.remainingCost).toBe(0);
  });
});

describe("simulateBuy", () => {
  it("promedia el nuevo costo con la posición existente", () => {
    const sim = simulateBuy({ quantity: 10, costBasis: 100 }, 10, 20, "accion");
    expect(sim.cost).toBe(200);
    expect(sim.newQty).toBe(20);
    expect(sim.newCostBasis).toBe(300);
    expect(sim.newAvgPrice).toBe(15);
    expect(sim.prevAvgPrice).toBe(10);
    expect(sim.deltaAvgPct).toBeCloseTo(0.5);
  });

  it("arma una posición nueva sin holding previo", () => {
    const sim = simulateBuy(null, 5, 30, "accion");
    expect(sim.newAvgPrice).toBe(30);
    expect(sim.prevAvgPrice).toBeNull();
    expect(sim.deltaAvgPct).toBeNull();
  });

  it("expresa el PPC de renta fija por 100 nominales", () => {
    const sim = simulateBuy(null, 1000, 95, "bono");
    expect(sim.cost).toBe(950);
    expect(sim.newAvgPrice).toBeCloseTo(95);
  });
});

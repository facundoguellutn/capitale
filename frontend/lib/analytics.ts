// Cálculos financieros puros para la página de un activo.
// Usable en cliente y servidor (no importa nada server-only ni React).
import { isPer100, type AssetType, type Currency } from "@/lib/constants";
import type { AssetCandle } from "@/lib/types";

// Valor de mercado de una posición según el tipo de activo.
// Renta fija (bonos, letras, ONs): el precio es por 100 nominales.
export function positionValue(
  assetType: AssetType,
  quantity: number,
  price: number
): number {
  return isPer100(assetType) ? (quantity * price) / 100 : quantity * price;
}

// Subconjunto de una transacción necesario para los cálculos de posición
export type AnalyticsTransaction = {
  side: "compra" | "venta";
  quantity: number;
  price: number;
  currency: Currency;
  date: string | Date;
  fee?: number | null;
};

const DAY = 86400;

// Última vela cuyo time es <= `time` (las velas vienen ordenadas ascendente)
export function closeAtOrBefore(
  candles: AssetCandle[],
  time: number
): AssetCandle | null {
  let found: AssetCandle | null = null;
  for (const candle of candles) {
    if (candle.time <= time) found = candle;
    else break;
  }
  return found;
}

// Primera vela cuyo time es >= `time`; si no hay (fecha posterior al último
// dato), cae a la última vela. Para anclar marcadores en días no bursátiles.
export function snapToCandleTime(
  candles: AssetCandle[],
  time: number
): number | null {
  if (candles.length === 0) return null;
  for (const candle of candles) {
    if (candle.time >= time) return candle.time;
  }
  return candles[candles.length - 1].time;
}

// Media móvil simple de cierres; solo puntos con ventana completa
export function sma(
  candles: AssetCandle[],
  window: number
): { time: number; value: number }[] {
  if (window <= 0 || candles.length < window) return [];
  const out: { time: number; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= window) sum -= candles[i - window].close;
    if (i >= window - 1) {
      out.push({ time: candles[i].time, value: sum / window });
    }
  }
  return out;
}

// Desvío estándar de los retornos diarios simples, anualizado.
// periodsPerYear: 252 para mercados bursátiles, 365 para cripto.
export function annualizedVolatility(
  candles: AssetCandle[],
  periodsPerYear: number
): number | null {
  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    if (prev !== 0) returns.push(candles[i].close / prev - 1);
  }
  if (returns.length < 20) return null;
  const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

export type RangeStats = {
  high: number;
  low: number;
  last: number;
  // Negativo o cero: cuánto cayó desde el máximo del período
  pctFromHigh: number;
  // Positivo o cero: cuánto subió desde el mínimo del período
  pctAboveLow: number;
};

// Máximo/mínimo del período (por defecto 52 semanas) contra el último cierre
export function rangeStats(
  candles: AssetCandle[],
  days = 365
): RangeStats | null {
  if (candles.length === 0) return null;
  const lastCandle = candles[candles.length - 1];
  const from = lastCandle.time - days * DAY;
  const window = candles.filter((c) => c.time >= from);
  if (window.length < 2) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const candle of window) {
    if (candle.high > high) high = candle.high;
    if (candle.low < low) low = candle.low;
  }
  if (high <= 0 || low <= 0) return null;
  const last = lastCandle.close;
  return {
    high,
    low,
    last,
    pctFromHigh: (last - high) / high,
    pctAboveLow: (last - low) / low,
  };
}

// Mejor y peor retorno diario del período
export function bestWorstDay(
  candles: AssetCandle[],
  days = 365
): { best: { time: number; ret: number }; worst: { time: number; ret: number } } | null {
  if (candles.length < 3) return null;
  const from = candles[candles.length - 1].time - days * DAY;
  let best: { time: number; ret: number } | null = null;
  let worst: { time: number; ret: number } | null = null;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].time < from) continue;
    const prev = candles[i - 1].close;
    if (prev === 0) continue;
    const ret = candles[i].close / prev - 1;
    if (!best || ret > best.ret) best = { time: candles[i].time, ret };
    if (!worst || ret < worst.ret) worst = { time: candles[i].time, ret };
  }
  if (!best || !worst) return null;
  return { best, worst };
}

export type PriceZones = {
  low: number;
  // Tercil inferior del rango: por debajo, zona de compra
  buyBelow: number;
  // Tercil superior del rango: por encima, zona de venta
  sellAbove: number;
  high: number;
};

// Zonas orientativas por terciles del rango de 52 semanas
export function computeZones(
  candles: AssetCandle[],
  days = 365
): PriceZones | null {
  const stats = rangeStats(candles, days);
  if (!stats || stats.high <= stats.low) return null;
  const third = (stats.high - stats.low) / 3;
  return {
    low: stats.low,
    buyBelow: stats.low + third,
    sellAbove: stats.high - third,
    high: stats.high,
  };
}

function txTime(tx: AnalyticsTransaction): number {
  return Math.floor(new Date(tx.date).getTime() / 1000);
}

// Replay de operaciones con costo promedio ponderado, espejo de
// computeHoldings: las ventas reducen el costo al PPC vigente y los
// residuos ínfimos se clampean a cero.
function applyTransaction(
  state: { quantity: number; costBasis: number },
  tx: AnalyticsTransaction,
  assetType: AssetType
) {
  const tradeValue = positionValue(assetType, tx.quantity, tx.price);
  if (tx.side === "compra") {
    state.quantity += tx.quantity;
    state.costBasis += tradeValue + (tx.fee ?? 0);
  } else {
    const avgCostPerUnit =
      state.quantity > 0 ? state.costBasis / state.quantity : 0;
    state.quantity -= tx.quantity;
    state.costBasis -= avgCostPerUnit * tx.quantity;
    if (state.quantity <= 0.000001) {
      state.quantity = 0;
      state.costBasis = 0;
    }
  }
}

export type PositionPoint = {
  time: number;
  quantity: number;
  // Capital invertido (costo acumulado) en la moneda de las transacciones
  invested: number;
  // Valor de la posición en la moneda de las velas
  value: number;
};

// Serie diaria de la posición: cantidad, capital invertido y valor de
// mercado por vela, desde la primera operación. Las operaciones anteriores
// a la primera vela (p. ej. cripto con histórico limitado) siembran el
// estado inicial.
export function buildPositionSeries(
  transactions: AnalyticsTransaction[],
  candles: AssetCandle[],
  assetType: AssetType
): PositionPoint[] {
  if (transactions.length === 0 || candles.length === 0) return [];
  const sorted = [...transactions].sort((a, b) => txTime(a) - txTime(b));
  const state = { quantity: 0, costBasis: 0 };
  const points: PositionPoint[] = [];
  let txIndex = 0;
  let started = false;

  for (const candle of candles) {
    while (txIndex < sorted.length && txTime(sorted[txIndex]) <= candle.time) {
      applyTransaction(state, sorted[txIndex], assetType);
      txIndex++;
      started = true;
    }
    if (!started) continue;
    points.push({
      time: candle.time,
      quantity: state.quantity,
      invested: state.costBasis,
      value: positionValue(assetType, state.quantity, candle.close),
    });
  }
  return points;
}

export type AggregatedPoint = { time: number; invested: number; value: number };

// Suma varias series de posición en una sola serie de cartera. Cada serie
// debe venir ya expresada en la misma moneda (el caller convierte antes).
// Alinea los puntos al inicio de día UTC y hace forward-fill: en cada día de
// la unión, cada serie aporta su último punto conocido <= ese día. Una serie
// no aporta antes de su primer punto y mantiene su último valor hacia
// adelante (cubre feriados y velas de baja cadencia como las de cripto).
export function aggregatePositionSeries(
  seriesList: PositionPoint[][]
): AggregatedPoint[] {
  // Un punto por día (el último del día gana, series ascendentes)
  const normalized = seriesList.map((series) => {
    const byDay = new Map<number, PositionPoint>();
    for (const p of series) byDay.set(p.time - (p.time % DAY), p);
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, p]) => ({ time, invested: p.invested, value: p.value }));
  });

  const days = new Set<number>();
  for (const series of normalized) for (const p of series) days.add(p.time);
  const sortedDays = [...days].sort((a, b) => a - b);
  if (sortedDays.length === 0) return [];

  // Cursor por serie para el forward-fill
  const cursors = normalized.map(() => ({
    index: 0,
    invested: 0,
    value: 0,
    active: false,
  }));

  const out: AggregatedPoint[] = [];
  for (const day of sortedDays) {
    let invested = 0;
    let value = 0;
    for (let i = 0; i < normalized.length; i++) {
      const series = normalized[i];
      const cur = cursors[i];
      while (cur.index < series.length && series[cur.index].time <= day) {
        cur.invested = series[cur.index].invested;
        cur.value = series[cur.index].value;
        cur.active = true;
        cur.index++;
      }
      if (cur.active) {
        invested += cur.invested;
        value += cur.value;
      }
    }
    out.push({ time: day, invested, value });
  }
  return out;
}

export type RealizedResult = {
  // Resultado realizado acumulado de todas las ventas, en la moneda de las
  // transacciones (las fees de compra ya están capitalizadas en el costo)
  realized: number;
  totalFees: number;
  sellCount: number;
  currency: Currency;
};

// Resultado realizado: en cada venta, precio de venta menos el costo
// promedio vigente menos la fee de la venta. null si nunca hubo ventas.
export function computeRealized(
  transactions: AnalyticsTransaction[],
  assetType: AssetType
): RealizedResult | null {
  if (transactions.length === 0) return null;
  const sorted = [...transactions].sort((a, b) => txTime(a) - txTime(b));
  const state = { quantity: 0, costBasis: 0 };
  let realized = 0;
  let totalFees = 0;
  let sellCount = 0;

  for (const tx of sorted) {
    totalFees += tx.fee ?? 0;
    if (tx.side === "venta") {
      const avgCostPerUnit =
        state.quantity > 0 ? state.costBasis / state.quantity : 0;
      const proceeds = positionValue(assetType, tx.quantity, tx.price);
      realized += proceeds - avgCostPerUnit * tx.quantity - (tx.fee ?? 0);
      sellCount++;
    }
    applyTransaction(state, tx, assetType);
  }

  if (sellCount === 0) return null;
  return { realized, totalFees, sellCount, currency: sorted[0].currency };
}

export type SellSimulation = {
  proceeds: number;
  realizedPnl: number;
  realizedPct: number | null;
  remainingQty: number;
  remainingCost: number;
};

// Qué pasa si vendo `quantity` unidades a `price` (sin comisiones)
export function simulateSell(
  position: { quantity: number; costBasis: number },
  quantity: number,
  price: number,
  assetType: AssetType
): SellSimulation {
  const qty = Math.min(quantity, position.quantity);
  const proceeds = positionValue(assetType, qty, price);
  const avgCostPerUnit =
    position.quantity > 0 ? position.costBasis / position.quantity : 0;
  const costOut = avgCostPerUnit * qty;
  const remainingQty = Math.max(0, position.quantity - qty);
  return {
    proceeds,
    realizedPnl: proceeds - costOut,
    realizedPct: costOut > 0 ? (proceeds - costOut) / costOut : null,
    remainingQty,
    remainingCost:
      remainingQty <= 0.000001 ? 0 : Math.max(0, position.costBasis - costOut),
  };
}

export type BuySimulation = {
  cost: number;
  newQty: number;
  newCostBasis: number;
  // En la convención de mercado (renta fija: por 100)
  newAvgPrice: number;
  prevAvgPrice: number | null;
  deltaAvgPct: number | null;
};

// Qué pasa si compro `quantity` unidades más a `price` (sin comisiones).
// position null = posición nueva.
export function simulateBuy(
  position: { quantity: number; costBasis: number } | null,
  quantity: number,
  price: number,
  assetType: AssetType
): BuySimulation {
  const cost = positionValue(assetType, quantity, price);
  const prevQty = position?.quantity ?? 0;
  const prevCost = position?.costBasis ?? 0;
  const newQty = prevQty + quantity;
  const newCostBasis = prevCost + cost;
  const per100Factor = isPer100(assetType) ? 100 : 1;
  const newAvgPrice = newQty > 0 ? (newCostBasis / newQty) * per100Factor : 0;
  const prevAvgPrice = prevQty > 0 ? (prevCost / prevQty) * per100Factor : null;
  return {
    cost,
    newQty,
    newCostBasis,
    newAvgPrice,
    prevAvgPrice,
    deltaAvgPct:
      prevAvgPrice != null && prevAvgPrice !== 0
        ? (newAvgPrice - prevAvgPrice) / prevAvgPrice
        : null,
  };
}

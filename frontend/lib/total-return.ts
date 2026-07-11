import type { Currency } from "@/lib/constants";
import type { AssetCandle, FxHistoryPoint } from "@/lib/types";

export type ReturnCashFlow = {
  date: string;
  interest: number;
  amortization: number;
  currency: Currency;
};

export type TotalReturnPoint = {
  time: number;
  priceIndex: number;
  totalReturnIndex: number;
  cumulativeInterest: number;
  cumulativeAmortization: number;
  interestContribution: number;
  amortizationContribution: number;
};

export function fxAtOrBefore(points: FxHistoryPoint[], time: number): number | null {
  let value: number | null = null;
  for (const point of points) {
    if (point.time <= time) value = point.mep;
    else break;
  }
  return value;
}

export function convertAt(
  amount: number,
  from: Currency,
  to: Currency,
  time: number,
  fx: FxHistoryPoint[]
): number | null {
  if (from === to) return amount;
  const mep = fxAtOrBefore(fx, time);
  if (!mep) return null;
  return from === "ARS" ? amount / mep : amount * mep;
}

// Retorno total por cada 100 nominales, sin reinvertir cobros. La base es el
// precio de cierre inicial en la moneda objetivo; cada flujo se convierte con
// el MEP disponible en su propia fecha.
export function buildTotalReturnSeries({
  candles,
  priceCurrency,
  targetCurrency,
  cashFlows = [],
  fx = [],
}: {
  candles: AssetCandle[];
  priceCurrency: Currency;
  targetCurrency: Currency;
  cashFlows?: ReturnCashFlow[];
  fx?: FxHistoryPoint[];
}): TotalReturnPoint[] {
  if (candles.length < 2) return [];
  const orderedFx = [...fx].sort((a, b) => a.time - b.time);
  const startTime = candles[0].time;
  const basePrice = convertAt(candles[0].close, priceCurrency, targetCurrency, startTime, orderedFx);
  if (!basePrice || basePrice <= 0) return [];
  const flows = cashFlows
    .map((flow) => ({ ...flow, time: Math.floor(new Date(`${flow.date}T00:00:00Z`).getTime() / 1000) }))
    .filter((flow) => flow.time > startTime)
    .sort((a, b) => a.time - b.time);
  let flowIndex = 0;
  let cumulativeInterest = 0;
  let cumulativeAmortization = 0;
  const result: TotalReturnPoint[] = [];
  for (const candle of candles) {
    const price = convertAt(candle.close, priceCurrency, targetCurrency, candle.time, orderedFx);
    if (price == null) continue;
    while (flowIndex < flows.length && flows[flowIndex].time <= candle.time) {
      const flow = flows[flowIndex];
      // El cierre MEP del mismo día puede tener hora posterior al evento.
      const endOfFlowDay = flow.time + 86399;
      const interest = convertAt(flow.interest, flow.currency, targetCurrency, endOfFlowDay, orderedFx);
      const amortization = convertAt(flow.amortization, flow.currency, targetCurrency, endOfFlowDay, orderedFx);
      if (interest != null) cumulativeInterest += interest;
      if (amortization != null) cumulativeAmortization += amortization;
      flowIndex++;
    }
    result.push({
      time: candle.time,
      priceIndex: price / basePrice * 100,
      totalReturnIndex: (price + cumulativeInterest + cumulativeAmortization) / basePrice * 100,
      cumulativeInterest,
      cumulativeAmortization,
      interestContribution: cumulativeInterest / basePrice * 100,
      amortizationContribution: cumulativeAmortization / basePrice * 100,
    });
  }
  return result;
}

import { describe, expect, it } from "vitest";
import { buildTotalReturnSeries, convertAt } from "@/lib/total-return";

const day = (date: string) => Math.floor(new Date(`${date}T16:00:00Z`).getTime() / 1000);

describe("total return", () => {
  it("convierte cada importe con el último MEP de esa fecha", () => {
    const fx = [{ time: day("2026-01-01"), mep: 1000 }, { time: day("2026-01-03"), mep: 1200 }];
    expect(convertAt(10, "USD", "ARS", day("2026-01-02"), fx)).toBe(10000);
  });

  it("una amortización compensa la baja ex cupón", () => {
    const candles = [
      { time: day("2026-01-01"), open: 60, high: 60, low: 60, close: 60 },
      { time: day("2026-01-10"), open: 51.7, high: 51.7, low: 51.7, close: 51.7 },
    ];
    const series = buildTotalReturnSeries({
      candles,
      priceCurrency: "USD",
      targetCurrency: "USD",
      cashFlows: [{ date: "2026-01-09", interest: 0.3, amortization: 8, currency: "USD" }],
    });
    expect(series[1].priceIndex).toBeCloseTo(86.17, 1);
    expect(series[1].totalReturnIndex).toBeCloseTo(100, 5);
  });

  it("convierte el flujo USD a ARS con el MEP de pago", () => {
    const series = buildTotalReturnSeries({
      candles: [
        { time: day("2026-01-01"), open: 60000, high: 60000, low: 60000, close: 60000 },
        { time: day("2026-01-10"), open: 62040, high: 62040, low: 62040, close: 62040 },
      ],
      priceCurrency: "ARS",
      targetCurrency: "ARS",
      fx: [{ time: day("2026-01-01"), mep: 1000 }, { time: day("2026-01-09"), mep: 1200 }],
      cashFlows: [{ date: "2026-01-09", interest: 0.3, amortization: 8, currency: "USD" }],
    });
    expect(series[1].cumulativeAmortization).toBe(9600);
    expect(series[1].cumulativeInterest).toBe(360);
    expect(series[1].totalReturnIndex).toBe(120);
  });
});

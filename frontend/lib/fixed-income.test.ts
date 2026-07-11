import { describe, expect, it } from "vitest";
import { daysUntil, fixedIncomeMetrics, getFixedIncomeInstrument, inferArgentineNote, xirr, zeroCouponYield } from "@/lib/fixed-income";

describe("fixed income", () => {
  it("infiere el vencimiento de una letra y rechaza fechas inválidas", () => {
    expect(inferArgentineNote("S30S6")?.maturityDate).toBe("2026-09-30");
    expect(inferArgentineNote("S31L6")?.maturityDate).toBe("2026-07-31");
    expect(inferArgentineNote("S31J6")).toBeNull();
  });

  it("unifica las especies del GD30", () => {
    expect(getFixedIncomeInstrument("GD30D", "bono")?.ticker).toBe("GD30");
  });

  it("calcula XIRR anual", () => {
    expect(xirr([{ date: "2025-01-01", amount: -100 }, { date: "2026-01-01", amount: 110 }])!).toBeCloseTo(0.1, 3);
  });

  it("cuenta los días hasta una fecha en UTC", () => {
    const asOf = new Date("2026-07-11T18:00:00Z");
    expect(daysUntil("2026-07-31", asOf)).toBe(20);
    expect(daysUntil("2026-07-11", asOf)).toBe(0);
  });

  it("calcula el rendimiento implícito de una letra y rechaza entradas inválidas", () => {
    const y = zeroCouponYield(90, 365)!;
    expect(y.totalReturn).toBeCloseTo(0.1111, 3);
    expect(y.tna).toBeCloseTo(0.1111, 3);
    expect(y.tea).toBeCloseTo(0.1111, 3);
    // A menor plazo, la misma ganancia anualiza más alto.
    expect(zeroCouponYield(90, 180)!.tna).toBeGreaterThan(y.tna);
    expect(zeroCouponYield(0, 365)).toBeNull();
    expect(zeroCouponYield(90, 0)).toBeNull();
  });

  it("calcula paridad y métricas con flujos restantes", () => {
    const instrument = getFixedIncomeInstrument("AL30", "bono")!;
    const metrics = fixedIncomeMetrics(instrument, 55, new Date("2026-01-10T00:00:00Z"));
    expect(metrics?.parity).toBeGreaterThan(0);
    expect(metrics?.ytm).not.toBeNull();
  });
});

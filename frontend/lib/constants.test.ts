import { describe, expect, it } from "vitest";
import { canonicalTicker } from "@/lib/constants";

describe("canonicalTicker", () => {
  it("unifica las puntas dólar/cable de un bono al ticker base", () => {
    expect(canonicalTicker("GD30D", "bono")).toBe("GD30");
    expect(canonicalTicker("GD30C", "bono")).toBe("GD30");
    expect(canonicalTicker("AL30D", "bono")).toBe("AL30");
  });

  it("deja intacta la punta en pesos", () => {
    expect(canonicalTicker("GD30", "bono")).toBe("GD30");
    expect(canonicalTicker("AL35", "bono")).toBe("AL35");
  });

  it("no toca otros tipos de activo", () => {
    // Un CEDEAR/acción que termine en D no es una punta de liquidación
    expect(canonicalTicker("AMD", "cedear")).toBe("AMD");
    expect(canonicalTicker("JD", "cedear")).toBe("JD");
    // Las ONs usan otra convención (YMCJO peso / YMCJD dólar): no se normalizan
    expect(canonicalTicker("YMCJD", "on")).toBe("YMCJD");
  });

  it("normaliza a mayúsculas", () => {
    expect(canonicalTicker("gd30d", "bono")).toBe("GD30");
  });
});

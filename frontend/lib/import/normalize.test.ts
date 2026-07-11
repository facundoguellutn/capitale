import { describe, expect, it } from "vitest";
import {
  autoMapColumns,
  buildDrafts,
  cocosFee,
  cocosReconciliationIssue,
  extractCocosTicker,
  inferCocosAssetType,
} from "@/lib/import/normalize";
import { detectImportFormat } from "@/lib/import/parse";
import type { RawTable } from "@/lib/import/types";

const cocosHeaders = [
  "nroTicket",
  "nroComprobante",
  "fechaEjecucion",
  "fechaLiquidacion",
  "tipoOperacion",
  "instrumento",
  "moneda",
  "mercado",
  "cantidad",
  "precio",
  "montoBruto",
  "comision",
  "ddmm",
  "iva",
  "otros",
  "total",
];

function cocosRow(overrides: Record<string, unknown> = {}) {
  return {
    nroTicket: 88590907,
    nroComprobante: 1295766,
    fechaEjecucion: new Date("2026-02-05T03:00:00.000Z"),
    fechaLiquidacion: new Date("2026-02-06T03:00:00.000Z"),
    tipoOperacion: "Compra",
    instrumento: "CEDEAR META PLATFORMS INC. (META)",
    moneda: "ARS",
    mercado: "BYMA",
    cantidad: 4,
    precio: 41140,
    montoBruto: -164560,
    comision: -740.52,
    ddmm: -82.28,
    iva: -172.788,
    otros: 0,
    total: -165555.59,
    ...overrides,
  };
}

describe("formato Cocos Capital", () => {
  it("detecta el formato por sus encabezados", () => {
    expect(detectImportFormat(cocosHeaders)).toBe("cocos");
    expect(detectImportFormat(["Fecha", "Tipo", "Cantidad", "Precio"])).toBe(
      "generic"
    );
  });

  it("extrae el ticker e infiere los tipos de activo soportados", () => {
    expect(extractCocosTicker("CEDEAR DE MICROSOFT CORP. (MSFT)")).toBe("MSFT");
    expect(extractCocosTicker("BONOS DEL TESORO (CER) 2028 (TX28)")).toBe("TX28");
    expect(inferCocosAssetType("CEDEAR META (META)")).toBe("cedear");
    expect(inferCocosAssetType("LETRA TESORO (S30A6)")).toBe("letra");
    expect(inferCocosAssetType("BONOS DEL TESORO (TX28)")).toBe("bono");
  });

  it("suma todos los gastos como una comisión positiva y concilia el total", () => {
    const row = cocosRow();
    expect(cocosFee(row)).toBeCloseTo(995.588);
    expect(cocosReconciliationIssue(row)).toBeNull();
    expect(cocosReconciliationIssue({ ...row, total: -160000 })).toMatch(
      /no concilia/
    );
  });

  it("normaliza una compra completa y conserva el ticket externo", () => {
    const raw: RawTable = {
      format: "cocos",
      headers: cocosHeaders,
      rows: [cocosRow()],
    };
    const mapping = autoMapColumns(raw.headers);
    const [draft] = buildDrafts(raw, mapping, new Map());

    expect(draft.excluded).toBe(false);
    expect(draft.issues).toEqual([]);
    expect(draft.values).toMatchObject({
      ticker: "META",
      assetType: "cedear",
      side: "compra",
      quantity: 4,
      price: 41140,
      currency: "ARS",
      importSource: "cocos",
      externalId: "88590907",
    });
    expect(draft.values.fee).toBeCloseTo(995.588);
    expect(draft.values.date?.toISOString()).toBe("2026-02-05T03:00:00.000Z");
  });

  it("respeta el precio por 100 de bonos y letras sin transformarlo", () => {
    const raw: RawTable = {
      format: "cocos",
      headers: cocosHeaders,
      rows: [
        cocosRow({
          nroTicket: 88594685,
          instrumento: "LETRA TESORO NACIONAL CAPITALIZABLE (S30A6)",
          cantidad: 116229,
          precio: 118.65,
          montoBruto: -137905.71,
          comision: -482.67,
          ddmm: -1.3791,
          iva: 0,
          total: -138389.76,
        }),
      ],
    };
    const [draft] = buildDrafts(raw, autoMapColumns(raw.headers), new Map());
    expect(draft.issues).toEqual([]);
    expect(draft.values).toMatchObject({
      ticker: "S30A6",
      assetType: "letra",
      quantity: 116229,
      price: 118.65,
    });
  });

  it("excluye FCI y movimientos de efectivo con una razón visible", () => {
    const raw: RawTable = {
      format: "cocos",
      headers: cocosHeaders,
      rows: [
        cocosRow({
          tipoOperacion: "Liquidacion Suscripcion Fci",
          instrumento: "FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA)",
        }),
        cocosRow({ tipoOperacion: "Recibo De Cobro", instrumento: null }),
      ],
    };
    const drafts = buildDrafts(raw, autoMapColumns(raw.headers), new Map());
    expect(drafts[0]).toMatchObject({
      excluded: true,
      issues: ["FCI todavía no soportado"],
    });
    expect(drafts[1]).toMatchObject({
      excluded: true,
      issues: ["No es una compra/venta"],
    });
  });
});


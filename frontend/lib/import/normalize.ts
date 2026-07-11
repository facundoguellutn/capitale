// Normalización de datos importados: mapeo de columnas, números con coma,
// fechas en varios formatos y validación por fila. Funciones puras.
import {
  ASSET_TYPES,
  type AssetType,
  type Currency,
  type TransactionSide,
} from "@/lib/constants";
import { investmentTransactionSchema } from "@/lib/schemas";
import type {
  ColumnMapping,
  ImportField,
  ImportRowDraft,
  RawTable,
} from "@/lib/import/types";

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Sinónimos de headers (ya sin acentos y en minúscula) por campo. Cubre la
// plantilla propia y los nombres del Excel de IOL ("Operaciones Históricas":
// Tipo Mov. / Concert. / Cant. titulos / Comis. / Tipo Cuenta).
const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  date: [
    "fecha", "date", "fecha operada", "fecha de operacion",
    "fecha concertacion", "concert.", "concert", "concertacion",
  ],
  side: [
    "tipo", "operacion", "tipo de operacion", "side", "detalle",
    "descripcion", "tipo mov.", "tipo mov", "movimiento",
  ],
  ticker: ["ticker", "especie", "simbolo", "symbol", "activo", "instrumento"],
  assetType: ["tipoactivo", "tipo activo", "tipo de activo", "asset type"],
  quantity: [
    "cantidad", "nominales", "qty", "cantidad operada",
    "cant. titulos", "cant titulos", "cant.", "cant",
  ],
  price: ["precio", "precio unitario", "precio operado", "price", "cotizacion"],
  currency: ["moneda", "currency", "divisa", "tipo cuenta"],
  fee: ["comision", "fee", "arancel", "comisiones", "costos", "comis.", "comis"],
  note: ["nota", "observaciones", "comentario", "notas"],
};

// Cuántos campos matchean con las celdas de una fila: sirve para detectar la
// fila de headers cuando el archivo trae filas de título arriba (caso IOL)
export function countHeaderMatches(cells: unknown[]): number {
  const norms = cells
    .map((c) => normalizeHeader(String(c ?? "")))
    .filter(Boolean);
  let count = 0;
  for (const synonyms of Object.values(HEADER_SYNONYMS)) {
    if (norms.some((n) => synonyms.includes(n) || synonyms.some((s) => n.includes(s)))) {
      count++;
    }
  }
  return count;
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map((h) => ({ header: h, norm: normalizeHeader(h) }));
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [
    ImportField,
    string[],
  ][]) {
    // Match exacto primero, después por inclusión
    const exact = normalized.find((h) => synonyms.includes(h.norm));
    const partial =
      exact ??
      normalized.find((h) => synonyms.some((s) => h.norm.includes(s)));
    const match = exact ?? partial;
    if (match && !Object.values(mapping).includes(match.header)) {
      mapping[field] = match.header;
    }
  }
  return mapping;
}

// "1.234,56" | "1234.56" | "4500,50" | 4500.5 -> número
export function parseLocaleNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  let s = String(value).replace(/[\s$]/g, "").replace(/us\$?/i, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // El separador que aparece último es el decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Date (cellDates de xlsx) | "DD/MM/YYYY" | "DD-MM-YYYY" | "YYYY-MM-DD" -> ISO
export function parseFlexibleDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? Number(y) + 2000 : Number(y);
    const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

// compra/buy -> "compra"; venta/sell -> "venta"; otro (dividendos, depósitos,
// suscripciones) -> null, la fila se excluye por no ser una operación
export function normalizeSide(value: unknown): TransactionSide | null {
  if (value == null) return null;
  const s = normalizeHeader(String(value));
  if (!s) return null;
  if (s.includes("compra") || s.includes("buy")) return "compra";
  if (s.includes("venta") || s.includes("sell")) return "venta";
  return null;
}

export function normalizeCurrency(value: unknown): Currency | null {
  if (value == null || String(value).trim() === "") return "ARS";
  const s = normalizeHeader(String(value));
  if (/(usd|us\$|u\$s|u\$d|dolar)/.test(s)) return "USD";
  if (/(ars|peso|^\$$)/.test(s) || s === "$") return "ARS";
  return null;
}

// IOL no trae columna de ticker: viene entre paréntesis en el texto de la
// operación, ej. "Compra(GGAL)", "Pago de Dividendos(KO US$)" -> "KO"
export function extractTickerFromText(value: unknown): string {
  if (value == null) return "";
  const match = String(value).match(/\(([^)]+)\)/);
  if (!match) return "";
  return match[1]
    .replace(/\s*(us\$|u\$s|u\$d|usd)\s*$/i, "")
    .trim()
    .toUpperCase();
}

// Cocos incluye el símbolo al final de la descripción del instrumento.
// Se toma el último paréntesis porque el nombre puede contener otros antes.
export function extractCocosTicker(value: unknown): string {
  if (value == null) return "";
  const matches = [...String(value).matchAll(/\(([^)]+)\)/g)];
  return (matches.at(-1)?.[1] ?? "").trim().toUpperCase();
}

export function inferCocosAssetType(value: unknown): AssetType | null {
  const instrument = normalizeHeader(String(value ?? ""));
  if (instrument.startsWith("cedear")) return "cedear";
  if (instrument.startsWith("letra")) return "letra";
  if (instrument.startsWith("bono")) return "bono";
  if (instrument.startsWith("obligacion negociable")) return "on";
  if (instrument.startsWith("accion")) return "accion";
  return null;
}

function cocosNumber(row: Record<string, unknown>, header: string): number {
  return parseLocaleNumber(row[header]) ?? 0;
}

export function cocosFee(row: Record<string, unknown>): number {
  return Math.abs(
    cocosNumber(row, "comision") +
      cocosNumber(row, "ddmm") +
      cocosNumber(row, "iva") +
      cocosNumber(row, "otros")
  );
}

export function cocosReconciliationIssue(
  row: Record<string, unknown>
): string | null {
  const gross = parseLocaleNumber(row.montoBruto);
  const total = parseLocaleNumber(row.total);
  if (gross == null || total == null) return null;
  const expected =
    gross +
    cocosNumber(row, "comision") +
    cocosNumber(row, "ddmm") +
    cocosNumber(row, "iva") +
    cocosNumber(row, "otros");
  return Math.abs(expected - total) <= 0.02
    ? null
    : "El total no concilia con el bruto y los gastos";
}

export function normalizeAssetType(value: unknown): AssetType | null {
  if (value == null) return null;
  const s = normalizeHeader(String(value));
  if (!s) return null;
  if (s.includes("cedear")) return "cedear";
  if (s.includes("letra") || s.includes("lecap") || s.includes("lecer"))
    return "letra";
  if (s.includes("obligacion")) return "on";
  if (s.includes("accion") || s.includes("stock")) return "accion";
  if (s.includes("bono") || s.includes("bond") || s.includes("titulo publico"))
    return "bono";
  if (s.includes("cripto") || s.includes("crypto")) return "cripto";
  return (ASSET_TYPES as readonly string[]).includes(s) ? (s as AssetType) : null;
}

// accountId placeholder para validar filas antes de elegir la cuenta destino
const PLACEHOLDER_ACCOUNT_ID = "0".repeat(24);

// Issues de una fila ya normalizada. Se usa al armar los drafts y al
// revalidar después de una edición en el preview.
export function computeIssues(values: ImportRowDraft["values"]): string[] {
  const issues: string[] = [];
  if (!values.ticker) issues.push("Falta el ticker");
  if (values.quantity == null) issues.push("Cantidad inválida");
  if (values.price == null) issues.push("Precio inválido");
  if (values.date == null) issues.push("Fecha inválida");
  if (values.currency == null) issues.push("Moneda inválida (usar ARS o USD)");
  if (values.ticker && values.assetType == null)
    issues.push("Activo no reconocido: elegilo con el buscador");
  if (values.assetType === "cripto" && !values.coingeckoId)
    issues.push("Cripto: elegí el activo con el buscador");
  if (issues.length > 0) return issues;

  // Con todos los campos presentes, validar contra el schema real
  const parsed = investmentTransactionSchema.safeParse({
    ...values,
    accountId: PLACEHOLDER_ACCOUNT_ID,
  });
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => issue.message);
}

export function buildDrafts(
  raw: RawTable,
  mapping: ColumnMapping,
  tickerTypes: Map<string, AssetType>
): ImportRowDraft[] {
  const drafts: ImportRowDraft[] = [];

  raw.rows.forEach((row, i) => {
    const get = (field: ImportField) => {
      const header = mapping[field];
      return header ? row[header] : null;
    };

    // Filas completamente vacías se descartan sin mostrar
    const isEmpty = Object.values(row).every(
      (v) => v == null || String(v).trim() === ""
    );
    if (isEmpty) return;

    const sideRaw = get("side");
    let side = normalizeSide(sideRaw);
    // Sin columna de ticker (o vacía), intentar extraerlo del texto de la
    // operación (formato IOL: "Compra(GGAL)")
    const instrument = get("ticker");
    const ticker =
      (raw.format === "cocos"
        ? extractCocosTicker(instrument)
        : String(instrument ?? "").trim().toUpperCase()) ||
      extractTickerFromText(sideRaw);
    const quantity = parseLocaleNumber(get("quantity"));
    const price = parseLocaleNumber(get("price"));
    const date = parseFlexibleDate(get("date"));
    const currency = normalizeCurrency(get("currency"));
    const fee =
      raw.format === "cocos" ? cocosFee(row) : parseLocaleNumber(get("fee"));
    let note = String(get("note") ?? "").trim() || undefined;

    if (side === null) {
      // Dividendo en acciones / ajuste de ratio: entrega títulos sin costo.
      // Se importa como compra a precio 0 (suma cantidad, no mueve efectivo)
      const isStockDividend =
        /dividendo/i.test(String(sideRaw ?? "")) &&
        ticker !== "" &&
        (quantity ?? 0) > 0 &&
        (price ?? 0) === 0;
      if (isStockDividend) {
        side = "compra";
        note = note ?? "Dividendo en acciones";
      } else {
        const exclusionReason =
          raw.format === "cocos" &&
          /suscripcion|rescate.*fci/i.test(String(sideRaw ?? ""))
            ? "FCI todavía no soportado"
            : "No es una compra/venta";
        // No es compra/venta (dividendo en efectivo, depósito, etc.):
        // se excluye pero se muestra
        drafts.push({
          index: i + 2, // +2: base 1 más la fila de headers
          values: { ticker: ticker || undefined },
          asset: null,
          issues: [exclusionReason],
          excluded: true,
        });
        return;
      }
    }

    const assetType =
      normalizeAssetType(get("assetType")) ??
      (raw.format === "cocos" ? inferCocosAssetType(instrument) : null) ??
      tickerTypes.get(ticker) ??
      null;

    const values: ImportRowDraft["values"] = {
      side,
      ticker: ticker || undefined,
      assetType: assetType ?? undefined,
      quantity: quantity ?? undefined,
      price: price ?? undefined,
      currency: currency ?? undefined,
      date: date ? new Date(date) : undefined,
      fee: fee ?? undefined,
      note,
      importSource: raw.format,
      externalId:
        raw.format === "cocos" && row.nroTicket != null
          ? String(row.nroTicket)
          : undefined,
    };

    if (raw.format === "cocos") {
      values.note = note || String(instrument ?? "").trim() || undefined;
    }

    const issues = computeIssues(values);
    if (raw.format === "cocos") {
      const reconciliationIssue = cocosReconciliationIssue(row);
      if (reconciliationIssue) issues.push(reconciliationIssue);
    }

    drafts.push({
      index: i + 2,
      values,
      asset: null,
      issues,
      excluded: false,
    });
  });

  return drafts;
}

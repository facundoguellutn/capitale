// Tipos del flujo de importación de operaciones desde archivos (CSV/XLS/XLSX)
import type { InvestmentTransactionInput } from "@/lib/schemas";
import type { AssetSearchResult } from "@/lib/types";

// Campos de una operación que pueden venir mapeados desde el archivo
export const IMPORT_FIELDS = [
  "date",
  "side",
  "ticker",
  "assetType",
  "quantity",
  "price",
  "currency",
  "fee",
  "note",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

// El ticker no es obligatorio en el mapeo: si no hay columna propia se
// intenta extraer del texto de la operación (IOL lo pone entre paréntesis)
export const REQUIRED_FIELDS: ImportField[] = [
  "date",
  "side",
  "quantity",
  "price",
];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  date: "Fecha",
  side: "Tipo (compra/venta)",
  ticker: "Ticker / Especie",
  assetType: "Tipo de activo",
  quantity: "Cantidad",
  price: "Precio",
  currency: "Moneda",
  fee: "Comisión",
  note: "Nota",
};

// field -> header del archivo
export type ColumnMapping = Partial<Record<ImportField, string>>;

export type RawTable = {
  headers: string[];
  rows: Record<string, unknown>[];
};

export type ImportRowDraft = {
  // Número de fila original del archivo (para mensajes al usuario)
  index: number;
  values: Partial<Omit<InvestmentTransactionInput, "accountId">>;
  // Activo resuelto (por panel BYMA o elegido a mano en el preview)
  asset: AssetSearchResult | null;
  // Vacío = fila válida
  issues: string[];
  // Filas que no son compra/venta (dividendos, depósitos) o desmarcadas
  excluded: boolean;
};

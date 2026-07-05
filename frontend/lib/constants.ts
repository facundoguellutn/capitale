export const CURRENCIES = ["ARS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const ACCOUNT_TYPES = [
  "banco",
  "billetera",
  "broker",
  "exchange",
  "efectivo",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  banco: "Banco",
  billetera: "Billetera virtual",
  broker: "Broker",
  exchange: "Exchange",
  efectivo: "Efectivo",
};

export const INCOME_KINDS = ["sueldo", "freelance", "otro"] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

export const INCOME_KIND_LABELS: Record<IncomeKind, string> = {
  sueldo: "Sueldo",
  freelance: "Freelance / Proyecto",
  otro: "Otro",
};

export const EXPENSE_CATEGORIES = [
  "vivienda",
  "comida",
  "transporte",
  "servicios",
  "salud",
  "entretenimiento",
  "viajes",
  "ropa",
  "educacion",
  "impuestos",
  "regalos",
  "otros",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  vivienda: "Vivienda",
  comida: "Comida",
  transporte: "Transporte",
  servicios: "Servicios",
  salud: "Salud",
  entretenimiento: "Entretenimiento",
  viajes: "Viajes",
  ropa: "Ropa",
  educacion: "Educación",
  impuestos: "Impuestos",
  regalos: "Regalos",
  otros: "Otros",
};

export const ASSET_TYPES = ["accion", "cedear", "bono", "cripto"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  accion: "Acción argentina",
  cedear: "CEDEAR",
  bono: "Bono",
  cripto: "Cripto",
};

export const TRANSACTION_SIDES = ["compra", "venta"] as const;
export type TransactionSide = (typeof TRANSACTION_SIDES)[number];

export const FIXED_TERM_STATUSES = ["activo", "cobrado"] as const;
export type FixedTermStatus = (typeof FIXED_TERM_STATUSES)[number];

// Casa de DolarAPI usada para conversión ARS <-> USD en toda la app
export const FX_CASA = "bolsa"; // dólar MEP

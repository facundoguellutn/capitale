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

// Catálogo de cuentas predefinidas. Agregar acá los nuevos proveedores.
export type AccountProvider = {
  id: string;
  name: string;
  logo: string;
  type: AccountType;
};

export const ACCOUNT_PROVIDERS: AccountProvider[] = [
  { id: "iol", name: "Invertir Online", logo: "/logos/iol.jpg", type: "broker" },
  { id: "cocos", name: "Cocos Capital", logo: "/logos/cocos.png", type: "broker" },
  { id: "brubank", name: "Brubank", logo: "/logos/brubank.jpg", type: "banco" },
  { id: "naranjax", name: "Naranja X", logo: "/logos/naranjax.jpg", type: "billetera" },
  { id: "mercadopago", name: "Mercado Pago", logo: "/logos/mercado.png", type: "billetera" },
  { id: "takenos", name: "Takenos", logo: "/logos/takenos.png", type: "billetera" },
];

export const ACCOUNT_PROVIDER_IDS = ACCOUNT_PROVIDERS.map((p) => p.id);

export function getAccountProvider(id?: string | null): AccountProvider | undefined {
  if (!id) return undefined;
  return ACCOUNT_PROVIDERS.find((p) => p.id === id);
}

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

export const ASSET_TYPES = [
  "accion",
  "cedear",
  "bono",
  "letra",
  "on",
  "cripto",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  accion: "Acción argentina",
  cedear: "CEDEAR",
  bono: "Bono",
  letra: "Letra del Tesoro",
  on: "Obligación negociable",
  cripto: "Cripto",
};

// Tipos de renta fija que cotizan por 100 nominales (el precio es "por 100")
export const PER_100_ASSET_TYPES: readonly AssetType[] = ["bono", "letra", "on"];

export function isPer100(assetType: AssetType): boolean {
  return PER_100_ASSET_TYPES.includes(assetType);
}

// Los bonos soberanos cotizan y liquidan en tres puntas que son la MISMA
// especie: pesos (GD30), dólar MEP (GD30D) y cable (GD30C). Se unifican al
// ticker base para que una operación de dólar MEP (compra en pesos + venta en
// dólares del mismo bono) se netee en una sola posición en vez de quedar como
// dos tickers distintos que inflan la cartera.
// Nota: solo aplica a bonos. Las ONs usan otra convención de sufijos (YMCJO
// peso / YMCJD dólar, con base distinta) y no se normalizan acá.
export function canonicalTicker(ticker: string, assetType: AssetType): string {
  const t = ticker.toUpperCase();
  if (assetType === "bono" && /[DC]$/.test(t)) return t.slice(0, -1);
  return t;
}

// Todas las puntas de negociación de un bono representan el mismo instrumento.
// Se usa tanto al valuar como al vincular operaciones con su ficha de detalle.
export function sameInstrument(
  left: string,
  right: string,
  assetType: AssetType
): boolean {
  return canonicalTicker(left, assetType) === canonicalTicker(right, assetType);
}

// Orden de preferencia para históricos. La punta en pesos suele tener mayor
// cobertura; nunca se cambia silenciosamente la moneda de la serie solicitada.
export function bondTickerCandidates(ticker: string): string[] {
  const requested = ticker.toUpperCase();
  const base = canonicalTicker(requested, "bono");
  return [...new Set([requested, base])];
}

export const TRANSACTION_SIDES = ["compra", "venta"] as const;
export type TransactionSide = (typeof TRANSACTION_SIDES)[number];

export const FIXED_TERM_STATUSES = ["activo", "cobrado"] as const;
export type FixedTermStatus = (typeof FIXED_TERM_STATUSES)[number];

// Casa de DolarAPI usada para conversión ARS <-> USD en toda la app
export const FX_CASA = "bolsa"; // dólar MEP

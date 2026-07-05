// Tipos de los objetos que viajan por la API interna (ya serializados)
import type {
  AccountType,
  AssetType,
  Currency,
  ExpenseCategory,
  FixedTermStatus,
  IncomeKind,
  TransactionSide,
} from "@/lib/constants";

export type ClientAccount = {
  id: string;
  name: string;
  provider?: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  archived: boolean;
};

export type ClientIncome = {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  kind: IncomeKind;
  source: string;
  accountId: string;
  note?: string;
};

export type ClientExpense = {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  accountId: string;
  note?: string;
};

export type ClientInvestmentTransaction = {
  id: string;
  assetType: AssetType;
  ticker: string;
  coingeckoId?: string;
  side: TransactionSide;
  quantity: number;
  price: number;
  currency: Currency;
  date: string;
  accountId: string;
  fee?: number;
  note?: string;
};

export type ClientFixedTerm = {
  id: string;
  bankName: string;
  principal: number;
  currency: Currency;
  tna: number;
  startDate: string;
  maturityDate: string;
  status: FixedTermStatus;
  note?: string;
  // Calculados en el server
  accruedValue: number;
  daysToMaturity: number;
};

export type DolarRate = {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
};

export type Quote = {
  ticker: string;
  price: number;
  currency: Currency;
  pctChange?: number;
};

export type AssetSearchResult = {
  ticker: string;
  name?: string;
  assetType: AssetType;
  coingeckoId?: string;
  logo?: string;
};

// Vela diaria para el gráfico del activo (timestamp en segundos)
export type AssetCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type AssetHistoryResponse = {
  ticker: string;
  currency: Currency;
  candles: AssetCandle[];
};

export type QuotesResponse = {
  dolares: DolarRate[];
  quotes: Quote[];
  mep: number | null;
  updatedAt: string;
};

export type Holding = {
  ticker: string;
  assetType: AssetType;
  coingeckoId?: string;
  quantity: number;
  // Costo total y precio promedio ponderado en la moneda de compra
  costBasis: number;
  avgPrice: number;
  currency: Currency;
  // Valuación actual (null si no hay cotización disponible)
  currentPrice: number | null;
  valueARS: number | null;
  valueUSD: number | null;
  pnl: number | null;
  pnlPct: number | null;
  pctChange?: number;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export type DashboardData = {
  totalARS: number;
  totalUSD: number;
  mep: number | null;
  byAssetType: { name: string; valueARS: number }[];
  byAccount: { name: string; valueARS: number }[];
  holdings: Holding[];
  expensesByCategory: { category: ExpenseCategory; totalARS: number }[];
  monthlyFlow: { month: string; incomeARS: number; expenseARS: number }[];
  snapshots: { date: string; totalARS: number; totalUSD: number }[];
};

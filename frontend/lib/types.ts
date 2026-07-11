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
  assetType?: AssetType;
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
  requestedTicker?: string;
  resolvedTicker?: string;
  status?: "available" | "empty" | "unsupported";
  fallbackUsed?: boolean;
};

export type InflationPoint = { time: number; value: number };
export type InflationResponse = {
  ars: InflationPoint[];
  usd: InflationPoint[];
  updatedAt: string;
};

export type FxHistoryPoint = { time: number; mep: number };
export type FxHistoryResponse = {
  points: FxHistoryPoint[];
  source: string;
  updatedAt: string;
};

// Cotización del panel completo de mercado (acciones/cedears/bonos)
export type MarketQuote = {
  ticker: string;
  price: number;
  pctChange: number;
};

export type MarketsResponse = {
  type: AssetType;
  quotes: MarketQuote[];
  mep: number | null;
  updatedAt: string;
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
  byAccount: {
    name: string;
    valueARS: number;
    cashARS: number;
    investmentsARS: number;
  }[];
  holdings: Holding[];
  portfolioKpis: {
    investedARS: number;
    valueARS: number;
    pnlARS: number;
    pnlPct: number | null;
    dayChangeARS: number;
    dayChangePct: number | null;
  };
  monthlyFlow: { month: string; incomeARS: number; expenseARS: number }[];
  snapshots: { date: string; totalARS: number; totalUSD: number }[];
};

// Evolución diaria de la cartera de inversiones (valor de mercado vs capital
// invertido), reconstruida de las operaciones y los históricos de precios.
export type PortfolioHistoryPoint = {
  time: number;
  investedARS: number;
  valueARS: number;
};

// Serie agregada de la cartera completa ("todos") o de un tipo de activo.
// El cliente elige cuál mostrar sin volver a pedir datos.
export type PortfolioHistorySeries = {
  assetType: AssetType | "todos";
  points: PortfolioHistoryPoint[];
};

export type PortfolioHistoryResponse = {
  mep: number | null;
  series: PortfolioHistorySeries[];
  // Tickers sin histórico disponible que no entraron en la agregación
  excludedTickers: string[];
};

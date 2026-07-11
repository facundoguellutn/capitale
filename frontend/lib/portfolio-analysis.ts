// Cálculos puros para la pestaña de análisis de cartera.
// Usable en cliente y servidor (no importa React ni nada server-only).
import { type AssetType, type Currency, canonicalTicker } from "@/lib/constants";
import { positionValue } from "@/lib/analytics";
import { convertAmount } from "@/lib/fx";
import { convertAt } from "@/lib/total-return";
import {
  daysUntil,
  fixedIncomeMetrics,
  futureFlows,
  getFixedIncomeInstrument,
} from "@/lib/fixed-income";
import type {
  ClientFixedTerm,
  ClientInvestmentTransaction,
  FxHistoryPoint,
  Holding,
  InflationPoint,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Inflación
// ---------------------------------------------------------------------------

export function indexAtOrBefore(points: InflationPoint[], time: number): number | null {
  let value: number | null = null;
  for (const point of points) {
    if (point.time <= time) value = point.value;
    else break;
  }
  return value;
}

// Inflación acumulada entre dos instantes según una serie de índice (IPC/CPI),
// como fracción (0.25 = 25%). Si la fecha inicial es anterior al primer dato,
// se usa el primer dato disponible.
export function cumulativeInflation(
  points: InflationPoint[],
  fromTime: number,
  toTime: number
): number | null {
  if (points.length === 0 || toTime <= fromTime) return null;
  const base = indexAtOrBefore(points, fromTime) ?? points[0].value;
  const end = indexAtOrBefore(points, toTime);
  if (base == null || end == null || base <= 0) return null;
  return end / base - 1;
}

// ---------------------------------------------------------------------------
// Retorno real por posición (desde la compra)
// ---------------------------------------------------------------------------

function txTime(tx: ClientInvestmentTransaction): number {
  return Math.floor(new Date(tx.date).getTime() / 1000);
}

// Fecha de compra promedio ponderada por el capital de cada compra.
export function weightedPurchaseTime(
  transactions: ClientInvestmentTransaction[]
): number | null {
  let weight = 0;
  let acc = 0;
  for (const tx of transactions) {
    if (tx.side !== "compra") continue;
    const cost = positionValue(tx.assetType, tx.quantity, tx.price) + (tx.fee ?? 0);
    if (cost <= 0) continue;
    weight += cost;
    acc += txTime(tx) * cost;
  }
  return weight > 0 ? Math.round(acc / weight) : null;
}

// Costo de la posición en la moneda objetivo, reconstruido operación por
// operación: cada compra se convierte con el MEP de su propia fecha (o el
// actual si no hay histórico) y las ventas reducen el costo al PPC vigente,
// espejo de computeHoldings. Esto soporta posiciones con operaciones en
// distintas monedas, donde el costBasis agregado no tiene una moneda única.
function replayCostInTarget(
  transactions: ClientInvestmentTransaction[],
  targetCurrency: Currency,
  fx: FxHistoryPoint[],
  mep: number | null
): number | null {
  const sorted = [...transactions].sort((a, b) => txTime(a) - txTime(b));
  let quantity = 0;
  let cost = 0;
  for (const tx of sorted) {
    if (tx.side === "compra") {
      const raw = positionValue(tx.assetType, tx.quantity, tx.price) + (tx.fee ?? 0);
      const converted =
        convertAt(raw, tx.currency, targetCurrency, txTime(tx), fx) ??
        convertAmount(raw, tx.currency, targetCurrency, mep);
      if (converted == null) return null;
      quantity += tx.quantity;
      cost += converted;
    } else {
      const avgCost = quantity > 0 ? cost / quantity : 0;
      quantity -= tx.quantity;
      cost -= avgCost * tx.quantity;
      if (quantity <= 0.000001) {
        quantity = 0;
        cost = 0;
      }
    }
  }
  return cost > 0 ? cost : null;
}

export type RealReturnRow = {
  ticker: string;
  assetType: AssetType;
  valueARS: number;
  purchaseTime: number;
  // Fracciones: 0.25 = 25%
  nominal: number;
  inflation: number;
  real: number;
  beatsInflation: boolean;
};

// Para cada posición: retorno nominal en la moneda objetivo desde la fecha de
// compra promedio, la inflación acumulada del mismo período y el retorno real.
export function computeRealReturns({
  holdings,
  transactions,
  cpi,
  targetCurrency,
  fx,
  mep,
  asOf = new Date(),
}: {
  holdings: Holding[];
  transactions: ClientInvestmentTransaction[];
  cpi: InflationPoint[];
  targetCurrency: Currency;
  fx: FxHistoryPoint[];
  mep: number | null;
  asOf?: Date;
}): RealReturnRow[] {
  const now = Math.floor(asOf.getTime() / 1000);
  const orderedFx = [...fx].sort((a, b) => a.time - b.time);
  const rows: RealReturnRow[] = [];

  for (const holding of holdings) {
    const txs = transactions.filter(
      (tx) => canonicalTicker(tx.ticker, tx.assetType) === holding.ticker
    );
    const purchaseTime = weightedPurchaseTime(txs);
    if (purchaseTime == null) continue;

    const currentValue =
      targetCurrency === "ARS" ? holding.valueARS : holding.valueUSD;
    if (currentValue == null || holding.valueARS == null) continue;

    const costInTarget = replayCostInTarget(txs, targetCurrency, orderedFx, mep);
    if (costInTarget == null) continue;

    const nominal = currentValue / costInTarget - 1;
    const inflation = cumulativeInflation(cpi, purchaseTime, now);
    if (inflation == null) continue;
    const real = (1 + nominal) / (1 + inflation) - 1;

    rows.push({
      ticker: holding.ticker,
      assetType: holding.assetType,
      valueARS: holding.valueARS,
      purchaseTime,
      nominal,
      inflation,
      real,
      beatsInflation: real > 0,
    });
  }

  return rows.sort((a, b) => b.real - a.real);
}

// Porcentaje de la cartera (ponderado por valor) que le gana a la inflación.
export function shareBeatingInflation(rows: RealReturnRow[]): number | null {
  const total = rows.reduce((sum, r) => sum + r.valueARS, 0);
  if (total <= 0) return null;
  const winning = rows.filter((r) => r.beatsInflation).reduce((sum, r) => sum + r.valueARS, 0);
  return winning / total;
}

// ---------------------------------------------------------------------------
// Composición de cartera
// ---------------------------------------------------------------------------

function fixedTermAccrued(deposit: ClientFixedTerm): number {
  return deposit.accruedValue;
}

function fixedTermValueARS(deposit: ClientFixedTerm, mep: number | null): number | null {
  return convertAmount(fixedTermAccrued(deposit), deposit.currency, "ARS", mep);
}

export type AllocationSlice = {
  key: string;
  label: string;
  valueARS: number;
  pct: number;
};

export function buildAllocation(
  entries: { key: string; label: string; valueARS: number | null }[]
): AllocationSlice[] {
  const byKey = new Map<string, AllocationSlice>();
  for (const entry of entries) {
    if (entry.valueARS == null || entry.valueARS <= 0) continue;
    const existing = byKey.get(entry.key);
    if (existing) existing.valueARS += entry.valueARS;
    else byKey.set(entry.key, { key: entry.key, label: entry.label, valueARS: entry.valueARS, pct: 0 });
  }
  const slices = [...byKey.values()].sort((a, b) => b.valueARS - a.valueARS);
  const total = slices.reduce((sum, s) => sum + s.valueARS, 0);
  if (total > 0) for (const slice of slices) slice.pct = slice.valueARS / total;
  return slices;
}

// Un activo cuenta como exposición al dólar si cotiza/liquida en USD o si es
// un bono hard-dollar (paga en USD aunque la punta cotice en pesos).
export function isDollarExposure(holding: Holding): boolean {
  if (holding.assetType === "cripto") return true;
  if (holding.currency === "USD") return true;
  const instrument = getFixedIncomeInstrument(holding.ticker, holding.assetType);
  return instrument?.currency === "USD";
}

export type ConcentrationRow = { ticker: string; valueARS: number; pct: number };

export function topConcentration(holdings: Holding[], top = 5): ConcentrationRow[] {
  const valued = holdings.filter((h) => h.valueARS != null && h.valueARS > 0);
  const total = valued.reduce((sum, h) => sum + h.valueARS!, 0);
  if (total <= 0) return [];
  return valued
    .sort((a, b) => b.valueARS! - a.valueARS!)
    .slice(0, top)
    .map((h) => ({ ticker: h.ticker, valueARS: h.valueARS!, pct: h.valueARS! / total }));
}

// ---------------------------------------------------------------------------
// Próximos cobros y proyección de ingresos
// ---------------------------------------------------------------------------

export type UpcomingPaymentKind = "renta" | "amortizacion" | "mixto" | "final" | "plazo-fijo";

export type UpcomingPayment = {
  date: string; // ISO
  time: number;
  days: number;
  source: string; // ticker o banco
  assetType: AssetType | "plazo-fijo";
  kind: UpcomingPaymentKind;
  currency: Currency;
  // Montos en la moneda original del instrumento, ya escalados por la tenencia
  interest: number;
  amortization: number;
  amount: number;
  // Convertidos al MEP actual (null si falta el MEP)
  interestARS: number | null;
  amortizationARS: number | null;
  amountARS: number | null;
};

function classifyBondFlow(interest: number, amortization: number, isFinal: boolean): UpcomingPaymentKind {
  if (isFinal) return "final";
  if (interest > 0 && amortization > 0) return "mixto";
  if (amortization > 0) return "amortizacion";
  return "renta";
}

export const PAYMENT_KIND_LABELS: Record<UpcomingPaymentKind, string> = {
  renta: "Renta (cupón)",
  amortizacion: "Amortización",
  mixto: "Renta + amortización",
  final: "Pago final",
  "plazo-fijo": "Plazo fijo",
};

// Todos los cobros futuros de la cartera: cupones y amortizaciones de la renta
// fija en posición más los vencimientos de plazos fijos activos.
export function collectUpcomingPayments({
  holdings,
  fixedTerms,
  mep,
  asOf = new Date(),
}: {
  holdings: Holding[];
  fixedTerms: ClientFixedTerm[];
  mep: number | null;
  asOf?: Date;
}): UpcomingPayment[] {
  const payments: UpcomingPayment[] = [];

  for (const holding of holdings) {
    const instrument = getFixedIncomeInstrument(holding.ticker, holding.assetType);
    if (!instrument) continue;
    const factor = holding.quantity / 100;
    const isLetra = instrument.flows.length === 1;
    for (const flow of futureFlows(instrument, asOf)) {
      const interest = flow.interest * factor;
      const amortization = flow.amortization * factor;
      const amount = interest + amortization;
      if (amount <= 0) continue;
      const isFinal = flow.date === instrument.maturityDate;
      payments.push({
        date: flow.date,
        time: Math.floor(new Date(`${flow.date}T00:00:00Z`).getTime() / 1000),
        days: daysUntil(flow.date, asOf),
        source: holding.ticker,
        assetType: holding.assetType,
        // La redención de una letra devuelve el capital: se clasifica final
        kind: isLetra ? "final" : classifyBondFlow(flow.interest, flow.amortization, isFinal),
        currency: instrument.currency,
        interest,
        amortization,
        amount,
        interestARS: convertAmount(interest, instrument.currency, "ARS", mep),
        amortizationARS: convertAmount(amortization, instrument.currency, "ARS", mep),
        amountARS: convertAmount(amount, instrument.currency, "ARS", mep),
      });
    }
  }

  for (const deposit of fixedTerms) {
    if (deposit.status !== "activo") continue;
    if (daysUntil(deposit.maturityDate.slice(0, 10), asOf) < 0) continue;
    const termDays = Math.max(
      0,
      (new Date(deposit.maturityDate).getTime() - new Date(deposit.startDate).getTime()) / 86_400_000
    );
    const finalValue = deposit.principal * (1 + (deposit.tna / 100) * (termDays / 365));
    const interest = finalValue - deposit.principal;
    const date = deposit.maturityDate.slice(0, 10);
    payments.push({
      date,
      time: Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000),
      days: daysUntil(date, asOf),
      source: deposit.bankName,
      assetType: "plazo-fijo",
      kind: "plazo-fijo",
      currency: deposit.currency,
      interest,
      amortization: deposit.principal,
      amount: finalValue,
      interestARS: convertAmount(interest, deposit.currency, "ARS", mep),
      amortizationARS: convertAmount(deposit.principal, deposit.currency, "ARS", mep),
      amountARS: convertAmount(finalValue, deposit.currency, "ARS", mep),
    });
  }

  return payments.sort((a, b) => a.time - b.time);
}

export type MonthlyIncome = {
  month: string; // YYYY-MM
  time: number;
  interestARS: number;
  amortizationARS: number;
  fixedTermARS: number;
  totalARS: number;
};

// Agrega los cobros futuros por mes calendario para los próximos `months`.
export function projectMonthlyIncome(
  payments: UpcomingPayment[],
  months = 12,
  asOf = new Date()
): MonthlyIncome[] {
  const buckets: MonthlyIncome[] = [];
  const byMonth = new Map<string, MonthlyIncome>();
  for (let i = 0; i < months; i++) {
    const date = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + i, 1));
    const month = date.toISOString().slice(0, 7);
    const bucket: MonthlyIncome = {
      month,
      time: Math.floor(date.getTime() / 1000),
      interestARS: 0,
      amortizationARS: 0,
      fixedTermARS: 0,
      totalARS: 0,
    };
    buckets.push(bucket);
    byMonth.set(month, bucket);
  }

  for (const payment of payments) {
    const bucket = byMonth.get(payment.date.slice(0, 7));
    if (!bucket || payment.amountARS == null) continue;
    if (payment.kind === "plazo-fijo") {
      bucket.fixedTermARS += payment.amountARS;
    } else {
      bucket.interestARS += payment.interestARS ?? 0;
      bucket.amortizationARS += payment.amortizationARS ?? 0;
    }
    bucket.totalARS += payment.amountARS;
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Métricas agregadas de renta fija
// ---------------------------------------------------------------------------

// Moneda en la que está expresado holding.currentPrice: se infiere comparando
// la valuación cruda con valueARS/valueUSD (los bonos cotizan en ARS aunque el
// instrumento pague en USD).
export function quotePriceCurrency(holding: Holding): Currency | null {
  if (holding.currentPrice == null) return null;
  const raw = positionValue(holding.assetType, holding.quantity, holding.currentPrice);
  const tolerance = Math.max(1, raw * 0.005);
  if (holding.valueARS != null && Math.abs(raw - holding.valueARS) <= tolerance) return "ARS";
  if (holding.valueUSD != null && Math.abs(raw - holding.valueUSD) <= tolerance) return "USD";
  return holding.assetType === "cripto" ? "USD" : "ARS";
}

export type FixedIncomeSummary = {
  valueARS: number;
  count: number;
  weightedYtm: number | null;
  weightedDuration: number | null;
  // Renta (cupones) proyectada de los próximos 12 meses + interés de plazos
  // fijos activos, en ARS al MEP actual. No incluye amortizaciones ni el
  // descuento de las letras.
  annualInterestARS: number;
};

export function summarizeFixedIncome({
  holdings,
  fixedTerms,
  mep,
  asOf = new Date(),
}: {
  holdings: Holding[];
  fixedTerms: ClientFixedTerm[];
  mep: number | null;
  asOf?: Date;
}): FixedIncomeSummary {
  let valueARS = 0;
  let count = 0;
  let ytmWeight = 0;
  let ytmAcc = 0;
  let durationWeight = 0;
  let durationAcc = 0;
  let annualInterestARS = 0;
  const horizon = new Date(asOf.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);

  for (const holding of holdings) {
    const instrument = getFixedIncomeInstrument(holding.ticker, holding.assetType);
    if (!instrument) continue;
    count++;
    if (holding.valueARS != null) valueARS += holding.valueARS;

    const priceCurrency = quotePriceCurrency(holding);
    const cleanPrice =
      holding.currentPrice != null && priceCurrency != null
        ? convertAmount(holding.currentPrice, priceCurrency, instrument.currency, mep)
        : null;
    const metrics = cleanPrice != null ? fixedIncomeMetrics(instrument, cleanPrice, asOf) : null;
    const weight = holding.valueARS ?? 0;
    if (metrics?.ytm != null && weight > 0) {
      ytmWeight += weight;
      ytmAcc += metrics.ytm * weight;
    }
    if (metrics?.durationYears != null && weight > 0) {
      durationWeight += weight;
      durationAcc += metrics.durationYears * weight;
    }

    const factor = holding.quantity / 100;
    for (const flow of futureFlows(instrument, asOf)) {
      if (flow.date > horizon) break;
      const interestARS = convertAmount(flow.interest * factor, instrument.currency, "ARS", mep);
      if (interestARS != null) annualInterestARS += interestARS;
    }
  }

  for (const deposit of fixedTerms) {
    if (deposit.status !== "activo") continue;
    const termDays = Math.max(
      0,
      (new Date(deposit.maturityDate).getTime() - new Date(deposit.startDate).getTime()) / 86_400_000
    );
    const interest = deposit.principal * (deposit.tna / 100) * (termDays / 365);
    const interestARS = convertAmount(interest, deposit.currency, "ARS", mep);
    if (interestARS != null) annualInterestARS += interestARS;
  }

  return {
    valueARS,
    count,
    weightedYtm: ytmWeight > 0 ? ytmAcc / ytmWeight : null,
    weightedDuration: durationWeight > 0 ? durationAcc / durationWeight : null,
    annualInterestARS,
  };
}

// ---------------------------------------------------------------------------
// Calculadora comparadora de tasas
// ---------------------------------------------------------------------------

// Plazo fijo tradicional: interés simple a TNA por la cantidad de días.
export function fixedTermSimpleFinal(amount: number, tna: number, days: number): number {
  return amount * (1 + (tna / 100) * (days / 365));
}

// Capitaliza una TEA durante `days` días.
export function compoundFinal(amount: number, tea: number, days: number): number {
  return amount * (1 + tea) ** (days / 365);
}

// TEA implícita de una inversión que convierte `amount` en `finalValue` en `days` días.
export function impliedTea(amount: number, finalValue: number, days: number): number | null {
  if (amount <= 0 || finalValue <= 0 || days <= 0) return null;
  return (finalValue / amount) ** (365 / days) - 1;
}

// MEP al que tendría que llegar el dólar para que dolarizarse hoy empate una
// alternativa en pesos que termina en `finalARS`.
export function breakevenMep(amountARS: number, finalARS: number, mepNow: number): number | null {
  if (amountARS <= 0 || mepNow <= 0) return null;
  return mepNow * (finalARS / amountARS);
}

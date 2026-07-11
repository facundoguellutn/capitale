import { canonicalTicker, type AssetType, type Currency } from "@/lib/constants";

export type FixedIncomeKind = "fixed" | "zero-coupon" | "cer" | "dollar-linked" | "variable";

export type FixedIncomeCashFlow = {
  date: string;
  interest: number;
  amortization: number;
  residualAfter: number;
};

export type FixedIncomeInstrument = {
  ticker: string;
  name: string;
  currency: Currency;
  kind: FixedIncomeKind;
  maturityDate: string;
  dayCount: "30/360" | "actual/365";
  flows: FixedIncomeCashFlow[];
  source: string;
};

const MONTH_CODES: Record<string, number> = {
  E: 1, F: 2, M: 3, A: 4, Y: 5, J: 6,
  L: 7, G: 8, S: 9, O: 10, N: 11, D: 12,
};

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Letras recientes: el ticker suele terminar en día + código de mes + último
// dígito del año (p.ej. S31L6 -> 31/07/2026). Se valida la fecha para evitar
// presentar vencimientos inventados ante símbolos que no siguen la convención.
export function inferArgentineNote(ticker: string): FixedIncomeInstrument | null {
  const upper = ticker.toUpperCase().replace(/[DC]$/, "");
  const match = upper.match(/(\d{1,2})([EFMAYLJGSOND])(\d)$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTH_CODES[match[2]];
  const currentYear = new Date().getUTCFullYear();
  let year = Math.floor(currentYear / 10) * 10 + Number(match[3]);
  if (year < currentYear - 2) year += 10;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  const maturityDate = iso(year, month, day);
  return {
    ticker: upper,
    name: `Letra del Tesoro con vencimiento ${maturityDate}`,
    currency: "ARS",
    kind: upper.startsWith("X") ? "cer" : "zero-coupon",
    maturityDate,
    dayCount: "actual/365",
    flows: [{ date: maturityDate, interest: 0, amortization: 100, residualAfter: 0 }],
    source: "Vencimiento inferido de la nomenclatura BYMA",
  };
}

function stepUp2030(ticker: "AL30" | "GD30"): FixedIncomeInstrument {
  const flows: FixedIncomeCashFlow[] = [];
  let residual = 100;
  for (let year = 2021; year <= 2030; year++) {
    for (const month of [1, 7]) {
      const date = iso(year, month, 9);
      const amortization =
        year === 2024 && month === 7 ? 4 :
        (year > 2024 || (year === 2024 && month > 7)) ? 8 : 0;
      const coupon = year <= 2021 ? 0.125 : year <= 2023 ? 0.5 : year <= 2027 ? 0.75 : 1.75;
      const interest = residual * coupon / 100;
      residual = Math.max(0, residual - amortization);
      flows.push({ date, interest, amortization, residualAfter: residual });
    }
  }
  return {
    ticker,
    name: `${ticker} soberano step-up 2030`,
    currency: "USD",
    kind: "fixed",
    maturityDate: "2030-07-09",
    dayCount: "30/360",
    flows,
    source: "Condiciones de emisión y flujo educativo BYMA",
  };
}

const CATALOG: Record<string, FixedIncomeInstrument> = {
  AL30: stepUp2030("AL30"),
  GD30: stepUp2030("GD30"),
};

export function getFixedIncomeInstrument(
  ticker: string,
  assetType: AssetType
): FixedIncomeInstrument | null {
  const canonical = canonicalTicker(ticker, assetType);
  return CATALOG[canonical] ?? (assetType === "letra" ? inferArgentineNote(canonical) : null);
}

export function futureFlows(instrument: FixedIncomeInstrument, asOf = new Date()) {
  const day = asOf.toISOString().slice(0, 10);
  return instrument.flows.filter((flow) => flow.date >= day);
}

// Días de calendario hasta una fecha ISO, comparando en UTC para evitar
// corrimientos por zona horaria.
export function daysUntil(isoDate: string, asOf = new Date()): number {
  const to = new Date(`${isoDate}T00:00:00Z`).getTime();
  const from = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.round((to - from) / 86_400_000);
}

// Rendimiento implícito de una letra (bono cero cupón) comprada a `price` por
// cada 100 nominales: el interés es el descuento entre el precio y el valor
// nominal que se cobra al vencimiento.
export function zeroCouponYield(price: number, days: number) {
  if (price <= 0 || days <= 0) return null;
  const totalReturn = 100 / price - 1; // ganancia total sobre lo invertido
  const tna = totalReturn * (365 / days); // nominal anual (simple)
  const tea = (100 / price) ** (365 / days) - 1; // efectiva anual (compuesta)
  return { totalReturn, tna, tea };
}

export function xirr(
  flows: { date: string | Date; amount: number }[],
  guess = 0.1
): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const first = new Date(flows[0].date).getTime();
  const years = flows.map((f) => (new Date(f.date).getTime() - first) / 31_557_600_000);
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    let value = 0;
    let derivative = 0;
    for (let j = 0; j < flows.length; j++) {
      const base = 1 + rate;
      if (base <= 0) return null;
      value += flows[j].amount / base ** years[j];
      derivative -= years[j] * flows[j].amount / base ** (years[j] + 1);
    }
    if (Math.abs(value) < 1e-8) return rate;
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) return null;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.9999 || next > 100) return null;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }
  return null;
}

export type FixedIncomeMetrics = {
  residual: number;
  technicalValue: number;
  parity: number;
  ytm: number | null;
  durationYears: number | null;
};

export function fixedIncomeMetrics(
  instrument: FixedIncomeInstrument,
  cleanPrice: number,
  settlement = new Date()
): FixedIncomeMetrics | null {
  const remaining = futureFlows(instrument, settlement);
  if (cleanPrice <= 0 || remaining.length === 0) return null;
  const residual = remaining[0].residualAfter + remaining[0].amortization;
  const previous = [...instrument.flows].reverse().find((f) => f.date < settlement.toISOString().slice(0, 10));
  const next = remaining[0];
  const periodStart = previous ? new Date(previous.date).getTime() : settlement.getTime();
  const periodEnd = new Date(next.date).getTime();
  const elapsed = Math.max(0, settlement.getTime() - periodStart);
  const period = Math.max(1, periodEnd - periodStart);
  const accruedInterest = next.interest * Math.min(1, elapsed / period);
  const technicalValue = residual + accruedInterest;
  const parity = cleanPrice / technicalValue;
  const settlementDate = settlement.toISOString().slice(0, 10);
  const ytm = xirr([
    { date: settlementDate, amount: -cleanPrice },
    ...remaining.map((f) => ({ date: f.date, amount: f.interest + f.amortization })),
  ]);
  let durationYears: number | null = null;
  if (ytm != null) {
    const t0 = settlement.getTime();
    let pv = 0;
    let weighted = 0;
    for (const flow of remaining) {
      const years = (new Date(flow.date).getTime() - t0) / 31_557_600_000;
      const discounted = (flow.interest + flow.amortization) / (1 + ytm) ** years;
      pv += discounted;
      weighted += years * discounted;
    }
    durationYears = pv > 0 ? weighted / pv : null;
  }
  return { residual, technicalValue, parity, ytm, durationYears };
}

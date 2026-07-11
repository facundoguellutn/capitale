import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { ASSET_TYPE_LABELS, type AssetType, type Currency } from "@/lib/constants";
import { lastMonths, monthRange } from "@/lib/month";
import {
  computeHoldings,
  fixedTermAccruedValue,
  valueHoldings,
  type PortfolioTransaction,
} from "@/lib/portfolio";
import {
  getDolarRates,
  getMepRate,
  getQuotes,
  type QuoteRequest,
} from "@/lib/quotes";
import type { DashboardData } from "@/lib/types";
import Account from "@/models/Account";
import Expense from "@/models/Expense";
import FixedTermDeposit from "@/models/FixedTermDeposit";
import Income from "@/models/Income";
import InvestmentTransaction from "@/models/InvestmentTransaction";
import NetWorthSnapshot from "@/models/NetWorthSnapshot";

function toARS(amount: number, currency: Currency, mep: number | null) {
  return currency === "ARS" ? amount : mep != null ? amount * mep : 0;
}

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();

  const [accounts, txDocs, fixedTerms] = await Promise.all([
    Account.find().lean(),
    InvestmentTransaction.find().lean(),
    FixedTermDeposit.find({ status: "activo" }).lean(),
  ]);
  const activeAccounts = accounts.filter((a) => !a.archived);

  let mep: number | null = null;
  try {
    mep = getMepRate(await getDolarRates());
  } catch (err) {
    console.error("Error obteniendo dólares:", err);
  }

  const toPortfolioTx = (d: (typeof txDocs)[number]): PortfolioTransaction => ({
    assetType: d.assetType,
    ticker: d.ticker,
    coingeckoId: d.coingeckoId,
    side: d.side,
    quantity: d.quantity,
    price: d.price,
    currency: d.currency,
    date: d.date,
    fee: d.fee,
  });

  // Posiciones globales
  const bare = computeHoldings(txDocs.map(toPortfolioTx));

  // Posiciones por cuenta (para la distribución por cuenta con inversiones)
  const txByAccount = new Map<string, PortfolioTransaction[]>();
  for (const d of txDocs) {
    const accId = String(d.accountId);
    const list = txByAccount.get(accId) ?? [];
    list.push(toPortfolioTx(d));
    txByAccount.set(accId, list);
  }
  const holdingsByAccount = new Map<string, ReturnType<typeof computeHoldings>>();
  for (const [accId, txs] of txByAccount) {
    holdingsByAccount.set(accId, computeHoldings(txs));
  }

  // Cotizaciones para la unión de tickers (globales + por cuenta): un ticker
  // puede quedar en 0 global pero positivo en una cuenta puntual
  const quoteReqs = new Map<string, QuoteRequest>();
  for (const h of [bare, ...holdingsByAccount.values()].flat()) {
    quoteReqs.set(h.ticker, {
      ticker: h.ticker,
      assetType: h.assetType,
      coingeckoId: h.coingeckoId,
    });
  }
  const quotes = await getQuotes([...quoteReqs.values()]);
  const holdings = valueHoldings(bare, quotes, mep);

  // --- Totales ---
  const cashARS = activeAccounts.reduce(
    (sum, a) => sum + toARS(a.balance, a.currency, mep),
    0
  );
  const investmentsARS = holdings.reduce((sum, h) => sum + (h.valueARS ?? 0), 0);
  const fixedTermsARS = fixedTerms.reduce(
    (sum, ft) =>
      sum +
      toARS(
        fixedTermAccruedValue(ft.principal, ft.tna, ft.startDate, ft.maturityDate),
        ft.currency,
        mep
      ),
    0
  );
  const totalARS = cashARS + investmentsARS + fixedTermsARS;
  const totalUSD = mep != null && mep > 0 ? totalARS / mep : 0;

  // --- KPIs de cartera (desde los holdings ya valuados) ---
  const investedARS = holdings.reduce(
    (sum, h) => sum + toARS(h.costBasis, h.currency, mep),
    0
  );
  const pnlARS = holdings.reduce((sum, h) => sum + (h.pnl ?? 0), 0);
  // Valor de la cartera ayer, para la variación de hoy en $
  const prevValueARS = holdings.reduce((sum, h) => {
    if (h.valueARS == null || h.pctChange == null) return sum;
    return sum + h.valueARS / (1 + h.pctChange / 100);
  }, 0);
  const dayChangeARS = holdings.reduce((sum, h) => {
    if (h.valueARS == null || h.pctChange == null) return sum;
    return sum + (h.valueARS - h.valueARS / (1 + h.pctChange / 100));
  }, 0);

  const portfolioKpis: DashboardData["portfolioKpis"] = {
    investedARS,
    valueARS: investmentsARS,
    pnlARS,
    pnlPct: investedARS > 0 ? pnlARS / investedARS : null,
    dayChangeARS,
    dayChangePct: prevValueARS > 0 ? dayChangeARS / prevValueARS : null,
  };

  // --- Distribución por tipo de activo ---
  const byType = new Map<string, number>();
  if (cashARS > 0) byType.set("Efectivo y cuentas", cashARS);
  for (const holding of holdings) {
    if (holding.valueARS == null) continue;
    const label = ASSET_TYPE_LABELS[holding.assetType as AssetType];
    byType.set(label, (byType.get(label) ?? 0) + holding.valueARS);
  }
  if (fixedTermsARS > 0) byType.set("Plazos fijos", fixedTermsARS);

  // --- Distribución por cuenta (efectivo + inversiones operadas desde ella) ---
  const byAccount = accounts.map((a) => {
    const cash = a.archived ? 0 : toARS(a.balance, a.currency, mep);
    const accHoldings = holdingsByAccount.get(String(a._id));
    const investments = accHoldings
      ? valueHoldings(accHoldings, quotes, mep).reduce(
          (sum, h) => sum + (h.valueARS ?? 0),
          0
        )
      : 0;
    return {
      name: a.name,
      cashARS: cash,
      investmentsARS: investments,
      valueARS: cash + investments,
    };
  });
  // Los plazos fijos no tienen cuenta asociada: fila propia
  if (fixedTermsARS > 0) {
    byAccount.push({
      name: "Plazos fijos",
      cashARS: 0,
      investmentsARS: fixedTermsARS,
      valueARS: fixedTermsARS,
    });
  }
  const byAccountSorted = byAccount
    .filter((a) => a.valueARS > 0)
    .sort((a, b) => b.valueARS - a.valueARS);

  // --- Flujo mensual: ingresos vs gastos últimos 12 meses ---
  const months = lastMonths(12).reverse();
  const rangeStart = monthRange(months[0]).start;
  const [incomeRows, expenseRows] = await Promise.all([
    Income.aggregate<{ _id: { month: string; currency: Currency }; total: number }>([
      { $match: { date: { $gte: rangeStart } } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            currency: "$currency",
          },
          total: { $sum: "$amount" },
        },
      },
    ]),
    Expense.aggregate<{ _id: { month: string; currency: Currency }; total: number }>([
      { $match: { date: { $gte: rangeStart } } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            currency: "$currency",
          },
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const monthlyFlow = months.map((m) => {
    const incomeARS = incomeRows
      .filter((r) => r._id.month === m)
      .reduce((sum, r) => sum + toARS(r.total, r._id.currency, mep), 0);
    const expenseARS = expenseRows
      .filter((r) => r._id.month === m)
      .reduce((sum, r) => sum + toARS(r.total, r._id.currency, mep), 0);
    return { month: m, incomeARS, expenseARS };
  });

  // --- Snapshot diario del patrimonio ---
  const today = new Date();
  const dayKey = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  if (totalARS > 0) {
    await NetWorthSnapshot.updateOne(
      { date: dayKey },
      { $set: { totalARS, totalUSD } },
      { upsert: true }
    );
  }
  // Los 365 más recientes, en orden ascendente para graficar
  const snapshotDocs = await NetWorthSnapshot.find()
    .sort({ date: -1 })
    .limit(365)
    .lean();
  snapshotDocs.reverse();

  const body: DashboardData = {
    totalARS,
    totalUSD,
    mep,
    byAssetType: [...byType.entries()]
      .map(([name, valueARS]) => ({ name, valueARS }))
      .sort((a, b) => b.valueARS - a.valueARS),
    byAccount: byAccountSorted,
    holdings,
    portfolioKpis,
    monthlyFlow,
    snapshots: snapshotDocs.map((s) => ({
      date: new Date(s.date).toISOString().slice(0, 10),
      totalARS: s.totalARS,
      totalUSD: s.totalUSD,
    })),
  };
  return NextResponse.json(body);
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import {
  ASSET_TYPE_LABELS,
  type AssetType,
  type Currency,
  type ExpenseCategory,
} from "@/lib/constants";
import { currentMonth, lastMonths, monthRange } from "@/lib/month";
import {
  computeHoldings,
  fixedTermAccruedValue,
  valueHoldings,
} from "@/lib/portfolio";
import { getDolarRates, getMepRate, getQuotes } from "@/lib/quotes";
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

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();
  const month = request.nextUrl.searchParams.get("month") ?? currentMonth();

  const [accounts, txDocs, fixedTerms] = await Promise.all([
    Account.find({ archived: false }).lean(),
    InvestmentTransaction.find().lean(),
    FixedTermDeposit.find({ status: "activo" }).lean(),
  ]);

  let mep: number | null = null;
  try {
    mep = getMepRate(await getDolarRates());
  } catch (err) {
    console.error("Error obteniendo dólares:", err);
  }

  const bare = computeHoldings(
    txDocs.map((d) => ({
      assetType: d.assetType,
      ticker: d.ticker,
      coingeckoId: d.coingeckoId,
      side: d.side,
      quantity: d.quantity,
      price: d.price,
      currency: d.currency,
      date: d.date,
      fee: d.fee,
    }))
  );
  const quotes = await getQuotes(
    bare.map((h) => ({
      ticker: h.ticker,
      assetType: h.assetType,
      coingeckoId: h.coingeckoId,
    }))
  );
  const holdings = valueHoldings(bare, quotes, mep);

  // --- Totales ---
  const cashARS = accounts.reduce(
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

  // --- Distribución por tipo de activo ---
  const byType = new Map<string, number>();
  if (cashARS > 0) byType.set("Efectivo y cuentas", cashARS);
  for (const holding of holdings) {
    if (holding.valueARS == null) continue;
    const label = ASSET_TYPE_LABELS[holding.assetType as AssetType];
    byType.set(label, (byType.get(label) ?? 0) + holding.valueARS);
  }
  if (fixedTermsARS > 0) byType.set("Plazos fijos", fixedTermsARS);

  // --- Distribución por cuenta ---
  const byAccount = accounts
    .map((a) => ({ name: a.name, valueARS: toARS(a.balance, a.currency, mep) }))
    .filter((a) => a.valueARS > 0)
    .sort((a, b) => b.valueARS - a.valueARS);

  // --- Gastos por categoría (mes elegido) ---
  const { start, end } = monthRange(month);
  const expensesByCategoryRaw = await Expense.aggregate<{
    _id: { category: string; currency: Currency };
    total: number;
  }>([
    { $match: { date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { category: "$category", currency: "$currency" },
        total: { $sum: "$amount" },
      },
    },
  ]);
  const byCategory = new Map<string, number>();
  for (const row of expensesByCategoryRaw) {
    const ars = toARS(row.total, row._id.currency, mep);
    byCategory.set(row._id.category, (byCategory.get(row._id.category) ?? 0) + ars);
  }

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
  const snapshotDocs = await NetWorthSnapshot.find()
    .sort({ date: 1 })
    .limit(365)
    .lean();

  const body: DashboardData = {
    totalARS,
    totalUSD,
    mep,
    byAssetType: [...byType.entries()]
      .map(([name, valueARS]) => ({ name, valueARS }))
      .sort((a, b) => b.valueARS - a.valueARS),
    byAccount,
    holdings,
    expensesByCategory: [...byCategory.entries()]
      .map(([category, totalARS]) => ({
        category: category as ExpenseCategory,
        totalARS,
      }))
      .sort((a, b) => b.totalARS - a.totalARS),
    monthlyFlow,
    snapshots: snapshotDocs.map((s) => ({
      date: new Date(s.date).toISOString().slice(0, 10),
      totalARS: s.totalARS,
      totalUSD: s.totalUSD,
    })),
  };
  return NextResponse.json(body);
}

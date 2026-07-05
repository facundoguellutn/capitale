import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { monthRange } from "@/lib/month";
import { serialize } from "@/lib/utils";
import type { ClientExpense } from "@/lib/types";
import Expense from "@/models/Expense";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();
  const month = request.nextUrl.searchParams.get("month");
  const filter = month
    ? (() => {
        const { start, end } = monthRange(month);
        return { date: { $gte: start, $lt: end } };
      })()
    : {};

  const expenses = await Expense.find(filter).sort({ date: -1 }).lean();
  return NextResponse.json(serialize<ClientExpense[]>(expenses));
}

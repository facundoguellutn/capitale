import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { fixedTermAccruedValue } from "@/lib/portfolio";
import { serialize } from "@/lib/utils";
import type { ClientFixedTerm } from "@/lib/types";
import FixedTermDeposit from "@/models/FixedTermDeposit";

const DAY_MS = 1000 * 60 * 60 * 24;

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();
  const docs = await FixedTermDeposit.find().sort({ status: 1, maturityDate: 1 }).lean();

  const now = Date.now();
  const deposits = serialize<Omit<ClientFixedTerm, "accruedValue" | "daysToMaturity">[]>(
    docs
  ).map((deposit) => ({
    ...deposit,
    accruedValue: fixedTermAccruedValue(
      deposit.principal,
      deposit.tna,
      deposit.startDate,
      deposit.maturityDate
    ),
    daysToMaturity: Math.max(
      0,
      Math.ceil((new Date(deposit.maturityDate).getTime() - now) / DAY_MS)
    ),
  }));

  return NextResponse.json(deposits satisfies ClientFixedTerm[]);
}

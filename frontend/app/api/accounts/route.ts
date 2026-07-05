import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { serialize } from "@/lib/utils";
import type { ClientAccount } from "@/lib/types";
import Account from "@/models/Account";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await dbConnect();
  const accounts = await Account.find().sort({ archived: 1, name: 1 }).lean();
  return NextResponse.json(serialize<ClientAccount[]>(accounts));
}

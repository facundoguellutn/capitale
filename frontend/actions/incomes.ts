"use server";

import { requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { incomeSchema, type IncomeInput } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";
import Account from "@/models/Account";
import Income from "@/models/Income";

export async function createIncome(input: IncomeInput): Promise<ActionResult> {
  await requireUser();
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const income = await Income.create(parsed.data);
  await Account.updateOne(
    { _id: income.accountId },
    { $inc: { balance: income.amount } }
  );
  return { ok: true };
}

export async function updateIncome(
  id: string,
  input: IncomeInput
): Promise<ActionResult> {
  await requireUser();
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const previous = await Income.findByIdAndUpdate(id, parsed.data);
  if (!previous) return { ok: false, error: "Ingreso no encontrado" };

  // Revertir el efecto anterior y aplicar el nuevo (puede cambiar de cuenta)
  await Account.updateOne(
    { _id: previous.accountId },
    { $inc: { balance: -previous.amount } }
  );
  await Account.updateOne(
    { _id: parsed.data.accountId },
    { $inc: { balance: parsed.data.amount } }
  );
  return { ok: true };
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  await requireUser();
  await dbConnect();
  const income = await Income.findByIdAndDelete(id);
  if (!income) return { ok: false, error: "Ingreso no encontrado" };

  await Account.updateOne(
    { _id: income.accountId },
    { $inc: { balance: -income.amount } }
  );
  return { ok: true };
}

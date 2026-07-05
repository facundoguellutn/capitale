"use server";

import { requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { expenseSchema, type ExpenseInput } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";
import Account from "@/models/Account";
import Expense from "@/models/Expense";

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  await requireUser();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const expense = await Expense.create(parsed.data);
  await Account.updateOne(
    { _id: expense.accountId },
    { $inc: { balance: -expense.amount } }
  );
  return { ok: true };
}

export async function updateExpense(
  id: string,
  input: ExpenseInput
): Promise<ActionResult> {
  await requireUser();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const previous = await Expense.findByIdAndUpdate(id, parsed.data);
  if (!previous) return { ok: false, error: "Gasto no encontrado" };

  // Revertir el efecto anterior y aplicar el nuevo (puede cambiar de cuenta)
  await Account.updateOne(
    { _id: previous.accountId },
    { $inc: { balance: previous.amount } }
  );
  await Account.updateOne(
    { _id: parsed.data.accountId },
    { $inc: { balance: -parsed.data.amount } }
  );
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireUser();
  await dbConnect();
  const expense = await Expense.findByIdAndDelete(id);
  if (!expense) return { ok: false, error: "Gasto no encontrado" };

  await Account.updateOne(
    { _id: expense.accountId },
    { $inc: { balance: expense.amount } }
  );
  return { ok: true };
}

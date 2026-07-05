"use server";

import { requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import {
  investmentTransactionSchema,
  type InvestmentTransactionInput,
} from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";
import Account from "@/models/Account";
import InvestmentTransaction from "@/models/InvestmentTransaction";

type ParsedTransaction = ReturnType<
  typeof investmentTransactionSchema.parse
>;

// Efecto de la operación sobre el efectivo de la cuenta:
// compra resta (costo + comisión), venta suma (producido - comisión)
function cashEffect(tx: {
  assetType: ParsedTransaction["assetType"];
  side: ParsedTransaction["side"];
  quantity: number;
  price: number;
  fee?: number | null;
}) {
  const gross =
    tx.assetType === "bono"
      ? (tx.quantity * tx.price) / 100
      : tx.quantity * tx.price;
  const fee = tx.fee ?? 0;
  return tx.side === "compra" ? -(gross + fee) : gross - fee;
}

export async function createInvestmentTransaction(
  input: InvestmentTransactionInput
): Promise<ActionResult> {
  await requireUser();
  const parsed = investmentTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const tx = await InvestmentTransaction.create(parsed.data);
  await Account.updateOne(
    { _id: tx.accountId },
    { $inc: { balance: cashEffect(parsed.data) } }
  );
  return { ok: true };
}

export async function updateInvestmentTransaction(
  id: string,
  input: InvestmentTransactionInput
): Promise<ActionResult> {
  await requireUser();
  const parsed = investmentTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const previous = await InvestmentTransaction.findByIdAndUpdate(id, parsed.data);
  if (!previous) return { ok: false, error: "Operación no encontrada" };

  await Account.updateOne(
    { _id: previous.accountId },
    { $inc: { balance: -cashEffect(previous) } }
  );
  await Account.updateOne(
    { _id: parsed.data.accountId },
    { $inc: { balance: cashEffect(parsed.data) } }
  );
  return { ok: true };
}

export async function deleteInvestmentTransaction(
  id: string
): Promise<ActionResult> {
  await requireUser();
  await dbConnect();
  const tx = await InvestmentTransaction.findByIdAndDelete(id);
  if (!tx) return { ok: false, error: "Operación no encontrada" };

  await Account.updateOne(
    { _id: tx.accountId },
    { $inc: { balance: -cashEffect(tx) } }
  );
  return { ok: true };
}

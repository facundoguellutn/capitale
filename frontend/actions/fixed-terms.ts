"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { fixedTermFinalValue } from "@/lib/portfolio";
import { fixedTermSchema, type FixedTermInput } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";
import Account from "@/models/Account";
import FixedTermDeposit from "@/models/FixedTermDeposit";

export async function createFixedTerm(input: FixedTermInput): Promise<ActionResult> {
  await requireUser();
  const parsed = fixedTermSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  await FixedTermDeposit.create(parsed.data);
  return { ok: true };
}

export async function updateFixedTerm(
  id: string,
  input: FixedTermInput
): Promise<ActionResult> {
  await requireUser();
  const parsed = fixedTermSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const updated = await FixedTermDeposit.findOneAndUpdate(
    { _id: id, status: "activo" },
    parsed.data
  );
  if (!updated) return { ok: false, error: "Plazo fijo no encontrado o ya cobrado" };
  return { ok: true };
}

// Marca el plazo fijo como cobrado y acredita capital + interés en la cuenta elegida
export async function collectFixedTerm(
  id: string,
  accountId: string
): Promise<ActionResult> {
  await requireUser();
  if (!z.string().regex(/^[0-9a-f]{24}$/i).safeParse(accountId).success) {
    return { ok: false, error: "Cuenta inválida" };
  }

  await dbConnect();
  const deposit = await FixedTermDeposit.findOneAndUpdate(
    { _id: id, status: "activo" },
    { status: "cobrado" }
  );
  if (!deposit) return { ok: false, error: "Plazo fijo no encontrado o ya cobrado" };

  const finalValue = fixedTermFinalValue(
    deposit.principal,
    deposit.tna,
    deposit.startDate,
    deposit.maturityDate
  );
  const credited = await Account.updateOne(
    { _id: accountId },
    { $inc: { balance: finalValue } }
  );
  if (credited.matchedCount === 0) {
    // Revertir el estado si la cuenta no existe
    await FixedTermDeposit.updateOne({ _id: id }, { status: "activo" });
    return { ok: false, error: "Cuenta no encontrada" };
  }
  return { ok: true };
}

export async function deleteFixedTerm(id: string): Promise<ActionResult> {
  await requireUser();
  await dbConnect();
  const deleted = await FixedTermDeposit.findByIdAndDelete(id);
  if (!deleted) return { ok: false, error: "Plazo fijo no encontrado" };
  return { ok: true };
}

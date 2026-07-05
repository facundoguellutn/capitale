"use server";

import { requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { accountSchema, type AccountInput } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";
import Account from "@/models/Account";

export async function createAccount(input: AccountInput): Promise<ActionResult> {
  await requireUser();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  await Account.create(parsed.data);
  return { ok: true };
}

export async function updateAccount(
  id: string,
  input: AccountInput
): Promise<ActionResult> {
  await requireUser();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();
  const { provider, ...rest } = parsed.data;
  const update = provider
    ? { ...rest, provider }
    : { ...rest, $unset: { provider: 1 } };
  const updated = await Account.findByIdAndUpdate(id, update);
  if (!updated) return { ok: false, error: "Cuenta no encontrada" };
  return { ok: true };
}

export async function setAccountArchived(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await requireUser();
  await dbConnect();
  const updated = await Account.findByIdAndUpdate(id, { archived });
  if (!updated) return { ok: false, error: "Cuenta no encontrada" };
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  await requireUser();
  await dbConnect();
  const deleted = await Account.findByIdAndDelete(id);
  if (!deleted) return { ok: false, error: "Cuenta no encontrada" };
  return { ok: true };
}

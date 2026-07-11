"use server";

import { requireUser } from "@/lib/auth";
import { isPer100 } from "@/lib/constants";
import { dbConnect } from "@/lib/db";
import {
  investmentTransactionSchema,
  investmentTransactionsBulkSchema,
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
  // Renta fija (bonos, letras, ONs): precio por 100 nominales
  const gross = isPer100(tx.assetType)
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

export type BulkCreateResult =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string };

// Clave para detectar operaciones ya importadas (re-importar el mismo archivo)
function duplicateKey(tx: {
  ticker: string;
  date: Date;
  side: string;
  quantity: number;
  price: number;
  importSource?: string;
  externalId?: string;
}) {
  if (tx.importSource && tx.externalId) {
    return `${tx.importSource}|${tx.externalId}`;
  }
  return [tx.ticker, tx.date.toISOString(), tx.side, tx.quantity, tx.price].join("|");
}

export async function createInvestmentTransactionsBulk(
  inputs: InvestmentTransactionInput[]
): Promise<BulkCreateResult> {
  await requireUser();
  const parsed = investmentTransactionsBulkSchema.safeParse(inputs);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await dbConnect();

  // Saltea las operaciones que ya existen con misma clave
  const existing = await InvestmentTransaction.find({
    $or: parsed.data.map((tx) =>
      tx.importSource && tx.externalId
        ? { importSource: tx.importSource, externalId: tx.externalId }
        : {
            ticker: tx.ticker,
            date: tx.date,
            side: tx.side,
            quantity: tx.quantity,
            price: tx.price,
          }
    ),
  }).lean();
  const existingKeys = new Set(
    existing.map((tx) =>
      duplicateKey({ ...tx, date: new Date(tx.date as Date) })
    )
  );
  // También elimina repetidas dentro del mismo archivo antes de insertarlas.
  const batchKeys = new Set<string>();
  const toInsert = parsed.data.filter((tx) => {
    const key = duplicateKey(tx);
    if (existingKeys.has(key) || batchKeys.has(key)) return false;
    batchKeys.add(key);
    return true;
  });
  const skipped = parsed.data.length - toInsert.length;
  if (toInsert.length === 0) return { ok: true, inserted: 0, skipped };

  const docs = await InvestmentTransaction.insertMany(toInsert);

  // Un solo ajuste de balance por cuenta con el efecto neto del batch
  const effectByAccount = new Map<string, number>();
  for (const tx of toInsert) {
    effectByAccount.set(
      tx.accountId,
      (effectByAccount.get(tx.accountId) ?? 0) + cashEffect(tx)
    );
  }
  await Promise.all(
    [...effectByAccount.entries()].map(([accountId, effect]) =>
      Account.updateOne({ _id: accountId }, { $inc: { balance: effect } })
    )
  );

  return { ok: true, inserted: docs.length, skipped };
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

import { z } from "zod";
import {
  ACCOUNT_TYPES,
  ASSET_TYPES,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  FIXED_TERM_STATUSES,
  INCOME_KINDS,
  TRANSACTION_SIDES,
} from "@/lib/constants";

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Id inválido");
const money = z.coerce.number().positive("Debe ser mayor a 0");
const dateString = z.coerce.date();

export const accountSchema = z.object({
  name: z.string().min(1, "Ingresá un nombre"),
  provider: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.enum(CURRENCIES),
  balance: z.coerce.number(),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const incomeSchema = z.object({
  date: dateString,
  amount: money,
  currency: z.enum(CURRENCIES),
  kind: z.enum(INCOME_KINDS),
  source: z.string().min(1, "Ingresá la fuente"),
  accountId: objectId,
  note: z.string().optional(),
});
export type IncomeInput = z.infer<typeof incomeSchema>;

export const expenseSchema = z.object({
  date: dateString,
  amount: money,
  currency: z.enum(CURRENCIES),
  category: z.enum(EXPENSE_CATEGORIES),
  accountId: objectId,
  note: z.string().optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const investmentTransactionSchema = z
  .object({
    assetType: z.enum(ASSET_TYPES),
    ticker: z.string().min(1, "Ingresá el ticker").transform((v) => v.toUpperCase().trim()),
    coingeckoId: z
      .string()
      .optional()
      .transform((v) => v?.toLowerCase().trim() || undefined),
    side: z.enum(TRANSACTION_SIDES),
    quantity: money,
    // Permite 0 para dividendos en acciones / ajustes de ratio (suman
    // cantidad sin mover efectivo)
    price: z.coerce.number().min(0, "No puede ser negativo"),
    currency: z.enum(CURRENCIES),
    date: dateString,
    accountId: objectId,
    fee: z.coerce.number().min(0).optional(),
    note: z.string().optional(),
  })
  .refine((data) => data.assetType !== "cripto" || !!data.coingeckoId, {
    message: "Para cripto ingresá el id de CoinGecko (ej: bitcoin)",
    path: ["coingeckoId"],
  });
export type InvestmentTransactionInput = z.infer<
  typeof investmentTransactionSchema
>;

// Importación masiva de operaciones (desde archivos de brokers)
export const investmentTransactionsBulkSchema = z
  .array(investmentTransactionSchema)
  .min(1, "No hay operaciones para importar")
  .max(500, "Máximo 500 operaciones por importación");

export const fixedTermSchema = z
  .object({
    bankName: z.string().min(1, "Ingresá el banco"),
    principal: money,
    currency: z.enum(CURRENCIES),
    tna: z.coerce.number().positive("Ingresá la TNA"),
    startDate: dateString,
    maturityDate: dateString,
    note: z.string().optional(),
  })
  .refine((data) => data.maturityDate > data.startDate, {
    message: "El vencimiento debe ser posterior al inicio",
    path: ["maturityDate"],
  });
export type FixedTermInput = z.infer<typeof fixedTermSchema>;

export const fixedTermStatusSchema = z.enum(FIXED_TERM_STATUSES);

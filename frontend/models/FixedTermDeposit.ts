import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CURRENCIES, FIXED_TERM_STATUSES } from "@/lib/constants";

const fixedTermDepositSchema = new Schema(
  {
    bankName: { type: String, required: true, trim: true },
    principal: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    // Tasa nominal anual en % (ej: 39.5)
    tna: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    maturityDate: { type: Date, required: true },
    status: { type: String, enum: FIXED_TERM_STATUSES, default: "activo" },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

export type FixedTermDepositDoc = InferSchemaType<typeof fixedTermDepositSchema>;

export default models.FixedTermDeposit ??
  model("FixedTermDeposit", fixedTermDepositSchema);

import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CURRENCIES, INCOME_KINDS } from "@/lib/constants";

const incomeSchema = new Schema(
  {
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    kind: { type: String, enum: INCOME_KINDS, required: true },
    source: { type: String, required: true, trim: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

incomeSchema.index({ date: -1 });

export type IncomeDoc = InferSchemaType<typeof incomeSchema>;

export default models.Income ?? model("Income", incomeSchema);

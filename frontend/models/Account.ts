import { Schema, model, models, type InferSchemaType } from "mongoose";
import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/constants";

const accountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    currency: { type: String, enum: CURRENCIES, required: true },
    // Saldo autoritativo: las actions de ingresos/gastos/inversiones lo ajustan con $inc
    balance: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type AccountDoc = InferSchemaType<typeof accountSchema>;

export default models.Account ?? model("Account", accountSchema);

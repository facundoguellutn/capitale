import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CURRENCIES, EXPENSE_CATEGORIES } from "@/lib/constants";

const expenseSchema = new Schema(
  {
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema>;

export default models.Expense ?? model("Expense", expenseSchema);

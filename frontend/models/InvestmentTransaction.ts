import { Schema, model, models, type InferSchemaType } from "mongoose";
import { ASSET_TYPES, CURRENCIES, TRANSACTION_SIDES } from "@/lib/constants";

const investmentTransactionSchema = new Schema(
  {
    assetType: { type: String, enum: ASSET_TYPES, required: true },
    // Símbolo tal como cotiza en data912 (GGAL, AAPL, AL30) o símbolo cripto (BTC)
    ticker: { type: String, required: true, trim: true, uppercase: true },
    // Id de CoinGecko ("bitcoin", "ethereum"...), requerido para cripto
    coingeckoId: { type: String, trim: true, lowercase: true },
    side: { type: String, enum: TRANSACTION_SIDES, required: true },
    quantity: { type: Number, required: true, min: 0 },
    // Para bonos: precio por 100 nominales, como cotiza el mercado
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    fee: { type: Number, min: 0 },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

investmentTransactionSchema.index({ ticker: 1, date: 1 });

export type InvestmentTransactionDoc = InferSchemaType<
  typeof investmentTransactionSchema
>;

export default models.InvestmentTransaction ??
  model("InvestmentTransaction", investmentTransactionSchema);

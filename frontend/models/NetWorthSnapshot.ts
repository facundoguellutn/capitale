import { Schema, model, models, type InferSchemaType } from "mongoose";

const netWorthSnapshotSchema = new Schema(
  {
    // Fecha normalizada a las 00:00 UTC del día
    date: { type: Date, required: true, unique: true },
    totalARS: { type: Number, required: true },
    totalUSD: { type: Number, required: true },
  },
  { timestamps: true }
);

export type NetWorthSnapshotDoc = InferSchemaType<typeof netWorthSnapshotSchema>;

export default models.NetWorthSnapshot ??
  model("NetWorthSnapshot", netWorthSnapshotSchema);

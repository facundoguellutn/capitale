import mongoose from "mongoose";

declare global {
  var _mongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cached = (global._mongoose ??= { conn: null, promise: null });

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }
  cached.promise ??= mongoose.connect(process.env.MONGODB_URI);
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}

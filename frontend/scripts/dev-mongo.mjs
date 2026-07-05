// MongoDB en memoria para desarrollo/pruebas sin Atlas:
//   node scripts/dev-mongo.mjs
// y en otra terminal:
//   MONGODB_URI=mongodb:// npm run dev  (usar la URI que imprime este script)
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create({
  instance: { port: 37017, dbName: "capitale" },
});
console.log("MONGO_READY", mongod.getUri());

process.on("SIGINT", async () => {
  await mongod.stop();
  process.exit(0);
});
setInterval(() => {}, 60_000);

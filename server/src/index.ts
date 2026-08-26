import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { env } from "./env.js";
import { getDeck } from "./places/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../../web/dist");

const { app } = await buildApp({
  getDeck,
  staticRoot: webDist,
  logLevel: env.NODE_ENV === "production" ? "info" : "warn",
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`chews server on :${env.PORT} (${env.useMockPlaces ? "mock places" : "google places"})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

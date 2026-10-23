import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { closeDrizzle, initDrizzle } from "./db/drizzleClient";
import { scheduleIngestCatchUpOnBoot } from "./jobs/ingestCatchUpOnBoot";
import { registerNightlyIngestJob } from "./jobs/nightlyIngestJob";
import { authRoutes } from "./routes/auth";
import { facetsRoutes } from "./routes/facets";
import { nlRoutes } from "./routes/nl";
import { presetsRoutes } from "./routes/presets";
import { screenRoutes } from "./routes/screen";
import { screensRoutes } from "./routes/screens";
import { stocksRoutes } from "./routes/stocks";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRoutes);
app.use("/api/screen", screenRoutes);
app.use("/api/facets", facetsRoutes);
app.use("/api/presets", presetsRoutes);
app.use("/api/stocks", stocksRoutes);
app.use("/api/nl", nlRoutes);
app.use("/api/screens", screensRoutes);

async function start(): Promise<void> {
  await initDrizzle();

  registerNightlyIngestJob();
  // Non-blocking: heals missed nightly runs without delaying listen().
  scheduleIngestCatchUpOnBoot();

  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`SGX Screener API listening on port ${port}`));
}

function shutdown(): void {
  closeDrizzle()
    .then(() => process.exit(0))
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

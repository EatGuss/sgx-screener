import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in backend/.env");
}

export default defineConfig({
  schema: "./src/models/screener/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

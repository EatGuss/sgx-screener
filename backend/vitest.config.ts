import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/unit/**/*.test.ts"],
        },
      },
      {
        // Needs a migrated, seeded and ingested database (DATABASE_URL in .env).
        test: {
          name: "integration",
          environment: "node",
          include: ["test/integration/**/*.test.ts"],
          setupFiles: ["dotenv/config"],
        },
      },
    ],
  },
});

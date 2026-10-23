import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // jsdom for localStorage / URL APIs used by the settings and share-link codecs.
    environment: "jsdom",
    include: ["test/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
  },
});

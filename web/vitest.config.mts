import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "ui"),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});

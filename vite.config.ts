import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: { proxy: { "/api/ai": { target: "http://127.0.0.1:8787", changeOrigin: false } } },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "server/**/*.test.js",
      "scripts/**/*.test.js",
    ],
  },
});

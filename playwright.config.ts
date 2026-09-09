import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    serviceWorkers: "block",
  },
});

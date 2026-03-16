import "dotenv/config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120 * 1000,
  reporter: [
    ["html"],
    ["list"], // ← shows retry attempts inline in terminal
  ],
  projects: [
    {
      name: "api",
      testMatch: "**/api/**/*.spec.ts",
      use: {},
    },
    {
      name: "ui",
      testMatch: "**/ui/**/*.spec.ts",
      use: { browserName: "chromium" },
    },
  ],
});

process.env.TEST_ENV = process.env.TEST_ENV || "prod";

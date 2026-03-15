import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120 * 1000, // 1 minute per test
  reporter: [['html']],
  use: {
    // keep Playwright's own options here
  },
});

// ✅ Default environment set to "prod"
process.env.TEST_ENV = process.env.TEST_ENV || "prod";

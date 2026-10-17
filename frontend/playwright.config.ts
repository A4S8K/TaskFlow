import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const serverURL = new URL(baseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120000,
  expect: { timeout: 20000 },
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      process.env.PLAYWRIGHT_SERVER_COMMAND ||
      `npm run dev -- --host ${serverURL.hostname} --port ${serverURL.port || "5173"}`,
    url: baseURL,
    reuseExistingServer:
      !process.env.CI || process.env.PLAYWRIGHT_REUSE_SERVER === "1",
  },
});

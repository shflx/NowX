import { defineConfig, devices } from "@playwright/test";

/**
 * 端到端测试：依赖演示数据（pnpm db:demo），测试中新建的数据都带随机后缀，可重复运行。
 * 本地如未安装 Playwright 浏览器，可设置 PLAYWRIGHT_CHANNEL=chrome 使用系统 Chrome。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});

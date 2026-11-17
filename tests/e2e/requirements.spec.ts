import { expect, test } from "@playwright/test";

import { login, uniq } from "./helpers";

test("新建需求时识别飞书链接，并在详情页拆解任务", async ({ page }) => {
  const title = `E2E 需求 ${uniq()}`;
  await login(page, "linzhou");
  await page.goto("/projects/CRM/requirements");

  await page.getByRole("button", { name: "新建需求" }).click();
  await page.getByLabel("需求标题").fill(title);
  await page.getByLabel("文档链接").fill("https://example.feishu.cn/docx/e2e");
  await page.getByLabel("需求摘要").fill("端到端测试创建的需求");
  await page.getByRole("button", { name: "创建", exact: true }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  // 未填写名称的飞书链接使用默认名「飞书文档」
  await expect(page.getByRole("link", { name: /飞书文档/ })).toHaveAttribute("href", "https://example.feishu.cn/docx/e2e");

  await page.getByRole("button", { name: "拆解任务" }).click();
  await page.getByLabel("标题", { exact: true }).fill(`${title} - 子项`);
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByText(`${title} - 子项`)).toBeVisible();
});

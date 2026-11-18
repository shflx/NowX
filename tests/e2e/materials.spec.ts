import { expect, test } from "@playwright/test";

import { login, uniq } from "./helpers";

test("添加外部链接并新建标签，按标签筛选", async ({ page }) => {
  const name = `E2E 竞品对比 ${uniq()}`;
  const tag = `竞品${uniq()}`;
  await login(page, "linzhou");
  await page.goto("/projects/CRM/materials");

  await page.getByRole("button", { name: "添加链接" }).click();
  await page.getByLabel(/链接地址/).fill("https://docs.qq.com/doc/e2e");
  await page.getByLabel("名称", { exact: true }).fill(name);
  await page.getByLabel("新标签名称").fill(tag);
  await page.getByLabel("新标签名称").press("Enter");
  await expect(page.getByRole("button", { name: tag, pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "添加", exact: true }).click();

  await page.getByRole("link", { name: new RegExp(tag) }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
  await expect(page.getByText("腾讯文档 · 外部链接").first()).toBeVisible();
});

test("上传文件后可以下载", async ({ page }) => {
  const fileName = `e2e-${uniq()}.txt`;
  await login(page, "linzhou");
  await page.goto("/projects/CRM/materials");

  await page.getByRole("button", { name: "上传文件" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: "text/plain", buffer: Buffer.from("hello nowx") });
  await page.getByRole("button", { name: "添加", exact: true }).click();

  const link = page.getByRole("link", { name: fileName });
  await expect(link).toBeVisible();
  const response = await page.request.get((await link.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe("hello nowx");
});

test("重命名文件材料时自动保留扩展名", async ({ page }) => {
  const id = uniq();
  await login(page, "linzhou");
  await page.goto("/projects/CRM/materials");

  await page.getByRole("button", { name: "上传文件" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: `draft-${id}.txt`, mimeType: "text/plain", buffer: Buffer.from("v1") });
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.getByRole("link", { name: `draft-${id}.txt` })).toBeVisible();

  const card = page.locator("div.group").filter({ hasText: `draft-${id}.txt` });
  await card.getByRole("button", { name: "材料操作" }).click();
  await page.getByRole("menuitem", { name: "重命名" }).click();
  await page.getByLabel("名称", { exact: true }).fill(`需求评审记录 ${id}`);
  await page.getByRole("button", { name: "保存" }).click();

  // 未写扩展名，自动补上 .txt
  await expect(page.getByRole("link", { name: `需求评审记录 ${id}.txt` })).toBeVisible();
});

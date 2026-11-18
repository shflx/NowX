import { expect, test } from "@playwright/test";

import { login, uniq } from "./helpers";

test("发布、编辑并删除公告（删除需二次确认）", async ({ page }) => {
  const title = `E2E 公告 ${uniq()}`;
  await login(page, "linzhou");
  await page.goto("/projects/CRM/announcements");

  await page.getByRole("button", { name: "发布公告" }).click();
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("内容").fill("第一版内容");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  const card = page.getByRole("article").filter({ hasText: title });
  await expect(card).toBeVisible();

  // 编辑
  await card.getByRole("button", { name: "公告操作" }).click();
  await page.getByRole("menuitem", { name: "编辑" }).click();
  await page.getByLabel("内容").fill("修改后的内容");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(card.getByText("修改后的内容")).toBeVisible();
  await expect(card.getByText("已编辑")).toBeVisible();

  // 删除：取消时不删除，确认后才删除
  await card.getByRole("button", { name: "公告操作" }).click();
  await page.getByRole("menuitem", { name: "删除公告" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "取消" }).click();
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "公告操作" }).click();
  await page.getByRole("menuitem", { name: "删除公告" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "删除" }).click();
  await expect(page.getByRole("article").filter({ hasText: title })).toHaveCount(0);
});

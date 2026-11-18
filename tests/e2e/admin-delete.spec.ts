import { expect, test } from "@playwright/test";

import { login, uniq } from "./helpers";

test("在项目管理中新建并删除项目（需输入编号前缀确认）", async ({ page }) => {
  const id = uniq();
  const key = `D${id.replace(/\d/g, "").toUpperCase()}ZZ`.slice(0, 6);
  const name = `待删除项目 ${id}`;
  await login(page, "linzhou");

  await page.getByRole("link", { name: "项目管理" }).click();
  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByLabel("项目名称").fill(name);
  await page.getByLabel("编号前缀").fill(key);
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${key}/cycles`));

  await page.goto("/admin/projects");
  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "删除" }).click();

  const confirm = page.getByRole("button", { name: "永久删除" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/请输入编号前缀/).fill(key);
  await confirm.click();

  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  await page.goto(`/projects/${key}/tasks`);
  await expect(page.getByText("页面不存在或无权访问")).toBeVisible();
});

test("可以删除没有协作记录的账号，有记录的账号只能停用", async ({ page }) => {
  const id = uniq();
  await login(page, "linzhou");
  await page.goto("/admin/accounts");

  // 演示账号陈晓有任务和帖子，删除按钮不可用
  await expect(page.getByRole("row").filter({ hasText: "chenxiao" }).getByRole("button", { name: "删除" })).toBeDisabled();

  await page.getByRole("button", { name: "创建账号" }).click();
  await page.getByLabel("姓名").fill(`临时${id}`);
  await page.getByLabel("登录名").fill(`tmp_${id}`);
  await page.getByRole("button", { name: "创建账号" }).last().click();
  await page.getByRole("button", { name: "完成" }).click();

  const row = page.getByRole("row").filter({ hasText: `tmp_${id}` });
  await row.getByRole("button", { name: "删除" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "删除" }).click();
  await expect(page.getByRole("row").filter({ hasText: `tmp_${id}` })).toHaveCount(0);
});

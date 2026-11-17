import { expect, test } from "@playwright/test";

import { fillLogin, login } from "./helpers";

test("密码错误时提示，且保留已输入的账号", async ({ page }) => {
  await fillLogin(page, "linzhou", "wrong-password");
  await expect(page.getByText("账号或密码错误")).toBeVisible();
  await expect(page.getByLabel("账号")).toHaveValue("linzhou");
});

test("未登录访问会跳转到登录页", async ({ page }) => {
  await page.goto("/projects/CRM/tasks");
  await expect(page).toHaveURL(/\/login$/);
});

test("普通成员看不到管理入口，也不能直接访问管理页面", async ({ page }) => {
  await login(page, "chenxiao");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "账号管理" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "项目设置" })).toHaveCount(0);

  await page.goto("/admin/accounts");
  await expect(page.getByText("只有管理员可以访问「账号管理」")).toBeVisible();
});

test("成员不能访问未加入的项目", async ({ page }) => {
  await login(page, "chenxiao");
  await page.goto("/projects/OPS/tasks");
  await expect(page.getByText("页面不存在或无权访问")).toBeVisible();
});

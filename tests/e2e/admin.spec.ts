import { expect, test } from "@playwright/test";

import { login, uniq } from "./helpers";

test("管理员新建项目、创建账号，新成员首次登录需改密", async ({ page, browser }) => {
  const id = uniq();
  const key = `E${id.replace(/\d/g, "").toUpperCase().slice(0, 4)}X`.slice(0, 6);
  await login(page, "linzhou");

  // 新建项目
  await page.getByRole("button", { name: /CRM 客户管理 v2/ }).click();
  await page.getByRole("menuitem", { name: "新建项目" }).click();
  await page.getByLabel("项目名称").fill(`E2E 项目 ${id}`);
  await page.getByLabel("编号前缀").fill(key);
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${key}/cycles`));

  // 新建周期并开始、结束
  await page.getByRole("button", { name: "新建周期" }).click();
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await page.getByRole("button", { name: "开始周期" }).click();
  await expect(page.getByText("进行中").first()).toBeVisible();
  await page.getByRole("button", { name: "结束周期" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "结束周期" }).click();
  await expect(page.getByText("已结束").first()).toBeVisible();

  // 在账号管理中创建账号
  const loginName = `e2e_${id}`;
  await page.goto("/admin/accounts");
  await page.getByRole("button", { name: "创建账号" }).click();
  await page.getByLabel("姓名").fill(`测试${id}`);
  await page.getByLabel("登录名").fill(loginName);
  const password = await page.getByRole("dialog").locator("input.font-mono").inputValue();
  await page.getByRole("button", { name: "创建账号" }).last().click();
  await expect(page.getByText("账号已创建")).toBeVisible();

  // 新账号首次登录被要求修改密码
  const context = await browser.newContext();
  const newbie = await context.newPage();
  await login(newbie, loginName, password);
  await expect(newbie).toHaveURL(/\/change-password$/);
  await newbie.getByLabel("当前密码").fill(password);
  await newbie.getByLabel("新密码", { exact: true }).fill("Newpass123");
  await newbie.getByLabel("确认新密码").fill("Newpass123");
  await newbie.getByRole("button", { name: "保存新密码" }).click();
  await expect(newbie).toHaveURL("/");
  await context.close();
});

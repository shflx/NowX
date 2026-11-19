import { expect, test } from "@playwright/test";

import { login, sessionAs, uniq } from "./helpers";

test("个人令牌只在创建时显示明文，且只有本人能管理", async ({ browser, page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/account/access-tokens");
  await expect(page).toHaveURL("/login");
  await login(page, "chenxiao");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByRole("menuitem", { name: "个人访问令牌" }).click();
  await expect(page.getByText("Authorization: Bearer <token>")).toBeVisible();

  const name = `外部 Agent ${uniq()}`.padEnd(80, "A");
  await page.getByLabel("令牌名称").fill(name);
  await page.getByRole("button", { name: "创建令牌" }).click();
  const dialog = page.getByRole("dialog", { name: "令牌已创建" });
  const code = dialog.locator("code");
  await expect(code).toHaveText(/^nowx_pat_[\w-]{43}$/);
  const secret = await code.innerText();
  await expect(dialog.getByRole("button", { name: "复制令牌" })).toBeVisible();
  await page.reload();
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("有效");
  expect((await page.content()).includes(secret)).toBe(false);

  const other = await sessionAs(browser, "linzhou");
  try {
    await other.page.goto("/account/access-tokens");
    await expect(other.page.getByRole("heading", { name: "个人访问令牌" })).toBeVisible();
    await expect(other.page.getByText(name, { exact: true })).toHaveCount(0);
  } finally {
    await other.context.close();
  }

  const revoke = row.getByRole("button", { name: "吊销" });
  await expect(revoke).toBeInViewport({ ratio: 1 });
  await revoke.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation.getByRole("heading")).toHaveText(`吊销令牌「${name}」？`);
  await expect.poll(() => confirmation.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await confirmation.getByRole("button", { name: "确认吊销" }).click();
  await expect(row).toContainText("已吊销");
});

test("待改密账号访问令牌管理页时被导向改密页", async ({ browser }) => {
  const admin = await sessionAs(browser, "linzhou");
  const member = await browser.newContext();
  try {
    const loginName = `e2e_pat_${uniq()}`;
    await admin.page.goto("/admin/accounts");
    await admin.page.getByRole("button", { name: "创建账号" }).click();
    const form = admin.page.getByRole("dialog");
    await form.getByLabel("姓名").fill("待改密测试账号");
    await form.getByLabel("登录名").fill(loginName);
    const password = await form.locator("input.font-mono").inputValue();
    await form.getByRole("button", { name: "创建账号" }).click();
    await expect(admin.page.getByText("账号已创建")).toBeVisible();

    const page = await member.newPage();
    await login(page, loginName, password);
    await page.goto("/account/access-tokens");
    await expect(page).toHaveURL("/change-password");
    await expect(page.getByRole("heading", { name: "个人访问令牌" })).toHaveCount(0);
  } finally {
    await member.close();
    await admin.context.close();
  }
});

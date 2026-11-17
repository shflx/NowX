import { type Browser, expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "nowx1234";

/** 随机后缀，保证测试数据不与已有数据冲突 */
export const uniq = () => Math.random().toString(36).slice(2, 7);

export async function fillLogin(page: Page, login: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("账号").fill(login);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
}

/** 登录并等待离开登录页（登录成功后会跳转到工作台或改密页） */
export async function login(page: Page, login: string, password = DEMO_PASSWORD) {
  await fillLogin(page, login, password);
  await page.waitForURL((url) => url.pathname !== "/login");
}

/** 以指定账号打开一个独立的浏览器上下文 */
export async function sessionAs(browser: Browser, account: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, account);
  await expect(page).toHaveURL("/");
  return { context, page };
}

/** 在 Radix 下拉框中选择选项 */
export async function pick(page: Page, trigger: string, option: string) {
  await page.getByRole("combobox", { name: trigger }).click();
  await page.getByRole("option", { name: option }).first().click();
}

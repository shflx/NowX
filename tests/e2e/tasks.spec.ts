import { expect, test } from "@playwright/test";

import { login, pick, uniq } from "./helpers";

test("新建任务后编辑详情并在看板拖动卡片", async ({ page }) => {
  const title = `E2E 任务 ${uniq()}`;
  await login(page, "linzhou");
  await page.goto("/projects/CRM/tasks");

  await page.getByRole("button", { name: "新建任务" }).click();
  await page.getByLabel("标题", { exact: true }).fill(title);
  await page.getByRole("button", { name: "创建" }).click();

  // 创建后自动打开任务详情
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(title)).toBeVisible();

  await sheet.getByLabel("新子任务标题").fill("子任务 A");
  await sheet.getByRole("button", { name: "添加" }).click();
  await expect(sheet.getByText("子任务 A")).toBeVisible();

  await sheet.getByPlaceholder(/写评论/).fill("@陈晓 请帮忙看看");
  await sheet.getByRole("button", { name: "发送" }).click();
  await expect(sheet.getByText("请帮忙看看")).toBeVisible();

  await pick(page, "状态", "进行中");
  await expect(sheet.getByRole("combobox", { name: "状态" })).toContainText("进行中");

  // 关闭详情后，卡片出现在「进行中」列
  await page.keyboard.press("Escape");
  const card = page.getByRole("region", { name: "进行中" }).getByRole("link", { name: title });
  const todo = page.getByRole("region", { name: "待办" });
  await card.scrollIntoViewIfNeeded();
  const source = (await card.boundingBox())!;
  const target = (await todo.getByRole("heading").boundingBox())!;
  await page.mouse.move(source.x + 10, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 20, target.y + 15, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText(/CRM-\d+ → 待办/)).toBeVisible();
  await expect(todo.getByRole("link", { name: title })).toBeVisible();
});

test("列表视图按需求分组展示", async ({ page }) => {
  await login(page, "linzhou");
  await page.goto("/projects/CRM/tasks?view=list");
  await expect(page.getByText(/^R-101 客户批量导入/)).toBeVisible();
  await expect(page.getByText(/^未关联需求/)).toBeVisible();
});

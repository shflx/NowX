import { expect, test } from "@playwright/test";

import { sessionAs, uniq } from "./helpers";

test("提问、回复并采纳答案", async ({ browser }) => {
  const title = `E2E 手机号格式怎么处理 ${uniq()}`;

  // 陈晓提问，指定林舟回答；输入标题时推荐相似 FAQ
  const asker = await sessionAs(browser, "chenxiao");
  await asker.page.goto("/projects/CRM/discussions");
  await asker.page.getByRole("button", { name: "发起提问" }).click();
  await asker.page.getByLabel("问题标题").fill(title);
  await expect(asker.page.getByText("这些已解决的帖子可能回答了你的问题")).toBeVisible();
  await asker.page.getByLabel("详细描述").fill("端到端测试的问题描述");
  await asker.page.getByRole("dialog").getByRole("combobox").first().click();
  await asker.page.getByRole("option", { name: "林舟" }).click();
  await asker.page.getByRole("button", { name: "发布" }).click();
  await expect(asker.page.getByRole("heading", { name: title })).toBeVisible();
  const url = asker.page.url();

  // 林舟回复
  const answerer = await sessionAs(browser, "linzhou");
  await answerer.page.goto(url);
  await answerer.page.getByLabel("回复内容").fill("统一清洗成 11 位后再入库");
  await answerer.page.getByRole("button", { name: "回复", exact: true }).click();
  await expect(answerer.page.getByText("统一清洗成 11 位后再入库")).toBeVisible();

  // 提问者采纳答案后帖子变为已解决
  await asker.page.reload();
  await asker.page.getByRole("button", { name: "采纳为答案" }).click();
  await expect(asker.page.getByText("已采纳", { exact: true })).toBeVisible();
  await expect(asker.page.getByText("已解决").first()).toBeVisible();

  await asker.context.close();
  await answerer.context.close();
});

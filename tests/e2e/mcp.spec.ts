import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";

import { login, uniq } from "./helpers";

test.use({ trace: "off" });

test("外部 MCP 客户端可用站内令牌初始化、发现工具并查询任务与需求", async ({ baseURL, page, request }) => {
  await login(page, "chenxiao");
  await page.goto("/account/access-tokens");
  const name = `Streamable HTTP ${uniq()}`;
  await page.getByLabel("令牌名称").fill(name);
  await page.getByRole("button", { name: "创建令牌" }).click();
  const dialog = page.getByRole("dialog", { name: "令牌已创建" });
  const token = await dialog.locator("code").innerText();
  await dialog.getByRole("button", { name: "完成" }).click();

  const headers = { Authorization: `Bearer ${token}` };
  const endpoint = new URL("/api/mcp", baseURL);
  const transport = new StreamableHTTPClientTransport(endpoint, { requestInit: { headers } });
  const client = new Client({ name: "nowx-http-test", version: "1.0.0" });
  try {
    const missing = await page.request.post(endpoint.href);
    expect(missing.status()).toBe(401);
    expect(missing.headers()["www-authenticate"]).toMatch(/^Bearer /);
    expect(
      (await request.post(endpoint.href, { headers: { Authorization: `Bearer nowx_pat_${"A".repeat(43)}` } })).status(),
    ).toBe(401);
    expect((await request.post(endpoint.href, { headers: { ...headers, Origin: "https://client.invalid" } })).status()).toBe(403);
    expect((await request.get(endpoint.href, { headers })).status()).toBe(405);

    await client.connect(transport);
    expect(client.getServerVersion()).toMatchObject({ name: "NowX" });
    expect(transport.sessionId).toBeUndefined();
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      "list_projects",
      "list_tasks",
      "get_task",
      "list_requirements",
      "get_requirement",
      "list_cycles",
      "create_requirement",
      "update_requirement",
    ]);

    const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
    const projects = await call("list_projects", {});
    expect(projects.structuredContent).toMatchObject({
      items: expect.arrayContaining([
        { id: expect.any(String), key: "CRM", name: expect.any(String), description: expect.any(String) },
      ]),
    });
    expect(await call("list_tasks", { projectKey: "OPS" })).toMatchObject({
      isError: true,
      content: [{ type: "text", text: "项目不存在或无权访问" }],
    });
    const tasks = await call("list_tasks", { projectKey: "CRM", limit: 1 });
    const requirements = await call("list_requirements", { projectKey: "CRM", limit: 1 });
    const task = (tasks.structuredContent as { items: { code: string }[] }).items[0];
    const requirement = (requirements.structuredContent as { items: { code: string }[] }).items[0];
    expect(task.code).toMatch(/^CRM-\d+$/);
    expect(requirement.code).toMatch(/^R-\d+$/);
    expect((await call("get_task", { projectKey: "CRM", number: task.code })).structuredContent).toMatchObject({
      code: task.code,
      description: expect.any(String),
    });
    expect((await call("get_requirement", { projectKey: "CRM", number: requirement.code })).structuredContent).toMatchObject({
      code: requirement.code,
      summary: expect.any(String),
    });

    // 其他 API 接受原有 Cookie 会话，同时拒绝无 Cookie 的请求。
    const otherApi = "/api/materials/mcp-test-missing/download";
    expect((await request.get(otherApi, { headers })).status()).toBe(401);
    expect((await page.request.get(otherApi)).status()).toBe(404);
    expect((await request.get("/api/mcp/extra", { headers })).status()).toBe(401);
  } finally {
    await client.close();
    const row = page.getByRole("row", { name: new RegExp(name) });
    await row.getByRole("button", { name: "吊销" }).click();
    await page.getByRole("button", { name: "确认吊销" }).click();
    await expect(row).toContainText("已吊销");
  }
  expect((await request.post(endpoint.href, { headers })).status()).toBe(401);
});

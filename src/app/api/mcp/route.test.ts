import { afterEach, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/personal-access-token", () => ({
  authenticatePersonalAccessToken: async (authorization: string) => ({ id: authorization }),
}));
vi.mock("@/server/mcp/tools", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  return { createMcpServer: () => new McpServer({ name: "test", version: "1" }) };
});

afterEach(() => vi.restoreAllMocks());

it("按账号限制 POST 请求，到期恢复并返回重试时间", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
  const ping = (account: string) =>
    POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
    );

  for (let i = 0; i < 120; i++) {
    expect((await ping("account-one")).status).toBe(200);
  }
  const limited = await ping("account-one");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect((await ping("account-two")).status).toBe(200);

  now.mockReturnValue(70_000);
  expect((await ping("account-one")).status).toBe(200);
});

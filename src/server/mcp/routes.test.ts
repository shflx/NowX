import { afterEach, expect, it, vi } from "vitest";

import { testBindings, withTestRequest } from "@/server/testing";

import { handleMcp } from "./routes";

const { recordUse } = vi.hoisted(() => ({ recordUse: vi.fn(async (id: string) => ({ id })) }));
vi.mock("@/server/auth/personal-access-token", () => ({
  findValidPersonalAccessToken: async (authorization: string) => {
    const [userId, id] = authorization.replace("Bearer ", "").split(":");
    return { id, userId };
  },
  recordPersonalAccessTokenUse: recordUse,
}));
vi.mock("@/server/mcp/tools", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  return { createMcpServer: () => new McpServer({ name: "test", version: "1" }) };
});

afterEach(() => vi.restoreAllMocks());

it("按账号限制 POST 请求，到期恢复并返回重试时间", async () => {
  const env = testBindings("postgresql://unused");
  const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
  const ping = (account: string) =>
    withTestRequest(env, () =>
      handleMcp(
        new Request("http://localhost/api/mcp", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account}`,
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
        }),
      ),
    );

  for (let i = 0; i < 120; i++) {
    expect((await ping("account-one:token-one")).status).toBe(200);
  }
  const limited = await ping("account-one:token-two");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect(recordUse).toHaveBeenCalledTimes(120);
  expect(recordUse).not.toHaveBeenCalledWith("token-two");
  expect((await ping("account-two:token-three")).status).toBe(200);

  now.mockReturnValue(70_000);
  expect((await ping("account-one:token-two")).status).toBe(200);
});

import { createHash, randomUUID } from "node:crypto";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { runAction } from "@/server/api/actions";
import { testBindings, withTestRequest } from "@/server/testing";

import { PrismaClient } from "../../../prisma/generated/client";

const { requireAdmin, getCurrentUser, deleteUserSessions } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getCurrentUser: vi.fn(),
  deleteUserSessions: vi.fn(),
}));
vi.mock("@/server/auth/dal", async (importOriginal) => ({ ...(await importOriginal<object>()), requireAdmin, getCurrentUser }));
vi.mock("@/server/auth/session", async (importOriginal) => ({ ...(await importOriginal<object>()), deleteUserSessions }));

const testDatabaseUrl = process.env.NOWX_MCP_TEST_DATABASE_URL;

// 被测代码使用 Kysely（请求上下文中的连接）；测试数据的准备与断言使用独立的 Prisma 客户端
describe.skipIf(!testDatabaseUrl)("个人访问令牌（PostgreSQL）", () => {
  const env = testBindings(testDatabaseUrl!);
  const run = <T>(fn: () => Promise<T>) => withTestRequest(env, fn);
  let prisma: PrismaClient;
  let service: typeof import("./personal-access-token");
  let accounts: typeof import("@/features/accounts/mutations");
  let auth: typeof import("@/features/auth/mutations");
  let user: Awaited<ReturnType<typeof prisma.user.create>>;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
    service = await import("./personal-access-token");
    accounts = await import("@/features/accounts/mutations");
    auth = await import("@/features/auth/mutations");
  });

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        login: `test-${randomUUID()}`,
        name: "测试成员",
        passwordHash: await hash("before-change-123"),
        mustChangePassword: false,
        color: "#fff",
      },
    });
    requireAdmin.mockResolvedValue({ id: "another-admin" });
    getCurrentUser.mockResolvedValue({ id: user.id });
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: user.id } });
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("只保存摘要与展示前缀，验证当前身份并记录使用时间", () =>
    run(async () => {
      const { id, token } = await service.createPersonalAccessToken(user.id, "Agent");
      const stored = await prisma.personalAccessToken.findUniqueOrThrow({ where: { id } });
      expect(stored.digest).toBe(createHash("sha256").update(token).digest("hex"));
      expect(stored.prefix).toBe(token.slice(0, 17));
      expect(JSON.stringify(stored).includes(token)).toBe(false);
      expect(await service.findValidPersonalAccessToken(`bearer ${token}`)).toEqual({ id, userId: user.id });
      expect(await service.recordPersonalAccessTokenUse(id)).toEqual({
        id: user.id,
        login: user.login,
        name: user.name,
        title: user.title,
        role: user.role,
        color: user.color,
        mustChangePassword: false,
      });
      expect(await service.listPersonalAccessTokens(user.id)).toEqual([
        expect.objectContaining({ id, lastUsedAt: expect.any(Date) }),
      ]);
      expect(await service.listPersonalAccessTokens("another-owner")).toEqual([]);
      expect(await service.revokePersonalAccessToken("another-owner", id)).toEqual({ count: 0 });
      expect(await service.findValidPersonalAccessToken(`Bearer ${token}`)).not.toBeNull();
    }));

  it("不支持的 HTTP 方法不更新令牌最近使用时间", () =>
    run(async () => {
      const { handleMcp } = await import("@/server/mcp/routes");
      const { id, token } = await service.createPersonalAccessToken(user.id, "Agent");
      const response = await handleMcp(
        new Request("http://localhost/api/mcp", { headers: { Authorization: `Bearer ${token}` } }),
      );

      expect(response.status).toBe(405);
      expect(await service.listPersonalAccessTokens(user.id)).toEqual([expect.objectContaining({ id, lastUsedAt: null })]);
    }));

  it.each(["expired", "revoked", "disabled", "password-required"])("拒绝状态为 %s 的令牌", (reason) =>
    run(async () => {
      const { id, token } = await service.createPersonalAccessToken(user.id, "Agent");
      if (reason === "expired") await prisma.personalAccessToken.update({ where: { id }, data: { expiresAt: new Date(0) } });
      if (reason === "revoked") await service.revokePersonalAccessToken(user.id, id);
      if (reason === "disabled") await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });
      if (reason === "password-required")
        await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
      expect(await service.findValidPersonalAccessToken(`Bearer ${token}`)).toBeNull();
      expect(await service.recordPersonalAccessTokenUse(id)).toBeNull();
    }),
  );

  it("以记录使用时的账号角色处理请求", () =>
    run(async () => {
      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      const { id, token } = await service.createPersonalAccessToken(user.id, "Agent");
      expect(await service.findValidPersonalAccessToken(`Bearer ${token}`)).toEqual({ id, userId: user.id });

      await prisma.user.update({ where: { id: user.id }, data: { role: "MEMBER" } });
      expect(await service.recordPersonalAccessTokenUse(id)).toMatchObject({ role: "MEMBER" });
    }));

  it.each(["disable", "reset", "change"])("账号操作 %s 吊销全部旧令牌", (operation) =>
    run(async () => {
      const first = await service.createPersonalAccessToken(user.id, "Agent 1");
      const second = await service.createPersonalAccessToken(user.id, "Agent 2");

      if (operation === "disable")
        expect(await runAction(accounts.setAccountStatus, [user.id, "DISABLED"])).toMatchObject({ ok: true });
      if (operation === "reset") expect(await runAction(accounts.resetAccountPassword, [user.id])).toMatchObject({ ok: true });
      if (operation === "change") {
        const input = {
          currentPassword: "before-change-123",
          newPassword: "after-change-123",
          confirmPassword: "after-change-123",
        };
        expect(await runAction(auth.changePassword, [input])).toMatchObject({ ok: true });
      }
      expect(deleteUserSessions).toHaveBeenCalledWith(user.id, ...(operation === "change" ? [true] : []));
      // 恢复可用状态也不能恢复旧令牌。
      await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE", mustChangePassword: false } });
      expect((await service.listPersonalAccessTokens(user.id)).every((entry) => entry.revokedAt)).toBe(true);
      for (const { token } of [first, second]) {
        expect(await service.findValidPersonalAccessToken(`Bearer ${token}`)).toBeNull();
      }
    }),
  );
});

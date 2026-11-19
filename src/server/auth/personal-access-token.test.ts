import { randomUUID, createHash } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, getCurrentUser, deleteUserSessions, redirect } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getCurrentUser: vi.fn(),
  deleteUserSessions: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ requireAdmin, getCurrentUser }));
vi.mock("@/server/auth/session", () => ({ deleteUserSessions }));

const testDatabaseUrl = process.env.NOWX_MCP_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("个人访问令牌（PostgreSQL）", () => {
  let db: typeof import("@/server/db").db;
  let service: typeof import("./personal-access-token");
  let accounts: typeof import("@/features/accounts/actions");
  let auth: typeof import("@/features/auth/actions");
  let user: Awaited<ReturnType<typeof db.user.create>>;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testDatabaseUrl);
    ({ db } = await import("@/server/db"));
    service = await import("./personal-access-token");
    accounts = await import("@/features/accounts/actions");
    auth = await import("@/features/auth/actions");
  });

  beforeEach(async () => {
    const { hashPassword } = await import("./password");
    user = await db.user.create({
      data: {
        login: `test-${randomUUID()}`,
        name: "测试成员",
        passwordHash: await hashPassword("before-change-123"),
        mustChangePassword: false,
        color: "#fff",
      },
    });
    requireAdmin.mockResolvedValue({ id: "another-admin" });
    getCurrentUser.mockResolvedValue({ id: user.id });
  });

  afterEach(async () => {
    await db.user.delete({ where: { id: user.id } });
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await db?.$disconnect();
    vi.unstubAllEnvs();
  });

  it("只保存摘要与展示前缀，验证当前身份并记录使用时间", async () => {
    const { id, token } = await service.createPersonalAccessToken(user.id, "Agent");
    const stored = await db.personalAccessToken.findUniqueOrThrow({ where: { id } });
    expect(stored.digest).toBe(createHash("sha256").update(token).digest("hex"));
    expect(stored.prefix).toBe(token.slice(0, 17));
    expect(JSON.stringify(stored).includes(token)).toBe(false);
    expect(await service.authenticatePersonalAccessToken(`bearer ${token}`)).toEqual({
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
    expect(await service.authenticatePersonalAccessToken(`Bearer ${token}`)).not.toBeNull();
  });

  it.each(["expired", "revoked", "disabled", "password-required"])("拒绝状态为 %s 的令牌", async (reason) => {
    const { id, token } = await service.createPersonalAccessToken(user.id, "Agent");
    if (reason === "expired") await db.personalAccessToken.update({ where: { id }, data: { expiresAt: new Date(0) } });
    if (reason === "revoked") await service.revokePersonalAccessToken(user.id, id);
    if (reason === "disabled") await db.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });
    if (reason === "password-required") await db.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
    expect(await service.authenticatePersonalAccessToken(`Bearer ${token}`)).toBeNull();
  });

  it.each(["disable", "reset", "change"])("账号操作 %s 吊销全部旧令牌", async (operation) => {
    const first = await service.createPersonalAccessToken(user.id, "Agent 1");
    const second = await service.createPersonalAccessToken(user.id, "Agent 2");

    if (operation === "disable") expect(await accounts.setAccountStatus(user.id, "DISABLED")).toMatchObject({ ok: true });
    if (operation === "reset") expect(await accounts.resetAccountPassword(user.id)).toMatchObject({ ok: true });
    if (operation === "change") {
      const form = new FormData();
      form.set("currentPassword", "before-change-123");
      form.set("newPassword", "after-change-123");
      form.set("confirmPassword", "after-change-123");
      await auth.changePassword(null, form);
      expect(redirect).toHaveBeenCalledWith("/");
    }
    expect(deleteUserSessions).toHaveBeenCalledWith(user.id, ...(operation === "change" ? [true] : []));
    // 恢复可用状态也不能恢复旧令牌。
    await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE", mustChangePassword: false } });
    expect((await service.listPersonalAccessTokens(user.id)).every((entry) => entry.revokedAt)).toBe(true);
    for (const { token } of [first, second]) {
      expect(await service.authenticatePersonalAccessToken(`Bearer ${token}`)).toBeNull();
    }
  });
});

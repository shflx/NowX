import { ActionError, parseInput } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/dal";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { revokeUserPersonalAccessTokens } from "@/server/auth/personal-access-token";
import { createSession, deleteCurrentSession, deleteUserSessions } from "@/server/auth/session";
import { requestContext } from "@/server/context";
import { db } from "@/server/db";
import { UnauthenticatedError } from "@/server/http-errors";
import { hitLimit, isLimited, resetLimit } from "@/server/rate-limit";

import { changePasswordSchema, loginSchema } from "./schemas";

/** 同一账号 + IP 在 15 分钟内最多失败 5 次 */
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW = 15 * 60 * 1000;

// 账号不存在时也执行一次哈希校验，使响应时间与「密码错误」一致，避免枚举账号
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$+XogXNHo5KTy89yagwPObw$2iPzxKRwCNgP2+T5K2Z7Wlma4T0ZAJbXRIj6eHvnNYQ";

/** 登录成功后返回是否需要先修改初始密码，由前端决定跳转 */
export async function login(input: unknown) {
  const data = parseInput(loginSchema, input);
  const ip = requestContext().request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limitKey = `login:${data.login}:${ip}`;

  if (await isLimited(limitKey, LOGIN_LIMIT)) {
    throw new ActionError("尝试次数过多，请 15 分钟后再试");
  }

  const user = await db.selectFrom("User").selectAll().where("login", "=", data.login).executeTakeFirst();
  const valid = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, data.password);

  if (!user || !valid) {
    await hitLimit(limitKey, LOGIN_LIMIT, LOGIN_WINDOW);
    throw new ActionError("账号或密码错误");
  }
  if (user.status === "DISABLED") {
    throw new ActionError("该账号已停用，请联系管理员");
  }

  await resetLimit(limitKey);
  await createSession(user.id);
  await db.updateTable("User").set({ lastLoginAt: new Date(), updatedAt: new Date() }).where("id", "=", user.id).execute();
  return { mustChangePassword: user.mustChangePassword };
}

export async function logout() {
  await deleteCurrentSession();
}

export async function changePassword(input: unknown) {
  // 这里不用 requireUser：需要改密的用户也要能访问
  const current = await getCurrentUser();
  if (!current) throw new UnauthenticatedError();

  const data = parseInput(changePasswordSchema, input);
  const user = await db.selectFrom("User").select(["id", "passwordHash"]).where("id", "=", current.id).executeTakeFirstOrThrow();
  if (!(await verifyPassword(user.passwordHash, data.currentPassword))) {
    throw new ActionError("当前密码不正确", { currentPassword: "当前密码不正确" });
  }

  const passwordHash = await hashPassword(data.newPassword);
  await db.transaction().execute(async (tx) => {
    const { numUpdatedRows } = await tx
      .updateTable("User")
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where("id", "=", user.id)
      .where("status", "=", "ACTIVE")
      .where("passwordHash", "=", user.passwordHash)
      .executeTakeFirst();
    if (!numUpdatedRows) throw new ActionError("账号状态或密码已变更，请重新登录");
    await revokeUserPersonalAccessTokens(tx, user.id);
  });
  // 改密后让其他设备上的会话失效
  await deleteUserSessions(user.id, true);
}

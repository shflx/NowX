import { createHash, randomBytes } from "node:crypto";

import { SESSION_COOKIE } from "@/lib/cookies";
import { DAY_MS } from "@/lib/dates";
import { deleteCookie, getCookie, setCookie } from "@/server/context";
import { db } from "@/server/db";

/** 会话有效期 */
const SESSION_TTL = 30 * DAY_MS;
/** 剩余有效期少于该值时自动续期（滑动过期） */
const RENEW_THRESHOLD = 15 * DAY_MS;

// Cookie 中保存随机令牌，数据库只保存其摘要：即使数据库泄露也无法直接冒用会话
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL);

  await db
    .insertInto("Session")
    .values({ id: hashToken(token), userId, expiresAt })
    .execute();
  setCookie(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", expires: expiresAt });
}

/** 校验令牌并返回会话用户；过期会话会被清理，临近过期的会话会自动续期 */
export async function validateSessionToken(token: string) {
  const id = hashToken(token);
  const session = await db
    .selectFrom("Session")
    .innerJoin("User", "User.id", "Session.userId")
    .select([
      "Session.expiresAt",
      "User.id",
      "User.login",
      "User.name",
      "User.title",
      "User.role",
      "User.color",
      "User.status",
      "User.mustChangePassword",
    ])
    .where("Session.id", "=", id)
    .executeTakeFirst();
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.deleteFrom("Session").where("id", "=", id).execute();
    return null;
  }

  if (session.expiresAt.getTime() - now < RENEW_THRESHOLD) {
    await db
      .updateTable("Session")
      .set({ expiresAt: new Date(now + SESSION_TTL) })
      .where("id", "=", id)
      .execute();
  }

  return session;
}

/** 注销当前会话并删除 Cookie */
export async function deleteCurrentSession() {
  const token = getCookie(SESSION_COOKIE);
  if (token) await db.deleteFrom("Session").where("id", "=", hashToken(token)).execute();
  deleteCookie(SESSION_COOKIE);
}

/** 让某个用户的全部会话失效（停用账号、重置密码时使用） */
export async function deleteUserSessions(userId: string, exceptCurrent = false) {
  const token = exceptCurrent ? getCookie(SESSION_COOKIE) : undefined;
  let query = db.deleteFrom("Session").where("userId", "=", userId);
  if (token) query = query.where("id", "!=", hashToken(token));
  await query.execute();
}

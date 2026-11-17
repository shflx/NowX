import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/cookies";
import { db } from "@/server/db";

const DAY = 24 * 60 * 60 * 1000;
/** 会话有效期 */
const SESSION_TTL = 30 * DAY;
/** 剩余有效期少于该值时自动续期（滑动过期） */
const RENEW_THRESHOLD = 15 * DAY;

// Cookie 中保存随机令牌，数据库只保存其摘要：即使数据库泄露也无法直接冒用会话
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL);

  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** 校验令牌并返回会话与用户；过期会话会被清理，临近过期的会话会自动续期 */
export async function validateSessionToken(token: string) {
  const id = hashToken(token);
  const session = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  if (session.expiresAt.getTime() - now < RENEW_THRESHOLD) {
    session.expiresAt = new Date(now + SESSION_TTL);
    await db.session.update({ where: { id }, data: { expiresAt: session.expiresAt } });
  }

  return session;
}

/** 注销当前会话并删除 Cookie */
export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { id: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** 让某个用户的全部会话失效（停用账号、重置密码时使用） */
export async function deleteUserSessions(userId: string, exceptCurrent = false) {
  let keepId: string | undefined;
  if (exceptCurrent) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    keepId = token ? hashToken(token) : undefined;
  }
  await db.session.deleteMany({ where: { userId, ...(keepId ? { NOT: { id: keepId } } : {}) } });
}

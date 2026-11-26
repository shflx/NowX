import { createHash, randomBytes } from "node:crypto";

import { ActionError } from "@/lib/action-result";
import { DAY_MS } from "@/lib/dates";
import type { CurrentUser } from "@/server/auth/dal";
import { type Database, db, type Tx } from "@/server/db";
import { cuid } from "@/server/db/id";

/** 个人访问令牌有效期 */
const TOKEN_TTL = 90 * DAY_MS;
const metadata = ["id", "name", "prefix", "expiresAt", "lastUsedAt", "revokedAt", "createdAt"] as const;

const digestOf = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createPersonalAccessToken(userId: string, name: string) {
  return db.transaction().execute(async (tx) => {
    // 与账号状态和密码更新串行，确保先签发的令牌会被后续吊销。
    const user = await tx
      .selectFrom("User")
      .select("id")
      .where("id", "=", userId)
      .where("status", "=", "ACTIVE")
      .where("mustChangePassword", "=", false)
      .forUpdate()
      .executeTakeFirst();
    if (!user) throw new ActionError("当前账号不能创建访问令牌");

    const token = `nowx_pat_${randomBytes(32).toString("base64url")}`;
    const record = await tx
      .insertInto("PersonalAccessToken")
      .values({
        id: cuid(),
        userId,
        name,
        prefix: token.slice(0, 17),
        digest: digestOf(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL),
      })
      .returning(metadata)
      .executeTakeFirstOrThrow();
    return { ...record, token };
  });
}

export function listPersonalAccessTokens(userId: string) {
  return db
    .selectFrom("PersonalAccessToken")
    .select(metadata)
    .where("userId", "=", userId)
    .orderBy("createdAt", "desc")
    .execute();
}

export async function revokePersonalAccessToken(userId: string, id: string) {
  const { numUpdatedRows } = await db
    .updateTable("PersonalAccessToken")
    .set({ revokedAt: new Date() })
    .where("id", "=", id)
    .where("userId", "=", userId)
    .where("revokedAt", "is", null)
    .executeTakeFirst();
  return { count: Number(numUpdatedRows) };
}

/** 与账号状态或密码更新使用同一事务。 */
export function revokeUserPersonalAccessTokens(tx: Database | Tx, userId: string) {
  return tx
    .updateTable("PersonalAccessToken")
    .set({ revokedAt: new Date() })
    .where("userId", "=", userId)
    .where("revokedAt", "is", null)
    .execute();
}

/** 有效令牌：未吊销、未过期，且所属账号正常、无需改密 */
function validToken(now: Date) {
  return db
    .selectFrom("PersonalAccessToken as t")
    .innerJoin("User as u", "u.id", "t.userId")
    .where("t.revokedAt", "is", null)
    .where("t.expiresAt", ">", now)
    .where("u.status", "=", "ACTIVE")
    .where("u.mustChangePassword", "=", false);
}

export async function findValidPersonalAccessToken(authorization: string | null) {
  const token = authorization?.match(/^Bearer (nowx_pat_[A-Za-z0-9_-]{43})$/i)?.[1];
  if (!token) return null;

  const record = await validToken(new Date())
    .select(["t.id", "t.userId"])
    .where("t.digest", "=", digestOf(token))
    .executeTakeFirst();
  return record ?? null;
}

/** 通过入口检查后才记录使用，并以此时的账号权限处理请求。 */
export async function recordPersonalAccessTokenUse(id: string): Promise<CurrentUser | null> {
  const now = new Date();
  const user = await db
    .updateTable("PersonalAccessToken as t")
    .from("User as u")
    .set({ lastUsedAt: now })
    .whereRef("u.id", "=", "t.userId")
    .where("t.id", "=", id)
    .where("t.revokedAt", "is", null)
    .where("t.expiresAt", ">", now)
    .where("u.status", "=", "ACTIVE")
    .where("u.mustChangePassword", "=", false)
    .returning(["u.id", "u.login", "u.name", "u.title", "u.role", "u.color", "u.mustChangePassword"])
    .executeTakeFirst();
  return user ?? null;
}

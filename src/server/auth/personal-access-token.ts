import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { ActionError } from "@/lib/action-result";
import { DAY_MS } from "@/lib/dates";
import type { CurrentUser } from "@/server/auth/dal";
import { db, type Tx } from "@/server/db";

/** 个人访问令牌有效期 */
const TOKEN_TTL = 90 * DAY_MS;
const activeUser = { status: "ACTIVE", mustChangePassword: false } as const;
const metadata = {
  id: true,
  name: true,
  prefix: true,
  expiresAt: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

const digestOf = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createPersonalAccessToken(userId: string, name: string) {
  return db.$transaction(async (tx) => {
    // 与账号状态和密码更新串行，确保先签发的令牌会被后续吊销。
    const users = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User"
      WHERE id = ${userId} AND status = 'ACTIVE' AND NOT "mustChangePassword"
      FOR UPDATE
    `;
    if (!users.length) throw new ActionError("当前账号不能创建访问令牌");

    const token = `nowx_pat_${randomBytes(32).toString("base64url")}`;
    const record = await tx.personalAccessToken.create({
      data: {
        userId,
        name,
        prefix: token.slice(0, 17),
        digest: digestOf(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL),
      },
      select: metadata,
    });
    return { ...record, token };
  });
}

export function listPersonalAccessTokens(userId: string) {
  return db.personalAccessToken.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: metadata });
}

export function revokePersonalAccessToken(userId: string, id: string) {
  return db.personalAccessToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** 与账号状态或密码更新使用同一事务。 */
export function revokeUserPersonalAccessTokens(tx: Tx, userId: string) {
  return tx.personalAccessToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

function validTokenWhere(now: Date) {
  return { revokedAt: null, expiresAt: { gt: now }, user: activeUser };
}

export async function findValidPersonalAccessToken(authorization: string | null) {
  const token = authorization?.match(/^Bearer (nowx_pat_[A-Za-z0-9_-]{43})$/i)?.[1];
  if (!token) return null;

  return db.personalAccessToken.findUnique({
    where: { digest: digestOf(token), ...validTokenWhere(new Date()) },
    select: { id: true, userId: true },
  });
}

/** 通过入口检查后才记录使用，并以此时的账号权限处理请求。 */
export async function recordPersonalAccessTokenUse(id: string): Promise<CurrentUser | null> {
  const now = new Date();
  const [record] = await db.personalAccessToken.updateManyAndReturn({
    where: { id, ...validTokenWhere(now) },
    data: { lastUsedAt: now },
    select: {
      user: { select: { id: true, login: true, name: true, title: true, role: true, color: true, mustChangePassword: true } },
    },
  });
  return record?.user ?? null;
}

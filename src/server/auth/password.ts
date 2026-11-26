import { createHash } from "node:crypto";

import { requestContext } from "@/server/context";

// 密码哈希使用 Argon2id，计算量较大，交给 PasswordHash Durable Object 执行，
// 不占用 Worker 请求的 CPU 时间。按哈希值分散到不同实例。

function hasher(name: string) {
  return requestContext().env.PASSWORD_HASH.getByName(name);
}

export function hashPassword(password: string) {
  return hasher(crypto.randomUUID().slice(0, 2)).hash(password);
}

export async function verifyPassword(passwordHash: string, password: string) {
  return hasher(createHash("sha256").update(passwordHash).digest("hex").slice(0, 2)).verify(passwordHash, password);
}

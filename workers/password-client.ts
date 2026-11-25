import { createHash } from "node:crypto";
import { env } from "cloudflare:workers";
import type { PasswordHash } from "./password-hash";

const namespace = (env as { PASSWORD_HASH: DurableObjectNamespace<PasswordHash> }).PASSWORD_HASH;

export function hashPassword(password: string) {
  return namespace.getByName(crypto.randomUUID().slice(0, 2)).hash(password);
}

export function verifyPassword(passwordHash: string, password: string) {
  return namespace.getByName(createHash("sha256").update(passwordHash).digest("hex").slice(0, 2)).verify(passwordHash, password);
}

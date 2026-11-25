import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
import type { RateLimit } from "./rate-limit";

function bucketFor(key: string) {
  const namespace = (env as { RATE_LIMIT: DurableObjectNamespace<RateLimit> }).RATE_LIMIT;
  return namespace.getByName(createHash("sha256").update(key).digest("hex"));
}

export function hitLimit(key: string, limit: number, windowMs: number) {
  return bucketFor(key).hit(limit, windowMs);
}

export function isLimited(key: string, limit: number) {
  return bucketFor(key).isLimited(limit);
}

export function resetLimit(key: string) {
  return bucketFor(key).reset();
}

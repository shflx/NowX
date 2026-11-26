import { createHash } from "node:crypto";

import { requestContext } from "./context";

// 固定窗口限流：每个限流键对应一个 RateLimit Durable Object，多实例之间共享计数。

function bucketFor(key: string) {
  return requestContext().env.RATE_LIMIT.getByName(createHash("sha256").update(key).digest("hex"));
}

/** 记录一次尝试，返回是否已超过上限 */
export function hitLimit(key: string, limit: number, windowMs: number) {
  return bucketFor(key).hit(limit, windowMs);
}

export function isLimited(key: string, limit: number) {
  return bucketFor(key).isLimited(limit);
}

export function resetLimit(key: string) {
  return bucketFor(key).reset();
}

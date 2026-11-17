import "server-only";

// 进程内固定窗口限流，用于登录防爆破。单实例部署下足够；多实例需要换成共享存储。

type Bucket = { count: number; resetAt: number };

const globalForLimit = globalThis as unknown as { rateLimitBuckets?: Map<string, Bucket> };
const buckets = (globalForLimit.rateLimitBuckets ??= new Map());

/** 记录一次失败尝试，返回是否已超过上限 */
export function hitLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

export function isLimited(key: string, limit: number) {
  const bucket = buckets.get(key);
  return Boolean(bucket && bucket.resetAt > Date.now() && bucket.count >= limit);
}

export function resetLimit(key: string) {
  buckets.delete(key);
}

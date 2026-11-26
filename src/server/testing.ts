// 测试辅助：在 Node 中构造请求上下文，绑定使用内存实现（只供 *.test.ts 使用）。
import { hash, verify } from "@node-rs/argon2";

import type { Bindings } from "./bindings";
import { runWithContext } from "./context";

type Bucket = { count: number; resetAt: number };

/** 与 workers/rate-limit.ts 相同的固定窗口限流，计数保存在内存中 */
function memoryRateLimit(): Bindings["RATE_LIMIT"] {
  const buckets = new Map<string, Bucket>();
  return {
    getByName: (name) => ({
      async hit(limit, windowMs) {
        const now = Date.now();
        const bucket = buckets.get(name);
        const next =
          bucket && bucket.resetAt > now
            ? { count: bucket.count + 1, resetAt: bucket.resetAt }
            : { count: 1, resetAt: now + windowMs };
        buckets.set(name, next);
        return next.count > limit;
      },
      async isLimited(limit) {
        const bucket = buckets.get(name);
        return Boolean(bucket && bucket.resetAt > Date.now() && bucket.count >= limit);
      },
      async reset() {
        buckets.delete(name);
      },
    }),
  };
}

export function testBindings(connectionString: string): Bindings {
  return {
    HYPERDRIVE: { connectionString },
    LIVE_EVENTS: { getByName: () => ({ broadcast: async () => {} }) },
    RATE_LIMIT: memoryRateLimit(),
    // 与 PasswordHash 使用相同的 Argon2id 参数（m=19456, t=2, p=1）
    PASSWORD_HASH: {
      getByName: () => ({
        hash: (password) => hash(password),
        verify: (passwordHash, password) => verify(passwordHash, password).catch(() => false),
      }),
    },
    ATTACHMENTS: {
      put: async () => {},
      get: async () => null,
      delete: async () => {},
    },
    ATTACHMENT_QUOTA: {
      getByName: () => ({ reserve: async () => "ok", allowRead: async () => true, release: async () => {} }),
    },
  };
}

/** 在一次模拟请求中执行 fn，并等待响应后的后台任务完成 */
export async function withTestRequest<T>(
  env: Bindings,
  fn: () => Promise<T>,
  request = new Request("http://localhost/api/test"),
) {
  const pending: Promise<unknown>[] = [];
  const result = await runWithContext({ request, env, waitUntil: (task) => void pending.push(task) }, fn);
  await Promise.all(pending);
  return result;
}

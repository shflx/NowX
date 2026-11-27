import { AsyncLocalStorage } from "node:async_hooks";

import type { Bindings } from "./bindings";
import { withDatabase } from "./db";

/** 单次请求的上下文：读取请求信息与绑定、写入响应 Cookie、登记响应后的后台任务 */
type RequestContext = {
  request: Request;
  env: Bindings;
  waitUntil: (task: Promise<unknown>) => void;
  /** 响应需要附带的 Set-Cookie */
  cookies: string[];
  /** 同一请求内缓存的数据（如当前用户），避免重复查询 */
  memo: Map<string, Promise<unknown>>;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: Omit<RequestContext, "cookies" | "memo">, fn: () => Promise<T>) {
  const state: RequestContext = { ...context, cookies: [], memo: new Map() };
  return storage.run(state, () => withDatabase(context.env.HYPERDRIVE.connectionString, fn, context.waitUntil));
}

export function requestContext() {
  const state = storage.getStore();
  if (!state) throw new Error("只能在请求内调用");
  return state;
}

/** 同一请求内只执行一次（类似 React cache） */
export function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const { memo: cache } = requestContext();
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key) as Promise<T>;
}

/** 读取请求 Cookie */
export function getCookie(name: string) {
  const header = requestContext().request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

type CookieOptions = { httpOnly?: boolean; secure?: boolean; expires?: Date; maxAge?: number };

/** 写入响应 Cookie（Path=/、SameSite=Lax） */
export function setCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  requestContext().cookies.push(parts.join("; "));
}

export function deleteCookie(name: string) {
  setCookie(name, "", { maxAge: 0 });
}

/**
 * 响应发送后执行的轻量任务（如累计浏览数）。
 * 请求结束时连接池已释放，后台任务使用独立的数据库连接。
 */
export function runInBackground(task: () => Promise<unknown>) {
  const { env, waitUntil } = requestContext();
  waitUntil(
    withDatabase(env.HYPERDRIVE.connectionString, task, waitUntil).catch((error) => {
      console.error("[background]", error);
    }),
  );
}

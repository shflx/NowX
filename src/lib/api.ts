// 浏览器端请求 /api 的统一封装：
// - 时间字段在 JSON 中是 ISO 字符串，解析时还原为 Date（与服务端拿到的数据一致）
// - 未登录跳转登录页，需要改密时跳转改密页，404 交给页面渲染「不存在」
import { reviveDates } from "./json-dates";

export function parseJson<T>(text: string): T {
  return JSON.parse(text, reviveDates) as T;
}

/** 资源不存在或无权访问 */
export class NotFoundError extends Error {}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// 跳转由路由模块注册，避免本模块依赖路由（路由模块引用了全部页面）
let redirect: (to: string) => void = (to) => location.assign(to);

export function setRedirectHandler(handler: (to: string) => void) {
  redirect = handler;
}

/** 在组件之外跳转页面（如登录成功后） */
export function redirectTo(to: string) {
  redirect(to);
}

/** 处理鉴权类响应：需要跳转时返回 true */
export function handleAuthResponse(response: Response, body: { code?: string }) {
  if (response.status === 401) {
    redirect("/login");
    return true;
  }
  if (response.status === 403 && body.code === "MUST_CHANGE_PASSWORD") {
    redirect("/change-password");
    return true;
  }
  return false;
}

/** 跳转期间保持加载状态 */
const never = <T>() => new Promise<T>(() => {});

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  const text = await response.text();
  const body = text ? parseJson<T & { error?: string; code?: string }>(text) : ({} as T & { error?: string; code?: string });
  if (handleAuthResponse(response, body)) return never();
  if (response.status === 404) throw new NotFoundError(body.error);
  if (!response.ok) throw new ApiError(response.status, body.error ?? "服务器出错了，请稍后重试");
  return body;
}

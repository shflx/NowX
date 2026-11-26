// 浏览器端调用服务端写操作：
// POST /api/actions/<名称>，请求体为参数数组，返回 ActionResult；成功后刷新页面数据。
import type { ActionResult } from "./action-result";
import { handleAuthResponse, parseJson } from "./api";
import { queryClient } from "./query";

const FAILED: ActionResult<never> = { ok: false, error: "服务器出错了，请稍后重试" };

export async function callAction<T>(name: string, args: unknown[], { refresh = true } = {}): Promise<ActionResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/actions/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch {
    return { ok: false, error: "网络连接失败，请稍后重试" };
  }

  const text = await response.text();
  const body: ActionResult<T> & { code?: string } = text ? parseJson(text) : FAILED;
  // 跳转与调用方处于同一个过渡中，动作需要正常结束，跳转才能完成
  if (handleAuthResponse(response, body))
    return { ok: false, error: body.code === "MUST_CHANGE_PASSWORD" ? "请先修改初始密码" : "登录已失效，请重新登录" };
  if (!response.ok || !("ok" in body)) return FAILED;

  if (body.ok && refresh) await queryClient.invalidateQueries();
  return body;
}

type ServerFunction = (...args: never[]) => Promise<unknown>;

/**
 * 声明一个写操作的客户端入口。参数和返回值类型取自服务端实现：
 * export const createTask = action<typeof mutations.createTask>("tasks.createTask");
 * 只读的查询（如发帖时的推荐）传 { refresh: false }，成功后不刷新页面数据。
 */
export function action<F extends ServerFunction>(name: string, options?: { refresh?: boolean }) {
  return (...args: Parameters<F>) => callAction<Awaited<ReturnType<F>>>(name, args, options);
}

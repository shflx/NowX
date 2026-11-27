import type { Bindings } from "@/server/bindings";
import { requestContext, runWithContext } from "@/server/context";

import { app } from "./app";

/** 把请求过程中写入的 Cookie 附加到响应上 */
function withCookies(response: Response) {
  const { cookies } = requestContext();
  if (cookies.length === 0) return response;
  const result = new Response(response.body, response);
  for (const cookie of cookies) result.headers.append("Set-Cookie", cookie);
  return result;
}

/** 在请求上下文中执行 /api 接口（Worker 入口与 AgentRunner 共用） */
export function handleApi(request: Request, env: Bindings, waitUntil: (task: Promise<unknown>) => void) {
  return runWithContext({ request, env, waitUntil }, async () => withCookies(await app.fetch(request)));
}

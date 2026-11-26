import { LAST_PROJECT_COOKIE, SESSION_COOKIE } from "../src/lib/cookies";
import { app } from "../src/server/api/app";
import { getCurrentUser } from "../src/server/auth/dal";
import { requestContext, runWithContext } from "../src/server/context";
import { db } from "../src/server/db";
import { projectChannel, userChannel } from "../src/server/event-channels";
import { canAccessProject } from "../src/server/permissions";

import type { AttachmentQuota } from "./attachment-quota";
import type { LiveEvents } from "./events";
import type { PasswordHash } from "./password-hash";
import type { RateLimit } from "./rate-limit";

export { AttachmentQuota } from "./attachment-quota";
export { LiveEvents } from "./events";
export { PasswordHash } from "./password-hash";
export { RateLimit } from "./rate-limit";

/** 绑定的实际类型；传入请求上下文时由类型检查确认与 src/server/bindings.ts 的接口一致 */
interface WorkerEnv {
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
  ATTACHMENTS: R2Bucket;
  LIVE_EVENTS: DurableObjectNamespace<LiveEvents>;
  RATE_LIMIT: DurableObjectNamespace<RateLimit>;
  PASSWORD_HASH: DurableObjectNamespace<PasswordHash>;
  ATTACHMENT_QUOTA: DurableObjectNamespace<AttachmentQuota>;
}

const PUBLIC_PATHS = ["/login"];
/** 不需要会话 Cookie 的接口：登录，以及使用 Bearer 令牌的远程 MCP 入口 */
const PUBLIC_APIS = ["/api/actions/auth.login", "/api/mcp"];

function hasCookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "").split(";").some((part) => part.trim().startsWith(`${name}=`));
}

/**
 * 页面请求：没有会话 Cookie 时跳转登录页（乐观检查，不查库）；
 * 真正的会话校验与权限判断在 /api 中完成。其余交给静态资源，单页应用的路由都返回 index.html。
 */
async function servePage(request: Request, env: WorkerEnv) {
  const url = new URL(request.url);
  // 只处理浏览器打开页面的请求，脚本、样式等资源直接交给静态资源服务
  const isDocument = request.headers.get("Accept")?.includes("text/html") ?? false;
  if (!isDocument) return env.ASSETS.fetch(request);

  if (!hasCookie(request, SESSION_COOKIE) && !PUBLIC_PATHS.includes(url.pathname)) {
    return Response.redirect(new URL("/login", url).href, 307);
  }

  const response = await env.ASSETS.fetch(request);
  const projectKey = url.pathname.match(/^\/projects\/([A-Za-z]+)(\/|$)/)?.[1];
  if (!projectKey) return response;

  // 记录最近访问的项目，工作台据此决定侧边栏展示哪个项目
  const page = new Response(response.body, response);
  page.headers.append("Set-Cookie", `${LAST_PROJECT_COOKIE}=${projectKey.toUpperCase()}; Path=/; SameSite=Lax; Max-Age=31536000`);
  return page;
}

/** 实时推送：校验会话与项目权限后，把 WebSocket 交给对应频道的 Durable Object */
async function connectEvents(request: Request, env: WorkerEnv) {
  const url = new URL(request.url);
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response(null, { status: 426 });
  if (request.headers.get("Origin") !== url.origin) return new Response(null, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  let channel = userChannel(user.id);
  const projectKey = url.searchParams.get("project");
  if (projectKey) {
    const project = await db.selectFrom("Project").select("id").where("key", "=", projectKey.toUpperCase()).executeTakeFirst();
    if (!project || !(await canAccessProject(user, project.id))) return new Response("无权访问", { status: 403 });
    channel = projectChannel(project.id);
  }

  // 只转发握手所需的请求头，会话 Cookie 不需要传给 Durable Object
  return env.LIVE_EVENTS.getByName(channel).fetch(new Request(request.url, { headers: { Upgrade: "websocket" } }));
}

/** 把请求过程中写入的 Cookie 附加到响应上 */
function withCookies(response: Response) {
  const { cookies } = requestContext();
  if (cookies.length === 0) return response;
  const result = new Response(response.body, response);
  for (const cookie of cookies) result.headers.append("Set-Cookie", cookie);
  return result;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return servePage(request, env);
    // 接口请求没有会话 Cookie 时直接返回 401
    if (!PUBLIC_APIS.includes(url.pathname) && !hasCookie(request, SESSION_COOKIE))
      return Response.json({ error: "未登录" }, { status: 401 });

    const context = { request, env, waitUntil: (task: Promise<unknown>) => ctx.waitUntil(task) };
    return runWithContext(context, async () => {
      if (url.pathname === "/api/events") return connectEvents(request, env);
      return withCookies(await app.fetch(request, env, ctx));
    });
  },
} satisfies ExportedHandler<WorkerEnv>;

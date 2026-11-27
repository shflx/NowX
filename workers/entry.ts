import { LAST_PROJECT_COOKIE, SESSION_COOKIE } from "../src/lib/cookies";
import { agentRunner } from "../src/server/agent";
import { handleApi } from "../src/server/api/handle";
import { getCurrentUser } from "../src/server/auth/dal";
import { runWithContext } from "../src/server/context";
import { db } from "../src/server/db";
import { projectChannel, userChannel } from "../src/server/event-channels";
import { canAccessProject } from "../src/server/permissions";

import type { AgentRunner } from "./agent-runner";
import type { AttachmentQuota } from "./attachment-quota";
import type { LiveEvents } from "./events";
import type { PasswordHash } from "./password-hash";
import type { RateLimit } from "./rate-limit";

export { AgentRunner } from "./agent-runner";
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
  AGENT_RUNNER: DurableObjectNamespace<AgentRunner>;
}

const PUBLIC_PATHS = ["/login"];
/** 不需要会话 Cookie 的接口：登录，以及使用 Bearer 令牌的远程 MCP 入口 */
const PUBLIC_APIS = ["/api/actions/auth.login", "/api/mcp"];
/** CPU 开销较大的接口，交给 AgentRunner 执行 */
const AGENT_APIS = ["/api/mcp", "/api/assistant"];

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

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return servePage(request, env);
    // 接口请求没有会话 Cookie 时直接返回 401
    if (!PUBLIC_APIS.includes(url.pathname) && !hasCookie(request, SESSION_COOKIE))
      return Response.json({ error: "未登录" }, { status: 401 });

    if (AGENT_APIS.includes(url.pathname)) return agentRunner(env).fetch(request);

    const waitUntil = (task: Promise<unknown>) => ctx.waitUntil(task);
    if (url.pathname === "/api/events") return runWithContext({ request, env, waitUntil }, () => connectEvents(request, env));
    return handleApi(request, env, waitUntil);
  },
} satisfies ExportedHandler<WorkerEnv>;

import handler from "vinext/server/fetch-handler";

import { withDatabase } from "./database";
import type { LiveEvents } from "./events";

export { AttachmentQuota } from "./attachment-quota";
export { LiveEvents } from "./events";
export { PasswordHash } from "./password-hash";
export { RateLimit } from "./rate-limit";

interface WorkerEnv {
  HYPERDRIVE: Hyperdrive;
  LIVE_EVENTS: DurableObjectNamespace<LiveEvents>;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const render = () => withDatabase(env.HYPERDRIVE.connectionString, () => handler.fetch(request, env, ctx), ctx);

    if (url.pathname !== "/api/events") return render();
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response(null, { status: 426 });
    }
    if (request.headers.get("Origin") !== url.origin) return new Response(null, { status: 403 });

    const authorization = await render();
    if (authorization.status !== 204) return authorization;

    const channel = authorization.headers.get("X-NowX-Channel");
    if (!channel) return new Response(null, { status: 500 });

    // 转发握手所需的请求头，应用会话不需要传给 Durable Object。
    const handshake = new Request(request.url, { headers: { Upgrade: "websocket" } });
    return env.LIVE_EVENTS.getByName(channel).fetch(handshake);
  },
};

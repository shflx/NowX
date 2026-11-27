import { DurableObject } from "cloudflare:workers";

import { replyAsAssistant } from "../src/features/assistant/topic-reply";
import { handleApi } from "../src/server/api/handle";
import type { Bindings } from "../src/server/bindings";
import { runWithContext } from "../src/server/context";

/**
 * 执行 CPU 开销较大的接口：远程 MCP、项目助手（含帖子中 @项目助手 的自动回复）。
 * MCP SDK 与大模型 SDK 的处理超出 Worker 请求的 CPU 预算，Durable Object 不受该限制。
 * 不保存状态，按请求分散到少量实例上，业务代码与 Worker 中的 /api 完全相同。
 */
export class AgentRunner extends DurableObject<Bindings> {
  async fetch(request: Request) {
    return handleApi(request, this.env, (task) => this.ctx.waitUntil(task));
  }

  /** 帖子中 @项目助手 时由助手补充回复（发帖请求在响应之后调用） */
  async replyToTopic(topicId: string) {
    const request = new Request("https://nowx.internal/agent/reply");
    await runWithContext({ request, env: this.env, waitUntil: (task) => this.ctx.waitUntil(task) }, () =>
      replyAsAssistant(topicId),
    );
  }
}

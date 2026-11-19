import "server-only";

import type { AssistantConfig } from "@/server/config";

import type { AssistantTool } from "../tool-definition";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** 一次问答请求：system 为按顺序拼接的系统提示，history 最后一条是本次提问 */
export type ProviderRequest = {
  config: AssistantConfig;
  system: string[];
  history: ChatTurn[];
  tools: AssistantTool[];
};

/** 模型的最终回复；refusal 表示被模型或服务方的安全策略拒绝 */
export type ProviderResult = { type: "text"; text: string } | { type: "refusal" };

/** 各协议的 SDK 错误统一归为三类，由调用方转成面向用户的提示 */
export class ProviderError extends Error {
  constructor(
    readonly kind: "auth" | "rate_limit" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

/** 工具调用的最大轮数，防止模型反复调用工具 */
export const MAX_TOOL_ROUNDS = 8;

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";

import { MAX_TOOL_ROUNDS, ProviderError, type ProviderRequest, type ProviderResult } from "./types";

/** 支持服务端备用模型（fallbacks: "default"）的模型；其余模型不发送该参数 */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

let client: Anthropic | null = null;

/** Anthropic Messages API：由 SDK 的 Tool Runner 驱动工具调用循环 */
export async function askAnthropic({ config, system, history, tools }: ProviderRequest): Promise<ProviderResult> {
  client ??= new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL });

  // 备用模型只在直连 Claude API 时启用，经代理或网关转发时可能不被支持
  const fallback = !config.baseURL && FALLBACK_MODELS.has(config.model);

  try {
    const final = await client.beta.messages.toolRunner({
      model: config.model,
      max_tokens: 16000,
      // 问答类场景以响应速度为主，低思考强度即可
      output_config: { effort: "low" },
      // 被安全策略拒绝时由服务端自动改用默认的备用模型重试
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      max_iterations: MAX_TOOL_ROUNDS,
      system: system.map((text) => ({ type: "text" as const, text })),
      // 不发送 type: "custom"：Claude API 缺省即按自定义工具处理，部分兼容服务（如 DeepSeek）不接受该取值
      tools: tools.map((tool) => Object.assign(betaZodTool(tool), { type: undefined })),
      messages: history,
    });

    if (final.stop_reason === "refusal") return { type: "refusal" };
    const text = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return { type: "text", text };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ProviderError("auth", error.message);
    if (error instanceof Anthropic.RateLimitError) throw new ProviderError("rate_limit", error.message);
    if (error instanceof Anthropic.APIError)
      throw new ProviderError("unavailable", `${error.status ?? "网络"}：${error.message}`);
    throw error;
  }
}

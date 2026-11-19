import "server-only";

import { todayIn } from "@/lib/dates";

/** 项目助手支持的接口协议：Anthropic Messages API，或 OpenAI Chat Completions（含兼容服务） */
export type AssistantProtocol = "anthropic" | "openai";

/** 各协议未填写 ASSISTANT_MODEL 时的默认模型；OpenAI 兼容服务的模型名各不相同，必须显式填写 */
const DEFAULT_MODEL: Record<AssistantProtocol, string | undefined> = {
  anthropic: "claude-opus-5-5",
  openai: undefined,
};

function loadAssistantConfig() {
  const raw = (process.env.ASSISTANT_PROTOCOL || "anthropic").toLowerCase();
  if (raw !== "anthropic" && raw !== "openai") {
    console.warn(`[assistant] 不支持的 ASSISTANT_PROTOCOL「${raw}」，项目助手已停用（可选 anthropic / openai）`);
    return null;
  }
  const protocol: AssistantProtocol = raw;
  const apiKey = process.env.ASSISTANT_API_KEY;
  const model = process.env.ASSISTANT_MODEL || DEFAULT_MODEL[protocol];
  if (!apiKey) return null;
  if (!model) {
    console.warn("[assistant] 使用 openai 协议时需要填写 ASSISTANT_MODEL，项目助手已停用");
    return null;
  }
  return { protocol, apiKey, model, baseURL: process.env.ASSISTANT_BASE_URL || undefined };
}

export type AssistantConfig = NonNullable<ReturnType<typeof loadAssistantConfig>>;

const assistant = loadAssistantConfig();

/** 运行时配置（来自环境变量） */
export const appConfig = {
  timeZone: process.env.APP_TIMEZONE || "Asia/Shanghai",
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  /** 项目助手的连接配置；未配置或配置无效时为 null */
  assistant,
  assistantEnabled: assistant !== null,
};

/** 应用时区下的今天（yyyy-MM-dd） */
export const today = () => todayIn(appConfig.timeZone);

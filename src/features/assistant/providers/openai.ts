import "server-only";

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";

import type { AssistantTool } from "../tool-definition";
import { MAX_TOOL_ROUNDS, ProviderError, type ProviderRequest, type ProviderResult } from "./types";

let client: OpenAI | null = null;

/** Zod 参数定义 → Chat Completions 的函数工具；按输入形态导出，带默认值的参数为可选 */
const toFunctionTool = (tool: AssistantTool): ChatCompletionTool => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.inputSchema, { io: "input" }),
  },
});

/** 执行一次工具调用；参数无效或执行出错时把错误交给模型，由它调整后重试或如实说明 */
async function runTool(tools: AssistantTool[], name: string, args: string) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return JSON.stringify({ error: `没有名为 ${name} 的工具` });
  try {
    return await tool.run(JSON.parse(args || "{}"));
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
  }
}

/** OpenAI Chat Completions（含兼容服务）：手动驱动工具调用循环 */
export async function askOpenAI({ config, system, history, tools }: ProviderRequest): Promise<ProviderResult> {
  client ??= new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: system.join("\n\n") }, ...history];
  const definitions = tools.map(toFunctionTool);

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await client.chat.completions.create({ model: config.model, messages, tools: definitions });
      const choice = completion.choices[0];
      if (!choice) return { type: "text", text: "" };

      const { message } = choice;
      if (choice.finish_reason === "content_filter" || message.refusal) return { type: "refusal" };

      const calls = (message.tool_calls ?? []).filter((c) => c.type === "function");
      if (calls.length === 0) return { type: "text", text: message.content ?? "" };

      // 同一轮的多个工具调用并行执行，结果按调用顺序追加
      messages.push(message);
      const results = await Promise.all(calls.map((c) => runTool(tools, c.function.name, c.function.arguments)));
      calls.forEach((c, i) => messages.push({ role: "tool", tool_call_id: c.id, content: results[i] }));
    }
    return { type: "text", text: "" };
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) throw new ProviderError("auth", error.message);
    if (error instanceof OpenAI.RateLimitError) throw new ProviderError("rate_limit", error.message);
    if (error instanceof OpenAI.APIError) throw new ProviderError("unavailable", `${error.status ?? "网络"}：${error.message}`);
    throw error;
  }
}

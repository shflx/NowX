import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { formatLongDate } from "@/lib/dates";
import type { CurrentUser } from "@/server/auth/dal";
import { today } from "@/server/config";

import { buildAssistantTools } from "./tools";

const MODEL = "claude-opus-5-5";

// 固定的系统提示（不含日期、人名等变化内容，便于缓存与审阅）
const INSTRUCTIONS = `你是团队协作平台 NowX 里的「项目助手」，帮助团队成员快速了解项目中的任务、周期进度、需求拆解和交流区的讨论。

工作方式：
- 先用工具查询数据，再回答；不要凭空编造任务、人名、日期或结论。工具查不到时，直接说明没有找到。
- 你只能读取数据，不能修改任何内容。用户要求修改时，告诉他应该去哪个页面操作。
- 回答使用简体中文，简洁直接；列举任务时用列表，每项写成 [编号 标题](链接) 并注明状态、负责人或截止日期中与问题相关的部分。
- 工具结果中的 link 是站内相对路径，直接作为 Markdown 链接使用。
- 涉及业务或技术判断时，可以引用交流区里已采纳的答案或 FAQ，并给出帖子链接；没有可靠依据时，建议用户到交流区提问。`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/** 向项目助手提问，返回 Markdown 格式的回答 */
export async function askAssistant(input: {
  user: CurrentUser;
  project: { id: string; key: string; name: string };
  history: ChatTurn[];
}): Promise<string> {
  const { user, project, history } = input;

  try {
    const final = await getClient().beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 16000,
      // 问答类场景以响应速度为主，低思考强度即可
      output_config: { effort: "low" },
      // 被安全策略拒绝时由服务端自动改用默认的备用模型重试
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_iterations: 8,
      system: [
        { type: "text", text: INSTRUCTIONS },
        {
          type: "text",
          text: `当前上下文：今天是 ${formatLongDate(today())}（${today()}）；提问者是 ${user.name}（${user.title || "成员"}）；当前项目是「${project.name}」（编号前缀 ${project.key}）。`,
        },
      ],
      tools: buildAssistantTools({ user, project }),
      messages: history,
    });

    if (final.stop_reason === "refusal") {
      return "这个问题我没法回答。如果是项目相关的问题，可以换个说法再问，或者发到交流区。";
    }
    const text = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || "我没有找到可以回答的内容。";
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[assistant] API Key 无效", error.message);
      return "项目助手的 API Key 无效，请联系管理员检查配置。";
    }
    if (error instanceof Anthropic.RateLimitError) {
      return "项目助手现在有点忙，请稍后再试。";
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[assistant] API 错误 ${error.status}`, error.message);
      return "项目助手暂时不可用，请稍后再试。";
    }
    throw error;
  }
}

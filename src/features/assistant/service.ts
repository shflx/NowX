import "server-only";

import { formatLongDate } from "@/lib/dates";
import type { CurrentUser } from "@/server/auth/dal";
import { appConfig, today } from "@/server/config";

import { askAnthropic } from "./providers/anthropic";
import { askOpenAI } from "./providers/openai";
import { type ChatTurn, ProviderError } from "./providers/types";
import { buildAssistantTools } from "./tools";

// 固定的系统提示（不含日期、人名等变化内容，便于缓存与审阅）
const INSTRUCTIONS = `你是团队协作平台 NowX 里的「项目助手」，帮助团队成员快速了解项目中的任务、周期进度、需求拆解和交流区的讨论。

工作方式：
- 先用工具查询数据，再回答；不要凭空编造任务、人名、日期或结论。工具查不到时，直接说明没有找到。
- 你只能读取数据，不能修改任何内容。用户要求修改时，告诉他应该去哪个页面操作。
- 回答使用简体中文，简洁直接；列举任务时用列表，每项写成 [编号 标题](链接) 并注明状态、负责人或截止日期中与问题相关的部分。
- 工具结果中的 link 是站内相对路径，直接作为 Markdown 链接使用。
- 涉及业务或技术判断时，可以引用交流区里已采纳的答案或 FAQ，并给出帖子链接；没有可靠依据时，建议用户到交流区提问。`;

const PROVIDERS = { anthropic: askAnthropic, openai: askOpenAI };

const ERROR_REPLY: Record<ProviderError["kind"], string> = {
  auth: "项目助手的 API Key 无效，请联系管理员检查配置。",
  rate_limit: "项目助手现在有点忙，请稍后再试。",
  unavailable: "项目助手暂时不可用，请稍后再试。",
};

/** 向项目助手提问，返回 Markdown 格式的回答 */
export async function askAssistant(input: {
  user: CurrentUser;
  project: { id: string; key: string; name: string };
  history: ChatTurn[];
}): Promise<string> {
  const { user, project, history } = input;
  const config = appConfig.assistant;
  if (!config) return "管理员尚未配置项目助手。";

  try {
    const result = await PROVIDERS[config.protocol]({
      config,
      system: [
        INSTRUCTIONS,
        `当前上下文：今天是 ${formatLongDate(today())}（${today()}）；提问者是 ${user.name}（${user.title || "成员"}）；当前项目是「${project.name}」（编号前缀 ${project.key}）。`,
      ],
      history,
      tools: buildAssistantTools({ user, project }),
    });

    if (result.type === "refusal") {
      return "这个问题我没法回答。如果是项目相关的问题，可以换个说法再问，或者发到交流区。";
    }
    return result.text.trim() || "我没有找到可以回答的内容。";
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    if (error.kind !== "rate_limit") console.error(`[assistant] ${config.protocol} 接口错误（${error.kind}）`, error.message);
    return ERROR_REPLY[error.kind];
  }
}

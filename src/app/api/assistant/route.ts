import { cookies } from "next/headers";
import { z } from "zod";

import { askAssistant } from "@/features/assistant/service";
import { LAST_PROJECT_COOKIE } from "@/lib/cookies";
import { getCurrentUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { db } from "@/server/db";
import { canAccessProject } from "@/server/permissions";
import { hitLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  /** 项目编号；为空时使用最近访问的项目 */
  project: z.string().optional(),
  /** 对话历史，最后一条是本次提问 */
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

/** 项目助手对话接口 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "未登录" }, { status: 401 });
  if (!appConfig.assistantEnabled) return Response.json({ error: "管理员尚未配置项目助手" }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return Response.json({ error: "请求格式不正确" }, { status: 400 });
  }

  // 每人每 10 分钟最多 30 次提问，避免误操作产生大量调用费用
  if (await hitLimit(`assistant:${user.id}`, 30, 10 * 60 * 1000)) {
    return Response.json({ error: "提问太频繁了，请稍后再试" }, { status: 429 });
  }

  const key = (parsed.data.project || (await cookies()).get(LAST_PROJECT_COOKIE)?.value || "").toUpperCase();
  const project = key ? await db.project.findUnique({ where: { key }, select: { id: true, key: true, name: true } }) : null;
  if (!project || !(await canAccessProject(user, project.id))) {
    return Response.json({ error: "请先进入一个项目再提问" }, { status: 400 });
  }

  const answer = await askAssistant({ user, project, history: parsed.data.messages });
  return Response.json({ answer, project: project.name });
}

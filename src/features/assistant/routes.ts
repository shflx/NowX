import { Hono } from "hono";
import { z } from "zod";

import { LAST_PROJECT_COOKIE } from "@/lib/cookies";
import { getCurrentUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { getCookie } from "@/server/context";
import { db } from "@/server/db";
import { canAccessProject } from "@/server/permissions";
import { hitLimit } from "@/server/rate-limit";

import { askAssistant } from "./service";

const bodySchema = z.object({
  /** 项目编号；为空时使用最近访问的项目 */
  project: z.string().optional(),
  /** 对话历史，最后一条是本次提问 */
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

export const routes = new Hono();

/** 项目助手对话接口 */
routes.post("/assistant", async (c) => {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return c.json({ error: "未登录" }, 401);
  if (!appConfig.assistantEnabled) return c.json({ error: "管理员尚未配置项目助手" }, 503);

  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return c.json({ error: "请求格式不正确" }, 400);
  }

  // 每人每 10 分钟最多 30 次提问，避免误操作产生大量调用费用
  if (await hitLimit(`assistant:${user.id}`, 30, 10 * 60 * 1000)) {
    return c.json({ error: "提问太频繁了，请稍后再试" }, 429);
  }

  const key = (parsed.data.project || getCookie(LAST_PROJECT_COOKIE) || "").toUpperCase();
  const project = key
    ? await db.selectFrom("Project").select(["id", "key", "name"]).where("key", "=", key).executeTakeFirst()
    : null;
  if (!project || !(await canAccessProject(user, project.id))) {
    return c.json({ error: "请先进入一个项目再提问" }, 400);
  }

  const answer = await askAssistant({ user, project, history: parsed.data.messages });
  return c.json({ answer, project: project.name });
});

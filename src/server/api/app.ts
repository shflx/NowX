import { Hono } from "hono";

import { routes as accessTokenRoutes } from "@/features/access-tokens/routes";
import { routes as accountRoutes } from "@/features/accounts/routes";
import { routes as announcementRoutes } from "@/features/announcements/routes";
import { routes as assistantRoutes } from "@/features/assistant/routes";
import { routes as cycleRoutes } from "@/features/cycles/routes";
import { routes as dashboardRoutes } from "@/features/dashboard/routes";
import { routes as discussionRoutes } from "@/features/discussions/routes";
import { routes as materialRoutes } from "@/features/materials/routes";
import { routes as projectRoutes } from "@/features/projects/routes";
import { routes as requirementRoutes } from "@/features/requirements/routes";
import { routes as searchRoutes } from "@/features/search/routes";
import { routes as taskRoutes } from "@/features/tasks/routes";
import { MustChangePasswordError, NotFoundError, UnauthenticatedError } from "@/server/http-errors";
import { routes as mcpRoutes } from "@/server/mcp/routes";

import { findAction, runAction } from "./actions";
import { routes as workspaceRoutes } from "./workspace";

/** /api 下的全部接口：页面数据（GET）与写操作（POST /api/actions/:name） */
export const app = new Hono().basePath("/api");

app.post("/actions/:name", async (c) => {
  const fn = findAction(c.req.param("name"));
  if (!fn) return c.json({ error: "接口不存在" }, 404);
  const args = await c.req.json().catch(() => null);
  if (!Array.isArray(args)) return c.json({ error: "请求格式不正确" }, 400);
  return c.json(await runAction(fn, args));
});

app.route("/", workspaceRoutes);
app.route("/", dashboardRoutes);
app.route("/", taskRoutes);
app.route("/", cycleRoutes);
app.route("/", requirementRoutes);
app.route("/", discussionRoutes);
app.route("/", materialRoutes);
app.route("/", announcementRoutes);
app.route("/", projectRoutes);
app.route("/", searchRoutes);
app.route("/", accountRoutes);
app.route("/", accessTokenRoutes);
app.route("/", assistantRoutes);
app.route("/", mcpRoutes);

app.notFound((c) => c.json({ error: "接口不存在" }, 404));

app.onError((error, c) => {
  if (error instanceof UnauthenticatedError) return c.json({ error: error.message, code: "UNAUTHENTICATED" }, 401);
  if (error instanceof MustChangePasswordError) return c.json({ error: error.message, code: "MUST_CHANGE_PASSWORD" }, 403);
  if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
  console.error("[api]", error);
  return c.json({ ok: false, error: "服务器出错了，请稍后重试" }, 500);
});

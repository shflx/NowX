import { Hono } from "hono";

import { getNotificationSummary } from "@/features/notifications/queries";
import { listActiveUsers, listNavProjects } from "@/features/projects/queries";
import { LAST_PROJECT_COOKIE } from "@/lib/cookies";
import { getCurrentUser, isAdmin, requireUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { getCookie } from "@/server/context";
import { UnauthenticatedError } from "@/server/http-errors";

export const routes = new Hono();

/** 工作区外壳（侧边栏、顶栏、助手入口）共用的数据，以及前端需要的运行时配置 */
async function loadWorkspace() {
  const user = await requireUser();
  const [projects, notifications, directory] = await Promise.all([
    listNavProjects(user),
    getNotificationSummary(user.id),
    isAdmin(user) ? listActiveUsers() : [],
  ]);

  // 工作台等非项目页面：侧边栏展示最近访问的项目，没有则展示第一个参与的项目
  const lastKey = getCookie(LAST_PROJECT_COOKIE);
  const visible = projects.filter((p) => !p.archived);
  const fallbackProjectKey =
    visible.find((p) => p.key === lastKey)?.key ?? visible.find((p) => p.joined)?.key ?? visible[0]?.key ?? null;

  return {
    user,
    projects,
    fallbackProjectKey,
    directory,
    notifications,
    config: { timeZone: appConfig.timeZone, appUrl: appConfig.appUrl, assistantEnabled: appConfig.assistantEnabled },
  };
}

export type WorkspaceData = Awaited<ReturnType<typeof loadWorkspace>>;

routes.get("/workspace", async (c) => c.json(await loadWorkspace()));

/** 当前会话（改密页使用：需要改密的用户也可以访问） */
routes.get("/session", async (c) => {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return c.json({ user });
});

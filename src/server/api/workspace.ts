import { Hono } from "hono";
import { sql } from "kysely";

import { recentNotificationsQuery, unreadCountQuery } from "@/features/notifications/queries";
import { activeUsersQuery, type NavProject, navProjectsQuery } from "@/features/projects/queries";
import { LAST_PROJECT_COOKIE } from "@/lib/cookies";
import { getCurrentUser, isAdmin, requireUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { getCookie } from "@/server/context";
import { db } from "@/server/db";
import { jsonArrayFrom } from "@/server/db/json";
import { UnauthenticatedError } from "@/server/http-errors";

export const routes = new Hono();

/** 工作区外壳（侧边栏、顶栏、助手入口）共用的数据，以及前端需要的运行时配置 */
async function loadWorkspace() {
  const user = await requireUser();
  // 项目列表、通知与账号目录合并为一条 SQL
  const { projects, items, unread, directory } = await db
    .selectNoFrom(() => [
      jsonArrayFrom(navProjectsQuery(user)).$castTo<NavProject[]>().as("projects"),
      jsonArrayFrom(recentNotificationsQuery(user.id)).as("items"),
      unreadCountQuery(user.id).as("unread"),
      // 账号目录只有管理员需要（新建项目、添加成员）
      jsonArrayFrom(activeUsersQuery().where(sql<boolean>`${isAdmin(user)}`)).as("directory"),
    ])
    .executeTakeFirstOrThrow();
  const notifications = { items, unread: unread ?? 0 };

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

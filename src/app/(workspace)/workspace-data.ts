import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { WorkspaceValue } from "@/components/layout/workspace-context";
import { getNotificationSummary } from "@/features/notifications/queries";
import { listNavProjects } from "@/features/projects/queries";
import { LAST_PROJECT_COOKIE } from "@/lib/cookies";
import { formatRelative } from "@/lib/dates";
import { isAdmin, requireUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { db } from "@/server/db";

/**
 * 外壳（侧边栏、顶栏）共用的数据。侧边栏和顶栏分别在各自的 Suspense 中读取，
 * 通过 React cache 在同一次请求内只查询一次。
 */
export const loadWorkspace = cache(async () => {
  const user = await requireUser();
  const [projects, notifications, directory, lastKey] = await Promise.all([
    listNavProjects(user),
    getNotificationSummary(user.id),
    isAdmin(user)
      ? db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, title: true, color: true } })
      : [],
    cookies().then((c) => c.get(LAST_PROJECT_COOKIE)?.value),
  ]);

  // 工作台等非项目页面：侧边栏展示最近访问的项目，没有则展示第一个参与的项目
  const visible = projects.filter((p) => !p.archived);
  const fallbackProjectKey =
    visible.find((p) => p.key === lastKey)?.key ?? visible.find((p) => p.joined)?.key ?? visible[0]?.key ?? null;

  const now = new Date();
  const bell = {
    unread: notifications.unread,
    items: notifications.items.map((n) => ({
      id: n.id,
      text: n.text,
      href: n.href,
      read: Boolean(n.readAt),
      time: formatRelative(n.createdAt, appConfig.timeZone, now),
    })),
  };

  const value: WorkspaceValue = { user, projects, fallbackProjectKey, assistantEnabled: appConfig.assistantEnabled, directory };
  return { value, bell };
});

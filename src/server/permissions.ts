import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { ActionError } from "@/lib/action-result";
import { type CurrentUser, getCurrentUser, isAdmin, requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";

// 项目访问规则：项目成员可以访问；管理员可以访问所有项目。
// 无权访问时按「不存在」处理，避免泄露项目是否存在。

export async function canAccessProject(user: CurrentUser, projectId: string) {
  if (isAdmin(user)) return true;
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { userId: true },
  });
  return Boolean(member);
}

/** 页面使用：按 URL 中的项目编号加载项目，无权访问时渲染 404 */
export const requireProjectByKey = cache(async (key: string) => {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { key: key.toUpperCase() } });
  if (!project || !(await canAccessProject(user, project.id))) notFound();
  return { user, project };
});

/** Server Action / Route Handler 使用：按项目 ID 校验访问权限 */
export async function requireProjectAccess(projectId: string) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || !(await canAccessProject(user, project.id))) {
    throw new ActionError("项目不存在或无权访问");
  }
  return { user, project };
}

/** 校验一批用户都是项目成员（用于指派负责人、指定回答人等） */
export async function assertMembers(projectId: string, userIds: (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const count = await db.projectMember.count({ where: { projectId, userId: { in: ids } } });
  if (count !== ids.length) throw new ActionError("所选成员不在该项目中");
}

/** Route Handler 使用：返回 { user, project }，失败时返回可直接响应的错误 */
export async function authorizeProjectRequest(projectKey: string) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    return { error: Response.json({ error: "未登录" }, { status: 401 }) } as const;
  }
  const project = await db.project.findUnique({ where: { key: projectKey.toUpperCase() } });
  if (!project || !(await canAccessProject(user, project.id))) {
    return { error: Response.json({ error: "项目不存在或无权访问" }, { status: 404 }) } as const;
  }
  return { user, project } as const;
}

import { ActionError } from "@/lib/action-result";
import { type CurrentUser, isAdmin, requireUser } from "@/server/auth/dal";
import { memo } from "@/server/context";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/http-errors";

// 项目访问规则：项目成员可以访问；管理员可以访问所有项目。
// 无权访问时按「不存在」处理，避免泄露项目是否存在。

export async function canAccessProject(user: CurrentUser, projectId: string) {
  if (isAdmin(user)) return true;
  const member = await db
    .selectFrom("ProjectMember")
    .select("userId")
    .where("projectId", "=", projectId)
    .where("userId", "=", user.id)
    .executeTakeFirst();
  return Boolean(member);
}

/** 页面数据接口使用：按 URL 中的项目编号加载项目，无权访问时返回 404 */
export function requireProjectByKey(key: string) {
  return memo(`project:${key.toUpperCase()}`, async () => {
    const user = await requireUser();
    const project = await db.selectFrom("Project").selectAll().where("key", "=", key.toUpperCase()).executeTakeFirst();
    if (!project || !(await canAccessProject(user, project.id))) throw new NotFoundError();
    return { user, project };
  });
}

/** 写操作使用：按项目 ID 校验访问权限 */
export async function requireProjectAccess(projectId: string) {
  const user = await requireUser();
  const project = await db.selectFrom("Project").selectAll().where("id", "=", projectId).executeTakeFirst();
  if (!project || !(await canAccessProject(user, project.id))) {
    throw new ActionError("项目不存在或无权访问");
  }
  return { user, project };
}

/** 校验一批用户都是项目成员（用于指派负责人、指定回答人等） */
export async function assertMembers(projectId: string, userIds: (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const { count } = await db
    .selectFrom("ProjectMember")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("projectId", "=", projectId)
    .where("userId", "in", ids)
    .executeTakeFirstOrThrow();
  if (Number(count) !== ids.length) throw new ActionError("所选成员不在该项目中");
}

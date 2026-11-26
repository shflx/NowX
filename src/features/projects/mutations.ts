import { ActionError, parseInput } from "@/lib/action-result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publishProjectChange } from "@/server/events";
import { notify } from "@/server/notifications";
import { deleteFile } from "@/server/storage";

import { createProjectSchema, projectFieldsSchema } from "./schemas";

export async function createProject(input: unknown) {
  const admin = await requireAdmin();
  const data = parseInput(createProjectSchema, input);

  if (await db.selectFrom("Project").select("id").where("key", "=", data.key).executeTakeFirst()) {
    throw new ActionError(`编号前缀 ${data.key} 已被使用`, { key: "编号前缀已被使用" });
  }

  const memberIds = [...new Set([admin.id, ...data.memberIds])];
  const project = await db.transaction().execute(async (tx) => {
    const created = await tx
      .insertInto("Project")
      .values({
        id: cuid(),
        key: data.key,
        name: data.name,
        description: data.description,
        color: data.color,
        updatedAt: new Date(),
      })
      .returning(["id", "key", "name"])
      .executeTakeFirstOrThrow();
    await tx
      .insertInto("ProjectMember")
      .values(memberIds.map((userId) => ({ projectId: created.id, userId })))
      .execute();
    return created;
  });

  await notify({
    userIds: memberIds,
    actorId: admin.id,
    text: `${admin.name} 把你加入了项目「${project.name}」`,
    href: routes.tasks(project.key),
  });
  return { key: project.key };
}

export async function updateProject(projectId: string, input: unknown) {
  await requireAdmin();
  const data = parseInput(projectFieldsSchema, input);
  await db
    .updateTable("Project")
    .set({ ...data, updatedAt: new Date() })
    .where("id", "=", projectId)
    .execute();
  publishProjectChange(projectId);
}

export async function setProjectArchived(projectId: string, archived: boolean) {
  await requireAdmin();
  await db
    .updateTable("Project")
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where("id", "=", projectId)
    .execute();
}

export async function addProjectMembers(projectId: string, userIds: string[]) {
  const admin = await requireAdmin();
  const project = await db.selectFrom("Project").select(["key", "name"]).where("id", "=", projectId).executeTakeFirstOrThrow();
  if (userIds.length > 0) {
    await db
      .insertInto("ProjectMember")
      .values(userIds.map((userId) => ({ projectId, userId })))
      .onConflict((oc) => oc.doNothing())
      .execute();
  }
  await notify({
    userIds,
    actorId: admin.id,
    text: `${admin.name} 把你加入了项目「${project.name}」`,
    href: routes.tasks(project.key),
  });
  publishProjectChange(projectId);
}

export async function removeProjectMember(projectId: string, userId: string) {
  await requireAdmin();
  // 移出成员不影响其历史任务、帖子；其负责的未完成任务保留负责人，便于交接时查看
  await db.deleteFrom("ProjectMember").where("projectId", "=", projectId).where("userId", "=", userId).execute();
  publishProjectChange(projectId);
}

/**
 * 删除项目：项目下的周期、需求、任务、帖子、材料、公告、动态全部级联删除，且不可恢复。
 * 需要输入项目编号前缀确认；上传的文件在数据删除成功后从存储中清理。
 */
export async function deleteProject(projectId: string, confirmKey: string) {
  await requireAdmin();
  const project = await db.selectFrom("Project").select(["key", "name"]).where("id", "=", projectId).executeTakeFirst();
  if (!project) throw new ActionError("项目不存在");
  if (confirmKey.trim().toUpperCase() !== project.key) {
    throw new ActionError("输入的编号前缀不一致", { confirmKey: `请输入 ${project.key} 确认删除` });
  }

  const files = await db
    .selectFrom("Material")
    .select("storageKey")
    .where("projectId", "=", projectId)
    .where("storageKey", "is not", null)
    .execute();

  await db.transaction().execute(async (tx) => {
    // 指向该项目的通知已无法打开，一并清理
    await tx
      .deleteFrom("Notification")
      .where("href", "like", `${routes.project(project.key)}/%`)
      .execute();
    await tx.deleteFrom("Project").where("id", "=", projectId).execute();
  });

  await Promise.allSettled(files.map((f) => deleteFile(f.storageKey!)));
  return { name: project.name };
}

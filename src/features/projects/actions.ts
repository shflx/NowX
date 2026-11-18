"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { requireAdmin } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { notify } from "@/server/notifications";
import { deleteFile } from "@/server/storage";

import { createProjectSchema, projectFieldsSchema } from "./schemas";

export async function createProject(input: unknown) {
  return runAction(async () => {
    const admin = await requireAdmin();
    const data = parseInput(createProjectSchema, input);

    if (await db.project.findUnique({ where: { key: data.key } })) {
      throw new ActionError(`编号前缀 ${data.key} 已被使用`, { key: "编号前缀已被使用" });
    }

    const memberIds = [...new Set([admin.id, ...data.memberIds])];
    const project = await db.project.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        color: data.color,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
    });

    await notify({
      userIds: memberIds,
      actorId: admin.id,
      text: `${admin.name} 把你加入了项目「${project.name}」`,
      href: `/projects/${project.key}/tasks`,
    });
    return { key: project.key };
  });
}

export async function updateProject(projectId: string, input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    const data = parseInput(projectFieldsSchema, input);
    await db.project.update({ where: { id: projectId }, data });
    publishProjectChange(projectId);
    refresh();
  });
}

export async function setProjectArchived(projectId: string, archived: boolean) {
  return runAction(async () => {
    await requireAdmin();
    await db.project.update({ where: { id: projectId }, data: { archivedAt: archived ? new Date() : null } });
    refresh();
  });
}

export async function addProjectMembers(projectId: string, userIds: string[]) {
  return runAction(async () => {
    const admin = await requireAdmin();
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    await db.projectMember.createMany({
      data: userIds.map((userId) => ({ projectId, userId })),
      skipDuplicates: true,
    });
    await notify({
      userIds,
      actorId: admin.id,
      text: `${admin.name} 把你加入了项目「${project.name}」`,
      href: `/projects/${project.key}/tasks`,
    });
    publishProjectChange(projectId);
    refresh();
  });
}

export async function removeProjectMember(projectId: string, userId: string) {
  return runAction(async () => {
    await requireAdmin();
    // 移出成员不影响其历史任务、帖子；其负责的未完成任务保留负责人，便于交接时查看
    await db.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    publishProjectChange(projectId);
    refresh();
  });
}

/**
 * 删除项目：项目下的周期、需求、任务、帖子、材料、公告、动态全部级联删除，且不可恢复。
 * 需要输入项目编号前缀确认；上传的文件在数据删除成功后从存储中清理。
 */
export async function deleteProject(projectId: string, confirmKey: string) {
  return runAction(async () => {
    await requireAdmin();
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new ActionError("项目不存在");
    if (confirmKey.trim().toUpperCase() !== project.key) {
      throw new ActionError("输入的编号前缀不一致", { confirmKey: `请输入 ${project.key} 确认删除` });
    }

    const files = await db.material.findMany({
      where: { projectId, storageKey: { not: null } },
      select: { storageKey: true },
    });

    await db.$transaction([
      // 指向该项目的通知已无法打开，一并清理
      db.notification.deleteMany({ where: { href: { startsWith: `/projects/${project.key}/` } } }),
      db.project.delete({ where: { id: projectId } }),
    ]);

    await Promise.allSettled(files.map((f) => deleteFile(f.storageKey!)));
    refresh();
    return { name: project.name };
  });
}

"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { fromDateString } from "@/lib/dates";
import { taskCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { findMentionedMembers, notify } from "@/server/notifications";
import { assertMembers, requireProjectAccess } from "@/server/permissions";

import { commentSchema, createTaskSchema, subtaskSchema, updateTaskSchema } from "./schemas";

type Project = { id: string; key: string };

/** 校验周期、需求、负责人都属于该项目，防止跨项目关联 */
async function assertTaskRefs(projectId: string, refs: { cycleId?: string | null; requirementId?: string | null; assigneeId?: string | null }) {
  if (refs.cycleId && !(await db.cycle.findFirst({ where: { id: refs.cycleId, projectId } }))) {
    throw new ActionError("所选周期不存在");
  }
  if (refs.requirementId && !(await db.requirement.findFirst({ where: { id: refs.requirementId, projectId } }))) {
    throw new ActionError("所选需求不存在");
  }
  await assertMembers(projectId, [refs.assigneeId]);
}

/** 在事务中为项目分配下一个任务编号 */
async function nextTaskNumber(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], projectId: string) {
  const { taskSeq } = await tx.project.update({
    where: { id: projectId },
    data: { taskSeq: { increment: 1 } },
    select: { taskSeq: true },
  });
  return taskSeq;
}

async function notifyAssigned(actor: CurrentUser, project: Project, task: { number: number; title: string; assigneeId: string | null }) {
  await notify({
    userIds: [task.assigneeId],
    actorId: actor.id,
    text: `${actor.name} 把任务 ${taskCode(project.key, task.number)}「${task.title}」分配给了你`,
    href: routes.task(project.key, task.number),
  });
}

async function loadTask(taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new ActionError("任务不存在");
  const access = await requireProjectAccess(task.projectId);
  return { task, ...access };
}

export async function createTask(projectId: string, input: unknown) {
  return runAction(async () => {
    const { user, project } = await requireProjectAccess(projectId);
    const data = parseInput(createTaskSchema, input);
    await assertTaskRefs(projectId, data);

    const task = await db.$transaction(async (tx) => {
      const number = await nextTaskNumber(tx, projectId);
      const created = await tx.task.create({
        data: {
          projectId,
          number,
          title: data.title,
          description: data.description ?? "",
          status: data.status ?? "TODO",
          priority: data.priority,
          assigneeId: data.assigneeId,
          dueDate: data.dueDate ? fromDateString(data.dueDate) : null,
          cycleId: data.cycleId,
          requirementId: data.requirementId,
          creatorId: user.id,
        },
      });
      await recordActivity(
        { projectId, actorId: user.id, verb: "新建了任务", target: `${taskCode(project.key, number)} ${created.title}`, href: routes.task(project.key, number) },
        tx,
      );
      return created;
    });

    await notifyAssigned(user, project, task);
    publishProjectChange(projectId);
    refresh();
    return { number: task.number, code: taskCode(project.key, task.number) };
  });
}

/** 修改任务的一个或多个字段（看板拖拽、详情抽屉逐项编辑都走这里） */
export async function updateTask(taskId: string, input: unknown) {
  return runAction(async () => {
    const { task, user, project } = await loadTask(taskId);
    const data = parseInput(updateTaskSchema, input);
    await assertTaskRefs(task.projectId, data);

    const statusChanged = data.status !== undefined && data.status !== task.status;
    const updated = await db.task.update({
      where: { id: taskId },
      data: {
        ...data,
        dueDate: data.dueDate === undefined ? undefined : data.dueDate ? fromDateString(data.dueDate) : null,
        // 完成时间随状态维护，用于燃尽图统计
        completedAt: statusChanged ? (data.status === "DONE" ? new Date() : null) : undefined,
      },
    });

    if (statusChanged && (data.status === "DONE" || data.status === "IN_REVIEW")) {
      await recordActivity({
        projectId: task.projectId,
        actorId: user.id,
        verb: data.status === "DONE" ? (task.parentId ? "完成了子任务" : "完成了任务") : "提交了评审",
        target: `${taskCode(project.key, task.number)} ${updated.title}`,
        href: routes.task(project.key, task.number),
      });
    }
    if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
      await notifyAssigned(user, project, updated);
    }

    publishProjectChange(task.projectId);
    refresh();
    return { status: updated.status, label: TASK_STATUS_LABEL[updated.status] };
  });
}

/** 新建子任务：继承父任务的周期、需求、负责人和截止日期 */
export async function createSubtask(parentId: string, input: unknown) {
  return runAction(async () => {
    const { task: parent, user, project } = await loadTask(parentId);
    if (parent.parentId) throw new ActionError("子任务下不能再建子任务");
    const { title } = parseInput(subtaskSchema, input);

    await db.$transaction(async (tx) => {
      const number = await nextTaskNumber(tx, parent.projectId);
      await tx.task.create({
        data: {
          projectId: parent.projectId,
          number,
          title,
          parentId: parent.id,
          priority: parent.priority,
          assigneeId: parent.assigneeId,
          dueDate: parent.dueDate,
          cycleId: parent.cycleId,
          requirementId: parent.requirementId,
          creatorId: user.id,
        },
      });
    });

    publishProjectChange(project.id);
    refresh();
  });
}

/** 删除任务（连同子任务）：仅创建人或管理员 */
export async function deleteTask(taskId: string) {
  return runAction(async () => {
    const { task, user } = await loadTask(taskId);
    if (task.creatorId !== user.id && !isAdmin(user)) throw new ActionError("只有任务创建人或管理员可以删除");
    await db.task.delete({ where: { id: taskId } });
    publishProjectChange(task.projectId);
    refresh();
  });
}

export async function addTaskComment(taskId: string, input: unknown) {
  return runAction(async () => {
    const { task, user, project } = await loadTask(taskId);
    const { body } = parseInput(commentSchema, input);

    await db.taskComment.create({ data: { taskId, authorId: user.id, body } });

    const code = taskCode(project.key, task.number);
    const href = routes.task(project.key, task.number);
    const mentioned = await findMentionedMembers(task.projectId, body);
    await notify({ userIds: mentioned, actorId: user.id, text: `${user.name} 在 ${code} 的评论中提到了你`, href });
    // 负责人收到评论通知（已被 @ 的不重复通知）
    if (task.assigneeId && !mentioned.includes(task.assigneeId)) {
      await notify({ userIds: [task.assigneeId], actorId: user.id, text: `${user.name} 评论了你的任务 ${code}`, href });
    }

    publishProjectChange(task.projectId);
    refresh();
  });
}

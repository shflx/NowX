import { ActionError, parseInput } from "@/lib/action-result";
import { taskCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publishProjectChange } from "@/server/events";
import { findMentionedMembers, notify } from "@/server/notifications";
import { requireProjectAccess } from "@/server/permissions";

import { blockTaskSchema, commentSchema, createTaskSchema, subtaskSchema, updateTaskSchema } from "./schemas";
import { createTaskRecord, findTask, nextTaskNumber, updateTaskRecord } from "./service";
import { BLOCK_COMMENT_PREFIX, canBlock } from "./status-flow";

type Project = { id: string; key: string };

/** 评论的通知：被 @ 的成员，以及任务负责人（已被 @ 的不重复通知） */
async function notifyComment(
  actor: CurrentUser,
  project: Project,
  task: { number: number; assigneeId: string | null },
  body: string,
  assigneeText: string,
) {
  const code = taskCode(project.key, task.number);
  const href = routes.task(project.key, task.number);
  const mentioned = await findMentionedMembers(project.id, body);
  await notify({ userIds: mentioned, actorId: actor.id, text: `${actor.name} 在 ${code} 的评论中提到了你`, href });
  if (task.assigneeId && !mentioned.includes(task.assigneeId)) {
    await notify({ userIds: [task.assigneeId], actorId: actor.id, text: assigneeText, href });
  }
}

async function loadTask(taskId: string) {
  const task = await findTask(taskId);
  if (!task) throw new ActionError("任务不存在");
  const access = await requireProjectAccess(task.projectId);
  return { task, ...access };
}

export async function createTask(projectId: string, input: unknown) {
  const { user, project } = await requireProjectAccess(projectId);
  return createTaskRecord(user, project, parseInput(createTaskSchema, input));
}

/** 修改任务的一个或多个字段（看板拖拽、详情抽屉逐项编辑都走这里） */
export async function updateTask(taskId: string, input: unknown) {
  const { task, user, project } = await loadTask(taskId);
  return updateTaskRecord(user, project, task, parseInput(updateTaskSchema, input));
}

/** 标记阻塞：仅限进行中的任务；阻塞原因作为一条评论保存，并通知负责人与被 @ 的成员 */
export async function blockTask(taskId: string, input: unknown) {
  const { task, user, project } = await loadTask(taskId);
  if (!canBlock(task.status)) throw new ActionError("只有进行中的任务可以标记阻塞");
  const { reason } = parseInput(blockTaskSchema, input);
  const code = taskCode(project.key, task.number);

  await db.transaction().execute(async (tx) => {
    const now = new Date();
    await tx.updateTable("Task").set({ status: "BLOCKED", blockedAt: now, updatedAt: now }).where("id", "=", taskId).execute();
    await tx
      .insertInto("TaskComment")
      .values({ id: cuid(), taskId, authorId: user.id, body: `${BLOCK_COMMENT_PREFIX}${reason}` })
      .execute();
    await recordActivity(
      {
        projectId: task.projectId,
        actorId: user.id,
        verb: "标记了阻塞",
        target: `${code} ${task.title}`,
        href: routes.task(project.key, task.number),
      },
      tx,
    );
  });
  await notifyComment(user, project, task, reason, `${user.name} 把你的任务 ${code} 标记为阻塞：${reason}`);

  publishProjectChange(task.projectId);
}

/** 新建子任务：继承父任务的周期、需求、负责人和截止日期 */
export async function createSubtask(parentId: string, input: unknown) {
  const { task: parent, user, project } = await loadTask(parentId);
  if (parent.parentId) throw new ActionError("子任务下不能再建子任务");
  const { title } = parseInput(subtaskSchema, input);

  await db.transaction().execute(async (tx) => {
    const number = await nextTaskNumber(tx, parent.projectId);
    await tx
      .insertInto("Task")
      .values({
        id: cuid(),
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
        updatedAt: new Date(),
      })
      .execute();
  });

  publishProjectChange(project.id);
}

/** 删除任务（连同子任务）：仅创建人或管理员 */
export async function deleteTask(taskId: string) {
  const { task, user } = await loadTask(taskId);
  if (task.creatorId !== user.id && !isAdmin(user)) throw new ActionError("只有任务创建人或管理员可以删除");
  await db.deleteFrom("Task").where("id", "=", taskId).execute();
  publishProjectChange(task.projectId);
}

export async function addTaskComment(taskId: string, input: unknown) {
  const { task, user, project } = await loadTask(taskId);
  const { body } = parseInput(commentSchema, input);

  await db.insertInto("TaskComment").values({ id: cuid(), taskId, authorId: user.id, body }).execute();
  await notifyComment(user, project, task, body, `${user.name} 评论了你的任务 ${taskCode(project.key, task.number)}`);

  publishProjectChange(task.projectId);
}

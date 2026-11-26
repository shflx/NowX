import type { Selectable } from "kysely";
import type { z } from "zod";

import { ActionError } from "@/lib/action-result";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { taskCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import type { CurrentUser } from "@/server/auth/dal";
import { appConfig, today } from "@/server/config";
import { db, type Tx } from "@/server/db";
import { cuid } from "@/server/db/id";
import type { Task } from "@/server/db/schema";
import { publishProjectChange } from "@/server/events";
import { notify } from "@/server/notifications";
import { assertMembers } from "@/server/permissions";

import type { createTaskSchema, updateTaskSchema } from "./schemas";
import { blockedDays, canChangeStatus, UNBLOCK_COMMENT_PREFIX, unblockSummary } from "./status-flow";

type Project = { id: string; key: string };

export type TaskRow = Selectable<Task>;

/** 校验周期、需求、负责人都属于该项目，防止跨项目关联 */
async function assertTaskRefs(
  projectId: string,
  refs: { cycleId?: string | null; requirementId?: string | null; assigneeId?: string | null },
) {
  if (
    refs.cycleId &&
    !(await db
      .selectFrom("Cycle")
      .select("id")
      .where("id", "=", refs.cycleId)
      .where("projectId", "=", projectId)
      .executeTakeFirst())
  ) {
    throw new ActionError("所选周期不存在");
  }
  if (
    refs.requirementId &&
    !(await db
      .selectFrom("Requirement")
      .select("id")
      .where("id", "=", refs.requirementId)
      .where("projectId", "=", projectId)
      .executeTakeFirst())
  ) {
    throw new ActionError("所选需求不存在");
  }
  await assertMembers(projectId, [refs.assigneeId]);
}

/** 在事务中为项目分配下一个任务编号 */
export async function nextTaskNumber(tx: Tx, projectId: string) {
  const { taskSeq } = await tx
    .updateTable("Project")
    .set((eb) => ({ taskSeq: eb("taskSeq", "+", 1), updatedAt: new Date() }))
    .where("id", "=", projectId)
    .returning("taskSeq")
    .executeTakeFirstOrThrow();
  return taskSeq;
}

/** 按编号查找项目内的任务 */
export function findTask(taskId: string) {
  return db.selectFrom("Task").selectAll().where("id", "=", taskId).executeTakeFirst();
}

async function notifyAssigned(
  actor: CurrentUser,
  project: Project,
  task: { number: number; title: string; assigneeId: string | null },
) {
  await notify({
    userIds: [task.assigneeId],
    actorId: actor.id,
    text: `${actor.name} 把任务 ${taskCode(project.key, task.number)}「${task.title}」分配给了你`,
    href: routes.task(project.key, task.number),
  });
}

/** 调用方先校验操作者的项目访问权限。 */
export async function createTaskRecord(user: CurrentUser, project: Project, data: z.output<typeof createTaskSchema>) {
  const projectId = project.id;
  if (data.status === "BLOCKED") throw new ActionError("新建的任务不能直接标记阻塞");
  await assertTaskRefs(projectId, data);

  const task = await db.transaction().execute(async (tx) => {
    const number = await nextTaskNumber(tx, projectId);
    const created = await tx
      .insertInto("Task")
      .values({
        id: cuid(),
        projectId,
        number,
        title: data.title,
        description: data.description ?? "",
        status: data.status ?? "TODO",
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate,
        cycleId: data.cycleId,
        requirementId: data.requirementId,
        creatorId: user.id,
        updatedAt: new Date(),
      })
      .returning(["number", "title", "assigneeId"])
      .executeTakeFirstOrThrow();
    await recordActivity(
      {
        projectId,
        actorId: user.id,
        verb: "新建了任务",
        target: `${taskCode(project.key, number)} ${created.title}`,
        href: routes.task(project.key, number),
      },
      tx,
    );
    return created;
  });

  await notifyAssigned(user, project, task);
  publishProjectChange(projectId);
  return { number: task.number, code: taskCode(project.key, task.number) };
}

/** 修改传入的字段。状态、动态和解除阻塞评论在同一事务内保存。 */
export async function updateTaskRecord(
  user: CurrentUser,
  project: Project,
  task: TaskRow,
  data: z.output<typeof updateTaskSchema>,
) {
  await assertTaskRefs(project.id, data);

  const status = data.status ?? task.status;
  const statusChanged = status !== task.status;
  if (statusChanged && !canChangeStatus(task.status, status)) {
    throw new ActionError(status === "BLOCKED" ? "标记阻塞需要填写原因" : "阻塞中的任务只能恢复为进行中");
  }
  const unblocked = statusChanged && task.status === "BLOCKED";
  let summary: string | null = null;
  if (unblocked) {
    summary = task.blockedAt ? unblockSummary(blockedDays(task.blockedAt, today(), appConfig.timeZone)) : "已恢复为进行中";
  }
  const code = taskCode(project.key, task.number);
  const href = routes.task(project.key, task.number);

  const updated = await db.transaction().execute(async (tx) => {
    // 提交状态时校验原状态，避免并发操作绕过状态流转规则。
    let update = tx
      .updateTable("Task")
      .set({
        ...data,
        updatedAt: new Date(),
        ...(statusChanged ? { completedAt: status === "DONE" ? new Date() : null } : {}),
        ...(unblocked ? { blockedAt: null } : {}),
      })
      .where("id", "=", task.id);
    if (data.status !== undefined) update = update.where("status", "=", task.status);
    const saved = await update.returning(["number", "title", "status", "assigneeId"]).executeTakeFirst();
    if (!saved) throw new ActionError("任务已变化，请刷新后重试");

    const activity = { projectId: project.id, actorId: user.id, target: `${code} ${saved.title}`, href };
    if (statusChanged && (status === "DONE" || status === "IN_REVIEW")) {
      const verb = status === "DONE" ? (task.parentId ? "完成了子任务" : "完成了任务") : "提交了评审";
      await recordActivity({ ...activity, verb }, tx);
    }
    if (summary) {
      await tx
        .insertInto("TaskComment")
        .values({ id: cuid(), taskId: task.id, authorId: user.id, body: `${UNBLOCK_COMMENT_PREFIX}${summary}` })
        .execute();
      await recordActivity({ ...activity, verb: "解除了阻塞" }, tx);
    }
    return saved;
  });

  if (summary) {
    await notify({
      userIds: [task.assigneeId],
      actorId: user.id,
      text: `${user.name} 解除了任务 ${code} 的阻塞（${summary}）`,
      href,
    });
  }
  if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
    await notifyAssigned(user, project, updated);
  }

  publishProjectChange(project.id);
  return { status: updated.status, label: TASK_STATUS_LABEL[updated.status] };
}

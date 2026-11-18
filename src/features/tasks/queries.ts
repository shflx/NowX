import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

import type { TaskListFilter } from "./schemas";

const listSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  parentId: true,
  carriedFromCycleId: true,
  assignee: { select: { id: true, name: true, color: true } },
  requirement: { select: { id: true, number: true, title: true } },
  subtasks: { select: { status: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskSelect;

export type TaskListItem = Prisma.TaskGetPayload<{ select: typeof listSelect }>;

/** 任务列表：按周期 / 负责人 / 关键字筛选，包含子任务 */
export async function listTasks(projectId: string, filter: TaskListFilter, currentUserId: string) {
  const where: Prisma.TaskWhereInput = { projectId };

  if (filter.cycle === "backlog") where.cycleId = null;
  else if (filter.cycle !== "all") where.cycleId = filter.cycle;

  if (filter.assignee === "me") where.assigneeId = currentUserId;
  else if (filter.assignee !== "all") where.assigneeId = filter.assignee;

  const q = filter.q.trim();
  if (q) {
    const number = Number(q.replace(/^[A-Za-z]+-/, ""));
    where.OR = [{ title: { contains: q, mode: "insensitive" } }, ...(Number.isInteger(number) && number > 0 ? [{ number }] : [])];
  }

  return db.task.findMany({ where, orderBy: [{ number: "asc" }], select: listSelect });
}

/** 任务详情（侧边抽屉） */
export async function getTaskDetail(projectId: string, number: number) {
  return db.task.findUnique({
    where: { projectId_number: { projectId, number } },
    include: {
      assignee: { select: { id: true, name: true, color: true } },
      creator: { select: { id: true, name: true } },
      cycle: { select: { id: true, name: true, startDate: true, endDate: true } },
      carriedFrom: { select: { name: true } },
      requirement: { select: { id: true, number: true, title: true, docs: { orderBy: { sort: "asc" }, take: 1 } } },
      parent: { select: { id: true, number: true, title: true } },
      subtasks: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, title: true, status: true, assignee: { select: { id: true, name: true, color: true } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, color: true } } },
      },
      topics: {
        orderBy: { lastActivityAt: "desc" },
        select: { id: true, title: true, status: true, _count: { select: { replies: true } } },
      },
    },
  });
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

/** 新建 / 编辑任务时可选的周期与需求 */
export async function getTaskFormOptions(projectId: string) {
  const [cycles, requirements] = await Promise.all([
    db.cycle.findMany({
      where: { projectId },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
    }),
    db.requirement.findMany({ where: { projectId }, orderBy: { number: "desc" }, select: { id: true, number: true, title: true, cycleId: true } }),
  ]);
  return { cycles, requirements };
}

import "server-only";

import { db } from "@/server/db";

const taskProgressSelect = { where: { parentId: null, status: { not: "CANCELED" } }, select: { status: true } } as const;

export async function listRequirements(projectId: string) {
  const rows = await db.requirement.findMany({
    where: { projectId },
    orderBy: { number: "desc" },
    include: {
      owner: { select: { id: true, name: true, color: true } },
      cycle: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
      carriedFrom: { select: { name: true } },
      docs: { orderBy: { sort: "asc" } },
      tasks: taskProgressSelect,
    },
  });
  return rows.map(({ tasks, ...r }) => ({ ...r, ...progressOf(tasks) }));
}

export async function getRequirement(projectId: string, number: number) {
  const requirement = await db.requirement.findUnique({
    where: { projectId_number: { projectId, number } },
    include: {
      owner: { select: { id: true, name: true, color: true } },
      cycle: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
      carriedFrom: { select: { name: true } },
      docs: { orderBy: { sort: "asc" } },
      tasks: {
        where: { parentId: null },
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          assignee: { select: { id: true, name: true, color: true } },
          cycleId: true,
          cycle: { select: { name: true, startDate: true } },
          _count: { select: { subtasks: true } },
        },
      },
      materials: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, kind: true, docType: true, url: true, mimeType: true },
      },
    },
  });
  if (!requirement) return null;

  // 相关讨论：直接关联到需求的帖子 + 关联到其任务的帖子
  const topics = await db.topic.findMany({
    where: { projectId, OR: [{ requirementId: requirement.id }, { task: { requirementId: requirement.id } }] },
    orderBy: { lastActivityAt: "desc" },
    select: { id: true, title: true, status: true, isFaq: true, _count: { select: { replies: true } } },
  });

  return { ...requirement, topics, ...progressOf(requirement.tasks) };
}

function progressOf(tasks: { status: string }[]) {
  const active = tasks.filter((t) => t.status !== "CANCELED");
  const done = active.filter((t) => t.status === "DONE").length;
  return { taskCount: active.length, doneCount: done, percent: active.length ? Math.round((done / active.length) * 100) : 0 };
}

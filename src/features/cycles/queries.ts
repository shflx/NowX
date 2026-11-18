import "server-only";

import { requirementCode } from "@/lib/format";
import { toDateString } from "@/lib/dates";
import { appConfig, today } from "@/server/config";
import { db } from "@/server/db";

import { burndown, countByStatus, summarize, timeline } from "./stats";

/** 项目的全部周期及各自的进度 */
export async function listCycles(projectId: string) {
  const cycles = await db.cycle.findMany({
    where: { projectId },
    orderBy: { startDate: "asc" },
    include: { tasks: { where: { parentId: null }, select: { status: true } } },
  });

  return cycles.map(({ tasks, ...cycle }) => {
    const counts = countByStatus(tasks);
    return {
      ...cycle,
      startDate: toDateString(cycle.startDate),
      endDate: toDateString(cycle.endDate),
      counts,
      ...summarize(counts),
    };
  });
}

export type CycleListItem = Awaited<ReturnType<typeof listCycles>>[number];

/** 周期详情：燃尽图、成员负载、需求进度、顺延任务 */
export async function getCycleDetail(cycle: CycleListItem) {
  const [tasks, carried] = await Promise.all([
    db.task.findMany({
      where: { cycleId: cycle.id, parentId: null },
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
        assignee: { select: { id: true, name: true, color: true } },
        requirement: { select: { id: true, number: true, title: true } },
      },
    }),
    db.task.findMany({
      where: { carriedFromCycleId: cycle.id, parentId: null },
      orderBy: { number: "asc" },
      select: { id: true, number: true, title: true, status: true, cycle: { select: { name: true } } },
    }),
  ]);

  const now = today();
  const time = timeline(cycle.startDate, cycle.endDate, now);
  const points =
    cycle.status === "PLANNED"
      ? []
      : burndown({ start: cycle.startDate, end: cycle.endDate, today: now, timeZone: appConfig.timeZone, tasks });

  // 按负责人汇总
  const byMember = new Map<string, { user: { id: string; name: string; color: string }; tasks: typeof tasks }>();
  for (const t of tasks) {
    if (!t.assignee) continue;
    const entry = byMember.get(t.assignee.id) ?? { user: t.assignee, tasks: [] };
    entry.tasks.push(t);
    byMember.set(t.assignee.id, entry);
  }
  const members = [...byMember.values()]
    .map(({ user, tasks }) => ({ user, counts: countByStatus(tasks), ...summarize(countByStatus(tasks)) }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);

  // 本期需求：计划在本周期交付的需求，加上从本周期顺延出去的需求（用于周期回顾）
  const planned = await db.requirement.findMany({
    where: { OR: [{ cycleId: cycle.id }, { carriedFromCycleId: cycle.id }] },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      cycleId: true,
      carriedFromCycleId: true,
      carriedFrom: { select: { name: true } },
      cycle: { select: { name: true } },
      tasks: { where: { parentId: null }, select: { status: true } },
    },
  });
  const requirements = planned.map(({ tasks, ...r }) => ({
    ...r,
    code: requirementCode(r.number),
    ...summarize(countByStatus(tasks)),
    /** 已从本周期顺延到其他周期 */
    carriedOut: r.cycleId !== cycle.id,
    /** 由其他周期顺延进本周期 */
    carriedIn: r.cycleId === cycle.id && r.carriedFromCycleId !== null && r.carriedFromCycleId !== cycle.id,
  }));

  return { time, points, members, requirements, carried };
}

import "server-only";

import { behindPlan, countByStatus, summarize, timeline } from "@/features/cycles/stats";
import { isOverdue } from "@/features/tasks/serialize";
import { formatRelative, toDateString } from "@/lib/dates";
import { taskCode } from "@/lib/format";
import type { CurrentUser } from "@/server/auth/dal";
import { appConfig, today } from "@/server/config";
import { db } from "@/server/db";

/**
 * 工作台数据（跨项目）：我的任务、进行中的周期、待我回答、置顶公告、最近动态。
 * 范围是「我参与的、未归档的项目」。
 */
export async function getDashboard(user: CurrentUser) {
  const projectWhere = { archivedAt: null, members: { some: { userId: user.id } } };
  const now = today();
  const clock = new Date();

  const [tasks, topics, cycles, pinned, activities] = await Promise.all([
    db.task.findMany({
      where: {
        assigneeId: user.id,
        status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
        cycle: { status: "ACTIVE" },
        project: projectWhere,
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, key: true, name: true } },
      },
    }),
    db.topic.findMany({
      where: { assigneeId: user.id, status: "OPEN", project: projectWhere },
      orderBy: { lastActivityAt: "desc" },
      select: { id: true, title: true, createdAt: true, author: { select: { name: true, color: true } }, project: { select: { key: true, name: true } } },
    }),
    db.cycle.findMany({
      where: { status: "ACTIVE", project: projectWhere },
      orderBy: { project: { createdAt: "asc" } },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        project: { select: { key: true, name: true, color: true } },
        tasks: { where: { parentId: null }, select: { status: true } },
      },
    }),
    db.announcement.findMany({
      where: { pinned: true, project: projectWhere },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, author: { select: { name: true } }, project: { select: { key: true } } },
    }),
    db.activity.findMany({
      where: { project: projectWhere },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        verb: true,
        target: true,
        href: true,
        createdAt: true,
        actor: { select: { name: true, color: true } },
        project: { select: { name: true } },
      },
    }),
  ]);

  const myTasks = tasks.map((t) => {
    const due = t.dueDate ? toDateString(t.dueDate) : null;
    return {
      id: t.id,
      number: t.number,
      code: taskCode(t.project.key, t.number),
      title: t.title,
      status: t.status,
      priority: t.priority,
      due,
      overdue: isOverdue(due, t.status, now),
      project: t.project,
    };
  });

  const activeCycles = cycles.map(({ tasks, ...c }) => {
    const counts = countByStatus(tasks);
    const stats = summarize(counts);
    const start = toDateString(c.startDate);
    const end = toDateString(c.endDate);
    return {
      ...c,
      startDate: start,
      endDate: end,
      counts,
      ...stats,
      daysLeft: timeline(start, end, now).daysLeft,
      behind: behindPlan(stats.total, stats.remaining, start, end, now),
    };
  });

  return {
    today: now,
    myTasks,
    waiting: topics.map((t) => ({ ...t, time: formatRelative(t.createdAt, appConfig.timeZone, clock) })),
    activeCycles,
    pinned,
    activities: activities.map((a) => ({ ...a, time: formatRelative(a.createdAt, appConfig.timeZone, clock) })),
  };
}

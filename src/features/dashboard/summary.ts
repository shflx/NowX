// 工作台的展示数据（纯函数，在页面中按当天日期计算）：逾期判断、周期进度、相对时间

import { behindPlan, countByStatus, summarize, timeline } from "@/features/cycles/stats";
import { isOverdue } from "@/features/tasks/serialize";
import { formatRelative, toDateString } from "@/lib/dates";
import { taskCode } from "@/lib/format";

import type { DashboardData } from "./queries";

export function summarizeDashboard(
  { tasks, topics, cycles, pinned, activities }: DashboardData,
  today: string,
  timeZone: string,
  clock: Date,
) {
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
      overdue: isOverdue(due, t.status, today),
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
      daysLeft: timeline(start, end, today).daysLeft,
      behind: behindPlan(stats.total, stats.remaining, start, end, today),
    };
  });

  return {
    today,
    myTasks,
    waiting: topics.map((t) => ({ ...t, time: formatRelative(t.createdAt, timeZone, clock) })),
    activeCycles,
    pinned,
    activities: activities.map((a) => ({ ...a, time: formatRelative(a.createdAt, timeZone, clock) })),
  };
}

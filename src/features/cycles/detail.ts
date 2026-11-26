// 周期详情的统计（纯函数，在页面中按当天日期计算）：燃尽图、成员负载、需求进度

import { requirementCode } from "@/lib/format";

import type { CycleDetailData, CycleListItem } from "./queries";
import { burndown, countByStatus, summarize, timeline } from "./stats";

export function summarizeCycleDetail(cycle: CycleListItem, data: CycleDetailData, today: string, timeZone: string) {
  const { tasks, carried } = data;
  const time = timeline(cycle.startDate, cycle.endDate, today);
  const points =
    cycle.status === "PLANNED" ? [] : burndown({ start: cycle.startDate, end: cycle.endDate, today, timeZone, tasks });

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

  const requirements = data.requirements.map(({ tasks, ...r }) => ({
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

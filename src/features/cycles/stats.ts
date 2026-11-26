// 周期统计的纯函数（不依赖数据库，便于单元测试）。
// 进度统一按「顶层任务数」统计，已取消的任务不计入。

import type { StatusCounts } from "@/components/shared/status-bar";
import { BOARD_STATUSES } from "@/lib/constants";
import { addDays, diffDays, todayIn } from "@/lib/dates";
import type { TaskStatus } from "@/lib/enums";

type CountableTask = { status: TaskStatus };

export function countByStatus(tasks: CountableTask[]): StatusCounts {
  const counts = Object.fromEntries(BOARD_STATUSES.map((s) => [s, 0])) as StatusCounts;
  for (const t of tasks) {
    if (t.status !== "CANCELED") counts[t.status] += 1;
  }
  return counts;
}

export function summarize(counts: StatusCounts) {
  const total = BOARD_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  return { total, done: counts.DONE, remaining: total - counts.DONE, percent: total ? Math.round((counts.DONE / total) * 100) : 0 };
}

/** 周期时间线：总天数、已进行到第几天（从 0 开始）、剩余天数 */
export function timeline(start: string, end: string, today: string) {
  const days = diffDays(start, end) + 1;
  const elapsed = Math.min(Math.max(diffDays(start, today), 0), days - 1);
  const daysLeft = Math.max(diffDays(today, end), 0);
  return { days, elapsed, daysLeft };
}

/** 理想燃尽线在第 dayIndex 天的剩余量 */
export function idealRemaining(total: number, dayIndex: number, days: number) {
  if (days <= 1) return 0;
  return Math.round(total * (1 - dayIndex / (days - 1)));
}

/** 与理想燃尽线相比落后的任务数（≤ 0 表示进度正常） */
export function behindPlan(total: number, remaining: number, start: string, end: string, today: string) {
  const { days, elapsed } = timeline(start, end, today);
  return remaining - idealRemaining(total, elapsed, days);
}

type BurndownTask = { status: TaskStatus; createdAt: Date; completedAt: Date | null };

export type BurndownPoint = { date: string; ideal: number; actual: number | null };

/**
 * 计算燃尽图：每天结束时剩余的未完成任务数。
 * 任务按创建日期计入范围（周期开始前创建的从第一天计入），按完成日期移出；今天之后的实际值为空。
 */
export function burndown(input: { start: string; end: string; today: string; timeZone: string; tasks: BurndownTask[] }): BurndownPoint[] {
  const { start, end, today, timeZone } = input;
  const tasks = input.tasks
    .filter((t) => t.status !== "CANCELED")
    .map((t) => ({
      created: todayIn(timeZone, t.createdAt),
      completed: t.status === "DONE" && t.completedAt ? todayIn(timeZone, t.completedAt) : null,
    }));

  const days = diffDays(start, end) + 1;
  const total = tasks.length;

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const actual =
      date > today
        ? null
        : tasks.filter((t) => t.created <= date && !(t.completed && t.completed <= date)).length;
    return { date, ideal: idealRemaining(total, i, days), actual };
  });
}

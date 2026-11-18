import "server-only";

import { ActionError } from "@/lib/action-result";
import type { Tx } from "@/server/db";

const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW"] as const;

/** 校验需求可以排入该周期：同一项目、尚未结束。null 表示待排期 */
export async function assertPlannableCycle(tx: Tx, projectId: string, cycleId: string | null) {
  if (!cycleId) return null;
  const cycle = await tx.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.projectId !== projectId) throw new ActionError("所选周期不存在");
  if (cycle.status === "ENDED") throw new ActionError("不能把需求排入已结束的周期");
  return cycle;
}

/**
 * 把需求在原周期中未完成的顶层任务（连同子任务）移到目标周期。
 * 已完成的任务留在原周期，保证燃尽图与周期回顾的历史数据不变。
 * carriedFrom 不为空时记录顺延来源。返回移动的顶层任务数。
 */
export async function moveUnfinishedTasks(
  tx: Tx,
  { requirementId, fromCycleId, toCycleId, carriedFrom }: { requirementId: string; fromCycleId: string | null; toCycleId: string | null; carriedFrom: string | null },
) {
  const roots = await tx.task.findMany({
    where: { requirementId, cycleId: fromCycleId, parentId: null, status: { in: [...OPEN_STATUSES] } },
    select: { id: true },
  });
  const ids = roots.map((t) => t.id);
  if (ids.length === 0) return 0;

  await tx.task.updateMany({
    where: { OR: [{ id: { in: ids } }, { parentId: { in: ids } }] },
    data: { cycleId: toCycleId, ...(carriedFrom ? { carriedFromCycleId: carriedFrom } : {}) },
  });
  return ids.length;
}

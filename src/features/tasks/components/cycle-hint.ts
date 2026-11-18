// 任务周期与需求计划交付周期的关系（纯函数）
import type { CycleLite, RequirementLite } from "./types";

/** 需求的计划交付周期（已结束的不再作为任务默认周期） */
export function requirementCycle(requirementId: string | null, requirements: RequirementLite[], cycles: CycleLite[]) {
  const cycleId = requirements.find((r) => r.id === requirementId)?.cycleId;
  return cycles.find((c) => c.id === cycleId) ?? null;
}

/** 任务排在需求交付周期之后（意味着赶不上交付）时返回该交付周期，否则返回 null */
export function laterThanRequirement(
  taskCycleId: string | null,
  requirementId: string | null,
  requirements: RequirementLite[],
  cycles: CycleLite[],
) {
  const target = requirementCycle(requirementId, requirements, cycles);
  const taskCycle = cycles.find((c) => c.id === taskCycleId);
  if (!target || !taskCycle) return null;
  return taskCycle.startDate > target.startDate ? target : null;
}

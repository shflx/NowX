import { sql } from "kysely";

import { ActionError, parseInput } from "@/lib/action-result";
import type { RequirementStatus } from "@/lib/enums";
import { isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { requireProjectAccess } from "@/server/permissions";

import { createRequirementSchema, moveRequirementSchema, requirementSchema } from "./schemas";
import { createRequirementRecord, findRequirement, updateRequirementRecord } from "./service";

async function loadRequirement(requirementId: string) {
  const requirement = await findRequirement(requirementId);
  if (!requirement) throw new ActionError("需求不存在");
  return requirement;
}

export async function createRequirement(projectId: string, input: unknown) {
  const { user, project } = await requireProjectAccess(projectId);
  return createRequirementRecord(user, project, parseInput(createRequirementSchema, input));
}

export async function updateRequirement(requirementId: string, input: unknown) {
  const requirement = await loadRequirement(requirementId);
  const { user, project } = await requireProjectAccess(requirement.projectId);
  await updateRequirementRecord(user, project, requirement, parseInput(requirementSchema, input));
}

/** 删除需求：仅负责人或管理员，且需求下没有任务 */
export async function deleteRequirement(requirementId: string) {
  const requirement = await loadRequirement(requirementId);
  const { user } = await requireProjectAccess(requirement.projectId);
  if (requirement.ownerId !== user.id && !isAdmin(user)) throw new ActionError("只有需求负责人或管理员可以删除");
  const { tasks } = await db
    .selectFrom("Task")
    .select(sql<number>`count(*)::int`.as("tasks"))
    .where("requirementId", "=", requirementId)
    .executeTakeFirstOrThrow();
  if (tasks > 0) throw new ActionError("需求下还有任务，不能删除");

  await db.deleteFrom("Requirement").where("id", "=", requirementId).execute();
  publishProjectChange(requirement.projectId);
}

/**
 * 调整需求的计划交付周期，默认同时移动它在原周期中未完成的任务。
 * 从进行中的周期移出时记录「顺延」来源；从计划中的周期或待排期移动只是调整计划，不算顺延。
 */
export async function moveRequirement(requirementId: string, input: unknown) {
  const requirement = await loadRequirement(requirementId);
  const { user, project } = await requireProjectAccess(requirement.projectId);
  const { cycleId, moveTasks } = parseInput(moveRequirementSchema, input);
  if (cycleId === requirement.cycleId) throw new ActionError("需求已在该周期中");

  const result = await updateRequirementRecord(user, project, requirement, { cycleId }, moveTasks);
  return result!;
}

/** 只修改需求状态（详情页「标记为已交付」等快捷操作） */
export async function setRequirementStatus(requirementId: string, status: RequirementStatus) {
  const requirement = await loadRequirement(requirementId);
  await requireProjectAccess(requirement.projectId);
  await db.updateTable("Requirement").set({ status, updatedAt: new Date() }).where("id", "=", requirementId).execute();
  publishProjectChange(requirement.projectId);
}

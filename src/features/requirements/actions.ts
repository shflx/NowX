"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { isAdmin } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { requireProjectAccess } from "@/server/permissions";

import { createRequirementSchema, moveRequirementSchema, requirementSchema } from "./schemas";
import { createRequirementRecord, updateRequirementRecord } from "./service";

export async function createRequirement(projectId: string, input: unknown) {
  return runAction(async () => {
    const { user, project } = await requireProjectAccess(projectId);
    return createRequirementRecord(user, project, parseInput(createRequirementSchema, input));
  });
}

export async function updateRequirement(requirementId: string, input: unknown) {
  return runAction(async () => {
    const requirement = await db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) throw new ActionError("需求不存在");
    const { user, project } = await requireProjectAccess(requirement.projectId);
    await updateRequirementRecord(user, project, requirement, parseInput(requirementSchema, input));
    refresh();
  });
}

/** 删除需求：仅负责人或管理员，且需求下没有任务 */
export async function deleteRequirement(requirementId: string) {
  return runAction(async () => {
    const requirement = await db.requirement.findUnique({
      where: { id: requirementId },
      include: { _count: { select: { tasks: true } } },
    });
    if (!requirement) throw new ActionError("需求不存在");
    const { user } = await requireProjectAccess(requirement.projectId);
    if (requirement.ownerId !== user.id && !isAdmin(user)) throw new ActionError("只有需求负责人或管理员可以删除");
    if (requirement._count.tasks > 0) throw new ActionError("需求下还有任务，不能删除");

    await db.requirement.delete({ where: { id: requirementId } });
    publishProjectChange(requirement.projectId);
  });
}

/**
 * 调整需求的计划交付周期，默认同时移动它在原周期中未完成的任务。
 * 从进行中的周期移出时记录「顺延」来源；从计划中的周期或待排期移动只是调整计划，不算顺延。
 */
export async function moveRequirement(requirementId: string, input: unknown) {
  return runAction(async () => {
    const requirement = await db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) throw new ActionError("需求不存在");
    const { user, project } = await requireProjectAccess(requirement.projectId);
    const { cycleId, moveTasks } = parseInput(moveRequirementSchema, input);
    if (cycleId === requirement.cycleId) throw new ActionError("需求已在该周期中");

    const result = await updateRequirementRecord(user, project, requirement, { cycleId }, moveTasks);
    refresh();
    return result!;
  });
}

/** 只修改需求状态（详情页「标记为已交付」等快捷操作） */
export async function setRequirementStatus(requirementId: string, status: "BACKLOG" | "DESIGN" | "DEVELOPING" | "DELIVERED") {
  return runAction(async () => {
    const requirement = await db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) throw new ActionError("需求不存在");
    await requireProjectAccess(requirement.projectId);
    await db.requirement.update({ where: { id: requirementId }, data: { status } });
    publishProjectChange(requirement.projectId);
    refresh();
  });
}

"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { fromDateString } from "@/lib/dates";
import { recordActivity } from "@/server/activity";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { requireProjectAccess } from "@/server/permissions";

import { cycleSchema, endCycleSchema } from "./schemas";

/** 新周期的时间不能与项目内已有周期重叠 */
async function assertNoOverlap(projectId: string, start: string, end: string, excludeId?: string) {
  const clash = await db.cycle.findFirst({
    where: {
      projectId,
      id: excludeId ? { not: excludeId } : undefined,
      startDate: { lte: fromDateString(end) },
      endDate: { gte: fromDateString(start) },
    },
  });
  if (clash) throw new ActionError(`与「${clash.name}」的时间重叠`, { startDate: `与「${clash.name}」的时间重叠` });
}

async function loadCycle(cycleId: string) {
  const cycle = await db.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new ActionError("周期不存在");
  const access = await requireProjectAccess(cycle.projectId);
  return { cycle, ...access };
}

export async function createCycle(projectId: string, input: unknown) {
  return runAction(async () => {
    await requireProjectAccess(projectId);
    const data = parseInput(cycleSchema, input);
    await assertNoOverlap(projectId, data.startDate, data.endDate);

    const cycle = await db.cycle.create({
      data: {
        projectId,
        name: data.name,
        goal: data.goal,
        startDate: fromDateString(data.startDate),
        endDate: fromDateString(data.endDate),
      },
    });
    publishProjectChange(projectId);
    refresh();
    return { id: cycle.id };
  });
}

export async function updateCycle(cycleId: string, input: unknown) {
  return runAction(async () => {
    const { cycle } = await loadCycle(cycleId);
    const data = parseInput(cycleSchema, input);
    await assertNoOverlap(cycle.projectId, data.startDate, data.endDate, cycle.id);

    await db.cycle.update({
      where: { id: cycleId },
      data: { name: data.name, goal: data.goal, startDate: fromDateString(data.startDate), endDate: fromDateString(data.endDate) },
    });
    publishProjectChange(cycle.projectId);
    refresh();
  });
}

export async function startCycle(cycleId: string) {
  return runAction(async () => {
    const { cycle, user, project } = await loadCycle(cycleId);
    if (cycle.status !== "PLANNED") throw new ActionError("只有计划中的周期可以开始");

    const active = await db.cycle.findFirst({ where: { projectId: cycle.projectId, status: "ACTIVE" } });
    if (active) throw new ActionError(`请先结束「${active.name}」，同一项目同时只能有一个进行中的周期`);

    await db.cycle.update({ where: { id: cycleId }, data: { status: "ACTIVE", startedAt: new Date() } });
    await recordActivity({
      projectId: project.id,
      actorId: user.id,
      verb: "开始了周期",
      target: cycle.name,
      href: `/projects/${project.key}/cycles?cycle=${cycle.id}`,
    });
    publishProjectChange(cycle.projectId);
    refresh();
  });
}

/** 结束周期：未完成的顶层任务（连同子任务）顺延到目标周期或放回待规划 */
export async function endCycle(cycleId: string, input: unknown) {
  return runAction(async () => {
    const { cycle, user, project } = await loadCycle(cycleId);
    if (cycle.status !== "ACTIVE") throw new ActionError("只有进行中的周期可以结束");
    const { targetCycleId, startTarget, requirementIds } = parseInput(endCycleSchema, input);

    const target = targetCycleId ? await db.cycle.findUnique({ where: { id: targetCycleId } }) : null;
    if (targetCycleId && (!target || target.projectId !== cycle.projectId || target.status !== "PLANNED")) {
      throw new ActionError("只能顺延到本项目计划中的周期");
    }

    const moved = await db.$transaction(async (tx) => {
      // 未交付的需求随周期顺延（只处理确实属于本周期的需求）
      const { count: movedRequirements } = await tx.requirement.updateMany({
        where: { id: { in: requirementIds }, cycleId, status: { not: "DELIVERED" } },
        data: { cycleId: target?.id ?? null, carriedFromCycleId: cycleId },
      });

      // 未完成的任务全部移出，避免遗留在已结束的周期里
      const unfinished = await tx.task.findMany({
        where: { cycleId, parentId: null, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } },
        select: { id: true },
      });
      const ids = unfinished.map((t) => t.id);
      await tx.task.updateMany({
        where: { OR: [{ id: { in: ids } }, { parentId: { in: ids } }] },
        data: { cycleId: target?.id ?? null, carriedFromCycleId: cycleId },
      });

      await tx.cycle.update({ where: { id: cycleId }, data: { status: "ENDED", endedAt: new Date() } });
      if (target && startTarget) {
        await tx.cycle.update({ where: { id: target.id }, data: { status: "ACTIVE", startedAt: new Date() } });
      }
      await recordActivity(
        { projectId: project.id, actorId: user.id, verb: "结束了周期", target: cycle.name, href: `/projects/${project.key}/cycles?cycle=${cycle.id}` },
        tx,
      );
      return { tasks: ids.length, requirements: movedRequirements };
    });

    publishProjectChange(cycle.projectId);
    refresh();
    return { moved: moved.tasks, movedRequirements: moved.requirements, targetName: target?.name ?? null, started: Boolean(target && startTarget) };
  });
}

/** 只能删除计划中的周期；其中的任务会回到待规划 */
export async function deleteCycle(cycleId: string) {
  return runAction(async () => {
    const { cycle } = await loadCycle(cycleId);
    if (cycle.status !== "PLANNED") throw new ActionError("只能删除计划中的周期");
    await db.cycle.delete({ where: { id: cycleId } });
    publishProjectChange(cycle.projectId);
    refresh();
  });
}

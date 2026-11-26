import { ActionError, parseInput } from "@/lib/action-result";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { fromDateString } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publishProjectChange } from "@/server/events";
import { requireProjectAccess } from "@/server/permissions";

import { cycleSchema, endCycleSchema } from "./schemas";

/** 新周期的时间不能与项目内已有周期重叠 */
async function assertNoOverlap(projectId: string, start: string, end: string, excludeId?: string) {
  let query = db
    .selectFrom("Cycle")
    .select("name")
    .where("projectId", "=", projectId)
    .where("startDate", "<=", fromDateString(end))
    .where("endDate", ">=", fromDateString(start));
  if (excludeId) query = query.where("id", "!=", excludeId);
  const clash = await query.executeTakeFirst();
  if (clash) throw new ActionError(`与「${clash.name}」的时间重叠`, { startDate: `与「${clash.name}」的时间重叠` });
}

async function loadCycle(cycleId: string) {
  const cycle = await db.selectFrom("Cycle").selectAll().where("id", "=", cycleId).executeTakeFirst();
  if (!cycle) throw new ActionError("周期不存在");
  const access = await requireProjectAccess(cycle.projectId);
  return { cycle, ...access };
}

export async function createCycle(projectId: string, input: unknown) {
  await requireProjectAccess(projectId);
  const data = parseInput(cycleSchema, input);
  await assertNoOverlap(projectId, data.startDate, data.endDate);

  const id = cuid();
  await db
    .insertInto("Cycle")
    .values({ id, projectId, name: data.name, goal: data.goal, startDate: data.startDate, endDate: data.endDate })
    .execute();
  publishProjectChange(projectId);
  return { id };
}

export async function updateCycle(cycleId: string, input: unknown) {
  const { cycle } = await loadCycle(cycleId);
  const data = parseInput(cycleSchema, input);
  await assertNoOverlap(cycle.projectId, data.startDate, data.endDate, cycle.id);

  await db
    .updateTable("Cycle")
    .set({ name: data.name, goal: data.goal, startDate: data.startDate, endDate: data.endDate })
    .where("id", "=", cycleId)
    .execute();
  publishProjectChange(cycle.projectId);
}

export async function startCycle(cycleId: string) {
  const { cycle, user, project } = await loadCycle(cycleId);
  if (cycle.status !== "PLANNED") throw new ActionError("只有计划中的周期可以开始");

  const active = await db
    .selectFrom("Cycle")
    .select("name")
    .where("projectId", "=", cycle.projectId)
    .where("status", "=", "ACTIVE")
    .executeTakeFirst();
  if (active) throw new ActionError(`请先结束「${active.name}」，同一项目同时只能有一个进行中的周期`);

  await db.updateTable("Cycle").set({ status: "ACTIVE", startedAt: new Date() }).where("id", "=", cycleId).execute();
  await recordActivity({
    projectId: project.id,
    actorId: user.id,
    verb: "开始了周期",
    target: cycle.name,
    href: routes.cycle(project.key, cycle.id),
  });
  publishProjectChange(cycle.projectId);
}

/** 结束周期：未完成的顶层任务（连同子任务）顺延到目标周期或放回待规划 */
export async function endCycle(cycleId: string, input: unknown) {
  const { cycle, user, project } = await loadCycle(cycleId);
  if (cycle.status !== "ACTIVE") throw new ActionError("只有进行中的周期可以结束");
  const { targetCycleId, startTarget, requirementIds } = parseInput(endCycleSchema, input);

  const target = targetCycleId
    ? await db.selectFrom("Cycle").selectAll().where("id", "=", targetCycleId).executeTakeFirst()
    : null;
  if (targetCycleId && (!target || target.projectId !== cycle.projectId || target.status !== "PLANNED")) {
    throw new ActionError("只能顺延到本项目计划中的周期");
  }

  const moved = await db.transaction().execute(async (tx) => {
    const now = new Date();
    // 未交付的需求随周期顺延（只处理确实属于本周期的需求）
    let movedRequirements = 0;
    if (requirementIds.length > 0) {
      const result = await tx
        .updateTable("Requirement")
        .set({ cycleId: target?.id ?? null, carriedFromCycleId: cycleId, updatedAt: now })
        .where("id", "in", requirementIds)
        .where("cycleId", "=", cycleId)
        .where("status", "!=", "DELIVERED")
        .executeTakeFirst();
      movedRequirements = Number(result.numUpdatedRows);
    }

    // 未完成的任务全部移出，避免遗留在已结束的周期里
    const unfinished = await tx
      .selectFrom("Task")
      .select("id")
      .where("cycleId", "=", cycleId)
      .where("parentId", "is", null)
      .where("status", "in", OPEN_TASK_STATUSES)
      .execute();
    const ids = unfinished.map((t) => t.id);
    if (ids.length > 0) {
      await tx
        .updateTable("Task")
        .set({ cycleId: target?.id ?? null, carriedFromCycleId: cycleId, updatedAt: now })
        .where((eb) => eb.or([eb("id", "in", ids), eb("parentId", "in", ids)]))
        .execute();
    }

    await tx.updateTable("Cycle").set({ status: "ENDED", endedAt: now }).where("id", "=", cycleId).execute();
    if (target && startTarget) {
      await tx.updateTable("Cycle").set({ status: "ACTIVE", startedAt: now }).where("id", "=", target.id).execute();
    }
    await recordActivity(
      {
        projectId: project.id,
        actorId: user.id,
        verb: "结束了周期",
        target: cycle.name,
        href: routes.cycle(project.key, cycle.id),
      },
      tx,
    );
    return { tasks: ids.length, requirements: movedRequirements };
  });

  publishProjectChange(cycle.projectId);
  return {
    moved: moved.tasks,
    movedRequirements: moved.requirements,
    targetName: target?.name ?? null,
    started: Boolean(target && startTarget),
  };
}

/** 只能删除计划中的周期；其中的任务会回到待规划 */
export async function deleteCycle(cycleId: string) {
  const { cycle } = await loadCycle(cycleId);
  if (cycle.status !== "PLANNED") throw new ActionError("只能删除计划中的周期");
  await db.deleteFrom("Cycle").where("id", "=", cycleId).execute();
  publishProjectChange(cycle.projectId);
}

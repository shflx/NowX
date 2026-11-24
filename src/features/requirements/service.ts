import "server-only";

import type { z } from "zod";

import type { Requirement } from "@/generated/prisma/client";
import { ActionError } from "@/lib/action-result";
import { DOC_TYPE_META, detectDocType, OPEN_TASK_STATUSES } from "@/lib/constants";
import { requirementCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import type { CurrentUser } from "@/server/auth/dal";
import { db, type Tx } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { assertMembers } from "@/server/permissions";

import type { createRequirementSchema, requirementSchema } from "./schemas";

type Project = { id: string; key: string };
type RequirementPatch = Partial<z.output<typeof requirementSchema>> & { cycleId?: string | null };

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
    where: { requirementId, cycleId: fromCycleId, parentId: null, status: { in: OPEN_TASK_STATUSES } },
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

/** 外部链接：自动识别类型，未填写名称时使用默认名 */
function toDocRows(docs: { url: string; name: string }[]) {
  return docs.map((d, sort) => {
    const type = detectDocType(d.url);
    return { type, url: d.url, name: d.name || DOC_TYPE_META[type].defaultName, sort };
  });
}

/** 调用方先校验操作者的项目访问权限。 */
export async function createRequirementRecord(user: CurrentUser, project: Project, data: z.output<typeof createRequirementSchema>) {
  const projectId = project.id;
  await assertMembers(projectId, [data.ownerId]);

  const requirement = await db.$transaction(async (tx) => {
    await assertPlannableCycle(tx, projectId, data.cycleId);
    // 项目内编号自增，在同一事务内取号避免并发重复
    const { requirementSeq } = await tx.project.update({
      where: { id: projectId },
      data: { requirementSeq: { increment: 1 } },
      select: { requirementSeq: true },
    });
    const created = await tx.requirement.create({
      data: {
        projectId,
        number: requirementSeq,
        title: data.title,
        summary: data.summary,
        status: data.status,
        ownerId: data.ownerId,
        cycleId: data.cycleId,
        docs: { create: toDocRows(data.docs) },
      },
    });
    await recordActivity(
      {
        projectId,
        actorId: user.id,
        verb: "新建了需求",
        target: `${requirementCode(created.number)} ${created.title}`,
        href: routes.requirement(project.key, created.number),
      },
      tx,
    );
    return created;
  });

  publishProjectChange(projectId);
  return { id: requirement.id, number: requirement.number };
}

/** 仅更新传入的字段；如需调整周期，在同一事务内移动关联任务。 */
export async function updateRequirementRecord(
  user: CurrentUser,
  project: Project,
  requirement: Requirement,
  { docs, cycleId, ...fields }: RequirementPatch,
  moveTasks = true,
) {
  await assertMembers(project.id, [fields.ownerId]);
  const result = await db.$transaction(async (tx) => {
    let movement;
    if (cycleId !== undefined && cycleId !== requirement.cycleId) {
      movement = await adjustCycle(tx, user, project, { ...requirement, title: fields.title ?? requirement.title }, cycleId, moveTasks);
    }
    if (Object.keys(fields).length > 0 || docs !== undefined) {
      await tx.requirement.update({
        where: { id: requirement.id },
        data: { ...fields, updatedAt: new Date() },
      });
    }
    if (docs !== undefined) {
      await tx.requirementDoc.deleteMany({ where: { requirementId: requirement.id } });
      await tx.requirementDoc.createMany({ data: toDocRows(docs).map((doc) => ({ ...doc, requirementId: requirement.id })) });
    }
    return movement;
  });
  publishProjectChange(project.id);
  return result;
}

async function adjustCycle(tx: Tx, user: CurrentUser, project: Project, requirement: Requirement, cycleId: string | null, moveTasks: boolean) {
  const target = await assertPlannableCycle(tx, project.id, cycleId);
  const from = requirement.cycleId
    ? await tx.cycle.findUnique({ where: { id: requirement.cycleId }, select: { id: true, status: true } })
    : null;
  const carried = from && from.status !== "PLANNED" ? from.id : null;

  // 原周期可能在并发调整中变化。只移动仍在原周期的需求。
  const { count } = await tx.requirement.updateMany({
    where: { id: requirement.id, cycleId: requirement.cycleId },
    data: { cycleId, ...(carried ? { carriedFromCycleId: carried } : {}) },
  });
  if (!count) throw new ActionError("需求的周期已变化，请刷新后重试");
  const moved = moveTasks
    ? await moveUnfinishedTasks(tx, { requirementId: requirement.id, fromCycleId: requirement.cycleId, toCycleId: cycleId, carriedFrom: carried })
    : 0;

  await recordActivity(
    {
      projectId: project.id,
      actorId: user.id,
      verb: target ? `把需求排入「${target.name}」` : "把需求移回待排期",
      target: `${requirementCode(requirement.number)} ${requirement.title}`,
      href: routes.requirement(project.key, requirement.number),
    },
    tx,
  );
  return { moved, targetName: target?.name ?? null };
}

import type { Selectable } from "kysely";
import type { z } from "zod";

import { ActionError } from "@/lib/action-result";
import { DOC_TYPE_META, detectDocType, OPEN_TASK_STATUSES } from "@/lib/constants";
import { requirementCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import type { CurrentUser } from "@/server/auth/dal";
import { db, type Tx } from "@/server/db";
import { cuid } from "@/server/db/id";
import type { Requirement } from "@/server/db/schema";
import { publishProjectChange } from "@/server/events";
import { assertMembers } from "@/server/permissions";

import type { createRequirementSchema, requirementSchema } from "./schemas";

type Project = { id: string; key: string };
type RequirementRow = Selectable<Requirement>;
type RequirementPatch = Partial<z.output<typeof requirementSchema>> & { cycleId?: string | null };

export function findRequirement(requirementId: string) {
  return db.selectFrom("Requirement").selectAll().where("id", "=", requirementId).executeTakeFirst();
}

/** 校验需求可以排入该周期：同一项目、尚未结束。null 表示待排期 */
export async function assertPlannableCycle(tx: Tx, projectId: string, cycleId: string | null) {
  if (!cycleId) return null;
  const cycle = await tx.selectFrom("Cycle").selectAll().where("id", "=", cycleId).executeTakeFirst();
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
  {
    requirementId,
    fromCycleId,
    toCycleId,
    carriedFrom,
  }: { requirementId: string; fromCycleId: string | null; toCycleId: string | null; carriedFrom: string | null },
) {
  const roots = await tx
    .selectFrom("Task")
    .select("id")
    .where("requirementId", "=", requirementId)
    .where("cycleId", fromCycleId === null ? "is" : "=", fromCycleId)
    .where("parentId", "is", null)
    .where("status", "in", OPEN_TASK_STATUSES)
    .execute();
  const ids = roots.map((t) => t.id);
  if (ids.length === 0) return 0;

  await tx
    .updateTable("Task")
    .set({ cycleId: toCycleId, ...(carriedFrom ? { carriedFromCycleId: carriedFrom } : {}), updatedAt: new Date() })
    .where((eb) => eb.or([eb("id", "in", ids), eb("parentId", "in", ids)]))
    .execute();
  return ids.length;
}

/** 外部链接：自动识别类型，未填写名称时使用默认名 */
function toDocRows(requirementId: string, docs: { url: string; name: string }[]) {
  return docs.map((d, sort) => {
    const type = detectDocType(d.url);
    return { id: cuid(), requirementId, type, url: d.url, name: d.name || DOC_TYPE_META[type].defaultName, sort };
  });
}

/** 调用方先校验操作者的项目访问权限。 */
export async function createRequirementRecord(
  user: CurrentUser,
  project: Project,
  data: z.output<typeof createRequirementSchema>,
) {
  const projectId = project.id;
  await assertMembers(projectId, [data.ownerId]);

  const requirement = await db.transaction().execute(async (tx) => {
    await assertPlannableCycle(tx, projectId, data.cycleId);
    // 项目内编号自增，在同一事务内取号避免并发重复
    const { requirementSeq } = await tx
      .updateTable("Project")
      .set((eb) => ({ requirementSeq: eb("requirementSeq", "+", 1), updatedAt: new Date() }))
      .where("id", "=", projectId)
      .returning("requirementSeq")
      .executeTakeFirstOrThrow();
    const created = await tx
      .insertInto("Requirement")
      .values({
        id: cuid(),
        projectId,
        number: requirementSeq,
        title: data.title,
        summary: data.summary,
        status: data.status,
        ownerId: data.ownerId,
        cycleId: data.cycleId,
        updatedAt: new Date(),
      })
      .returning(["id", "number", "title"])
      .executeTakeFirstOrThrow();
    if (data.docs.length > 0) await tx.insertInto("RequirementDoc").values(toDocRows(created.id, data.docs)).execute();
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
  requirement: RequirementRow,
  { docs, cycleId, ...fields }: RequirementPatch,
  moveTasks = true,
) {
  await assertMembers(project.id, [fields.ownerId]);
  const result = await db.transaction().execute(async (tx) => {
    let movement;
    if (cycleId !== undefined && cycleId !== requirement.cycleId) {
      movement = await adjustCycle(
        tx,
        user,
        project,
        { ...requirement, title: fields.title ?? requirement.title },
        cycleId,
        moveTasks,
      );
    }
    if (Object.keys(fields).length > 0 || docs !== undefined) {
      await tx
        .updateTable("Requirement")
        .set({ ...fields, updatedAt: new Date() })
        .where("id", "=", requirement.id)
        .execute();
    }
    if (docs !== undefined) {
      await tx.deleteFrom("RequirementDoc").where("requirementId", "=", requirement.id).execute();
      if (docs.length > 0) await tx.insertInto("RequirementDoc").values(toDocRows(requirement.id, docs)).execute();
    }
    return movement;
  });
  publishProjectChange(project.id);
  return result;
}

async function adjustCycle(
  tx: Tx,
  user: CurrentUser,
  project: Project,
  requirement: RequirementRow,
  cycleId: string | null,
  moveTasks: boolean,
) {
  const target = await assertPlannableCycle(tx, project.id, cycleId);
  const from = requirement.cycleId
    ? await tx.selectFrom("Cycle").select(["id", "status"]).where("id", "=", requirement.cycleId).executeTakeFirst()
    : null;
  const carried = from && from.status !== "PLANNED" ? from.id : null;

  // 原周期可能在并发调整中变化。只移动仍在原周期的需求。
  const { numUpdatedRows } = await tx
    .updateTable("Requirement")
    .set({ cycleId, ...(carried ? { carriedFromCycleId: carried } : {}), updatedAt: new Date() })
    .where("id", "=", requirement.id)
    .where("cycleId", requirement.cycleId === null ? "is" : "=", requirement.cycleId)
    .executeTakeFirst();
  if (!numUpdatedRows) throw new ActionError("需求的周期已变化，请刷新后重试");
  const moved = moveTasks
    ? await moveUnfinishedTasks(tx, {
        requirementId: requirement.id,
        fromCycleId: requirement.cycleId,
        toCycleId: cycleId,
        carriedFrom: carried,
      })
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

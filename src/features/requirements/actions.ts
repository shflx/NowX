"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { DOC_TYPE_META, detectDocType } from "@/lib/constants";
import { requirementCode } from "@/lib/format";
import { recordActivity } from "@/server/activity";
import { isAdmin } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { assertMembers, requireProjectAccess } from "@/server/permissions";

import { requirementSchema } from "./schemas";

/** 外部链接：自动识别类型，未填写名称时使用默认名 */
function toDocRows(docs: { url: string; name: string }[]) {
  return docs.map((d, sort) => {
    const type = detectDocType(d.url);
    return { type, url: d.url, name: d.name || DOC_TYPE_META[type].defaultName, sort };
  });
}

export async function createRequirement(projectId: string, input: unknown) {
  return runAction(async () => {
    const { user, project } = await requireProjectAccess(projectId);
    const data = parseInput(requirementSchema, input);
    await assertMembers(projectId, [data.ownerId]);

    const requirement = await db.$transaction(async (tx) => {
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
          docs: { create: toDocRows(data.docs) },
        },
      });
      await recordActivity(
        {
          projectId,
          actorId: user.id,
          verb: "新建了需求",
          target: `${requirementCode(created.number)} ${created.title}`,
          href: `/projects/${project.key}/requirements/${created.number}`,
        },
        tx,
      );
      return created;
    });

    publishProjectChange(projectId);
    return { id: requirement.id, number: requirement.number };
  });
}

export async function updateRequirement(requirementId: string, input: unknown) {
  return runAction(async () => {
    const requirement = await db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) throw new ActionError("需求不存在");
    await requireProjectAccess(requirement.projectId);
    const data = parseInput(requirementSchema, input);
    await assertMembers(requirement.projectId, [data.ownerId]);

    await db.$transaction([
      db.requirementDoc.deleteMany({ where: { requirementId } }),
      db.requirement.update({
        where: { id: requirementId },
        data: {
          title: data.title,
          summary: data.summary,
          status: data.status,
          ownerId: data.ownerId,
          docs: { create: toDocRows(data.docs) },
        },
      }),
    ]);
    publishProjectChange(requirement.projectId);
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

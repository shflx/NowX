import "server-only";

import { createRequirementRecord, updateRequirementRecord } from "@/features/requirements/service";
import { ActionError } from "@/lib/action-result";
import { requirementCode } from "@/lib/format";
import type { CurrentUser } from "@/server/auth/dal";
import { db } from "@/server/db";

import { numberFor, projectScope } from "./queries";

type ProjectInput = { projectKey: string };
type DetailInput = ProjectInput & { number: number | string };

export async function createProjectRequirement(
  user: CurrentUser,
  { projectKey, ...data }: ProjectInput & Parameters<typeof createRequirementRecord>[2],
) {
  const { project } = await projectScope(user, { projectKey });
  const { number } = await createRequirementRecord(user, project, { ...data, ownerId: data.ownerId === "me" ? user.id : data.ownerId });
  return { number, code: requirementCode(number) };
}

export async function updateProjectRequirement(
  user: CurrentUser,
  { projectKey, number: code, ...data }: DetailInput & Parameters<typeof updateRequirementRecord>[3],
) {
  const { project, where } = await projectScope(user, { projectKey });
  const number = numberFor(code, "R");
  if (!number) throw new ActionError("需求不存在");
  const requirement = await db.requirement.findFirst({ where: { ...where, number } });
  if (!requirement) throw new ActionError("需求不存在");
  const movement = await updateRequirementRecord(user, project, requirement, { ...data, ownerId: data.ownerId === "me" ? user.id : data.ownerId });
  return { number, code: requirementCode(number), ...movement };
}

import "server-only";

import { createRequirementRecord, updateRequirementRecord } from "@/features/requirements/service";
import { createTaskRecord, updateTaskRecord } from "@/features/tasks/service";
import { ActionError } from "@/lib/action-result";
import { requirementCode, taskCode } from "@/lib/format";
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
  const { number } = await createRequirementRecord(user, project, {
    ...data,
    ownerId: data.ownerId === "me" ? user.id : data.ownerId,
  });
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
  const movement = await updateRequirementRecord(user, project, requirement, {
    ...data,
    ownerId: data.ownerId === "me" ? user.id : data.ownerId,
  });
  return { number, code: requirementCode(number), ...movement };
}

type TaskCreateInput = Omit<Parameters<typeof createTaskRecord>[2], "requirementId"> & { requirement: number | string | null };
type TaskUpdateInput = Partial<TaskCreateInput>;

async function resolveRequirement(
  where: Awaited<ReturnType<typeof projectScope>>["where"],
  code: TaskUpdateInput["requirement"],
) {
  if (code == null) return code;
  const number = numberFor(code, "R");
  if (!number) throw new ActionError("所选需求不存在");
  const requirement = await db.requirement.findFirst({ where: { ...where, number }, select: { id: true } });
  if (!requirement) throw new ActionError("所选需求不存在");
  return requirement.id;
}

export async function createProjectTask(user: CurrentUser, { projectKey, requirement, ...data }: ProjectInput & TaskCreateInput) {
  const { project, where } = await projectScope(user, { projectKey });
  return createTaskRecord(user, project, {
    ...data,
    assigneeId: data.assigneeId === "me" ? user.id : data.assigneeId,
    requirementId: (await resolveRequirement(where, requirement)) ?? null,
  });
}

export async function updateProjectTask(
  user: CurrentUser,
  { projectKey, number: code, requirement, ...data }: DetailInput & TaskUpdateInput,
) {
  const { project, where } = await projectScope(user, { projectKey });
  const number = numberFor(code, project.key);
  if (!number) throw new ActionError("任务不存在");
  const task = await db.task.findFirst({ where: { ...where, number } });
  if (!task) throw new ActionError("任务不存在");
  const result = await updateTaskRecord(user, project, task, {
    ...data,
    assigneeId: data.assigneeId === "me" ? user.id : data.assigneeId,
    requirementId: await resolveRequirement(where, requirement),
  });
  return { number, code: taskCode(project.key, number), ...result };
}

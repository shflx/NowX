import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { RequirementStatus, TaskStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/action-result";
import { toDateString } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";

type Page = { limit: number; offset: number };
type ProjectInput = { projectKey: string };
type ListInput = Page & ProjectInput & { cycle?: string; q?: string };
type DetailInput = ProjectInput & { number: number | string };

const projectFields = { id: true, key: true, name: true, description: true } as const;
const cycleFields = { id: true, name: true, status: true, projectId: true } as const;
const personFields = { id: true, name: true } as const;
const taskFields = {
  number: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  assignee: { select: personFields },
  cycle: { select: cycleFields },
  requirement: { select: { projectId: true, number: true, title: true } },
} satisfies Prisma.TaskSelect;
const requirementFields = {
  number: true,
  title: true,
  status: true,
  owner: { select: personFields },
  cycle: { select: cycleFields },
} satisfies Prisma.RequirementSelect;

type Project = Pick<Prisma.ProjectGetPayload<{ select: typeof projectFields }>, "id" | "key">;

// 与 canAccessProject 的成员规则一致；MCP 对所有角色额外排除已归档项目。
function activeProjectScope(user: CurrentUser): Prisma.ProjectWhereInput {
  return { archivedAt: null, ...(isAdmin(user) ? {} : { members: { some: { userId: user.id } } }) };
}

export async function projectScope(user: CurrentUser, { projectKey }: ProjectInput) {
  const accessible = activeProjectScope(user);
  const project = await db.project.findFirst({
    where: { ...accessible, key: projectKey.toUpperCase() },
    select: { id: true, key: true },
  });
  if (!project) throw new ActionError("项目不存在或无权访问");

  // 查询记录时再次限定项目归属，避免项目归档或成员关系变化后返回数据。
  return { project, where: { projectId: project.id, project: accessible } };
}

function paged<T>(rows: T[], { limit, offset }: Page) {
  return { items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null };
}

function numberFor(value: number | string, prefix: string) {
  const digits = String(value)
    .toUpperCase()
    .replace(new RegExp(`^${prefix}-`), "");
  if (!/^[1-9]\d{0,9}$/.test(digits)) return undefined;
  const number = Number(digits);
  return number <= 2_147_483_647 ? number : undefined;
}

// PostgreSQL 的 ILIKE 会解释通配符，关键词搜索需要按字面匹配。
function titleContains(q: string) {
  return { contains: q.replace(/[\\%_]/g, (character) => `\\${character}`), mode: "insensitive" } as const;
}

function cycleFilter(cycle: string | undefined, projectId: string) {
  if (cycle === "active") return { cycle: { status: "ACTIVE", projectId } } as const;
  if (cycle === "backlog") return { cycleId: null };
  return cycle ? { cycle: { id: cycle, projectId } } : {};
}

function localCycle(cycle: Prisma.CycleGetPayload<{ select: typeof cycleFields }> | null, projectId: string) {
  if (!cycle || cycle.projectId !== projectId) return null;
  const { id, name, status } = cycle;
  return { id, name, status };
}

function taskSummary(row: Prisma.TaskGetPayload<{ select: typeof taskFields }>, project: Project) {
  const { number, title, status, priority, assignee, dueDate, cycle, requirement } = row;
  return {
    number,
    code: taskCode(project.key, number),
    title,
    status,
    priority,
    assignee,
    dueDate: dueDate ? toDateString(dueDate) : null,
    cycle: localCycle(cycle, project.id),
    requirement:
      requirement?.projectId === project.id
        ? { number: requirement.number, code: requirementCode(requirement.number), title: requirement.title }
        : null,
  };
}

function requirementSummary(row: Prisma.RequirementGetPayload<{ select: typeof requirementFields }>, project: Project) {
  const { number, title, status, owner, cycle } = row;
  return { number, code: requirementCode(number), title, status, owner, plannedCycle: localCycle(cycle, project.id) };
}

export async function listProjects(user: CurrentUser, page: Page) {
  const rows = await db.project.findMany({
    where: activeProjectScope(user),
    select: projectFields,
    orderBy: { key: "asc" },
    skip: page.offset,
    take: page.limit + 1,
  });
  return paged(rows, page);
}

export async function listTasks(user: CurrentUser, input: ListInput & { status?: TaskStatus; assigneeId?: string | null }) {
  const { project, where } = await projectScope(user, input);
  const { q, cycle, status, assigneeId } = input;
  const number = q ? numberFor(q, project.key) : undefined;
  const rows = await db.task.findMany({
    where: {
      ...where,
      ...cycleFilter(cycle, project.id),
      status,
      assigneeId: assigneeId === "me" ? user.id : assigneeId,
      OR: q ? [{ title: titleContains(q) }, ...(number ? [{ number }] : [])] : undefined,
    },
    select: taskFields,
    orderBy: { number: "asc" },
    skip: input.offset,
    take: input.limit + 1,
  });
  return paged(
    rows.map((row) => taskSummary(row, project)),
    input,
  );
}

export async function getTask(user: CurrentUser, input: DetailInput) {
  const { project, where } = await projectScope(user, input);
  const number = numberFor(input.number, project.key);
  if (!number) throw new ActionError("任务不存在");
  const task = await db.task.findFirst({
    where: { ...where, number },
    select: {
      ...taskFields,
      description: true,
      subtasks: { where, select: taskFields, orderBy: { number: "asc" } },
    },
  });
  if (!task) throw new ActionError("任务不存在");
  return {
    ...taskSummary(task, project),
    description: task.description,
    subtasks: task.subtasks.map((row) => taskSummary(row, project)),
  };
}

export async function listRequirements(
  user: CurrentUser,
  input: ListInput & { status?: RequirementStatus; ownerId?: string | null },
) {
  const { project, where } = await projectScope(user, input);
  const { q, cycle, status, ownerId } = input;
  const number = q ? numberFor(q, "R") : undefined;
  const rows = await db.requirement.findMany({
    where: {
      ...where,
      ...cycleFilter(cycle, project.id),
      status,
      ownerId: ownerId === "me" ? user.id : ownerId,
      OR: q ? [{ title: titleContains(q) }, ...(number ? [{ number }] : [])] : undefined,
    },
    select: requirementFields,
    orderBy: { number: "desc" },
    skip: input.offset,
    take: input.limit + 1,
  });
  return paged(
    rows.map((row) => requirementSummary(row, project)),
    input,
  );
}

export async function getRequirement(user: CurrentUser, input: DetailInput) {
  const { project, where } = await projectScope(user, input);
  const number = numberFor(input.number, "R");
  if (!number) throw new ActionError("需求不存在");
  const requirement = await db.requirement.findFirst({
    where: { ...where, number },
    select: {
      ...requirementFields,
      summary: true,
      docs: { select: { type: true, name: true, url: true }, orderBy: { sort: "asc" } },
      tasks: { where, select: taskFields, orderBy: { number: "asc" } },
    },
  });
  if (!requirement) throw new ActionError("需求不存在");
  return {
    ...requirementSummary(requirement, project),
    summary: requirement.summary,
    docs: requirement.docs,
    tasks: requirement.tasks.map((row) => taskSummary(row, project)),
  };
}

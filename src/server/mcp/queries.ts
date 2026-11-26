import { listCycles } from "@/features/cycles/queries";
import { ActionError } from "@/lib/action-result";
import { toDateString } from "@/lib/dates";
import type { CycleStatus, RequirementStatus, TaskPriority, TaskStatus } from "@/lib/enums";
import { requirementCode, taskCode } from "@/lib/format";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";

type Page = { limit: number; offset: number };
type ProjectInput = { projectKey: string };
type ListInput = Page & ProjectInput & { cycle?: string; q?: string };
type DetailInput = ProjectInput & { number: number | string };
type Project = { id: string; key: string };

type CycleRef = { id: string; name: string; status: CycleStatus; projectId: string } | null;
type TaskRow = {
  number: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assignee: { id: string; name: string } | null;
  cycle: CycleRef;
  requirement: { projectId: string; number: number; title: string } | null;
};

// 与 canAccessProject 的成员规则一致；MCP 对所有角色额外排除已归档项目。
function accessibleProjects(user: CurrentUser) {
  let query = db.selectFrom("Project as p").select("p.id").where("p.archivedAt", "is", null);
  if (!isAdmin(user)) {
    query = query.where((eb) =>
      eb.exists(eb.selectFrom("ProjectMember as m").whereRef("m.projectId", "=", "p.id").where("m.userId", "=", user.id)),
    );
  }
  return query;
}

export async function projectScope(user: CurrentUser, { projectKey }: ProjectInput) {
  const project = await db
    .selectFrom("Project")
    .select(["id", "key"])
    .where("key", "=", projectKey.toUpperCase())
    .where("id", "in", accessibleProjects(user))
    .executeTakeFirst();
  if (!project) throw new ActionError("项目不存在或无权访问");
  return project;
}

/**
 * 项目内的任务查询（含摘要字段）。查询记录时再次限定项目归属，
 * 避免项目归档或成员关系变化后返回数据。
 */
function taskQuery(user: CurrentUser, project: Project) {
  return db
    .selectFrom("Task as t")
    .select((eb) => [
      "t.id",
      "t.number",
      "t.title",
      "t.status",
      "t.priority",
      "t.dueDate",
      "t.description",
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name"]).whereRef("u.id", "=", "t.assigneeId")).as("assignee"),
      jsonObjectFrom(
        eb.selectFrom("Cycle as c").select(["c.id", "c.name", "c.status", "c.projectId"]).whereRef("c.id", "=", "t.cycleId"),
      ).as("cycle"),
      jsonObjectFrom(
        eb.selectFrom("Requirement as r").select(["r.projectId", "r.number", "r.title"]).whereRef("r.id", "=", "t.requirementId"),
      ).as("requirement"),
    ])
    .where("t.projectId", "=", project.id)
    .where("t.projectId", "in", accessibleProjects(user));
}

/** 项目内的需求查询（含摘要字段），同样限定项目归属 */
function requirementQuery(user: CurrentUser, project: Project) {
  return db
    .selectFrom("Requirement as r")
    .select((eb) => [
      "r.id",
      "r.number",
      "r.title",
      "r.status",
      "r.summary",
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name"]).whereRef("u.id", "=", "r.ownerId")).as("owner"),
      jsonObjectFrom(
        eb.selectFrom("Cycle as c").select(["c.id", "c.name", "c.status", "c.projectId"]).whereRef("c.id", "=", "r.cycleId"),
      ).as("cycle"),
    ])
    .where("r.projectId", "=", project.id)
    .where("r.projectId", "in", accessibleProjects(user));
}

/** 本项目的周期 ID：active 为进行中的周期，否则为指定周期 */
function projectCycles(project: Project, cycle: string) {
  const query = db.selectFrom("Cycle as c").select("c.id").where("c.projectId", "=", project.id);
  return cycle === "active" ? query.where("c.status", "=", "ACTIVE") : query.where("c.id", "=", cycle);
}

function paged<T>(rows: T[], { limit, offset }: Page) {
  return { items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null };
}

export function numberFor(value: number | string, prefix: string) {
  const digits = String(value)
    .toUpperCase()
    .replace(new RegExp(`^${prefix}-`), "");
  if (!/^[1-9]\d{0,9}$/.test(digits)) return undefined;
  const number = Number(digits);
  return number <= 2_147_483_647 ? number : undefined;
}

// PostgreSQL 的 ILIKE 会解释通配符，关键词搜索需要按字面匹配。
function titlePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

function localCycle(cycle: CycleRef, projectId: string) {
  if (!cycle || cycle.projectId !== projectId) return null;
  const { id, name, status } = cycle;
  return { id, name, status };
}

function taskSummary(row: TaskRow, project: Project) {
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

function requirementSummary(
  row: { number: number; title: string; status: RequirementStatus; owner: { id: string; name: string } | null; cycle: CycleRef },
  project: Project,
) {
  const { number, title, status, owner, cycle } = row;
  return { number, code: requirementCode(number), title, status, owner, plannedCycle: localCycle(cycle, project.id) };
}

export async function listProjects(user: CurrentUser, page: Page) {
  const rows = await db
    .selectFrom("Project")
    .select(["id", "key", "name", "description"])
    .where("id", "in", accessibleProjects(user))
    .orderBy("key", "asc")
    .offset(page.offset)
    .limit(page.limit + 1)
    .execute();
  return paged(rows, page);
}

export async function listProjectCycles(user: CurrentUser, input: ProjectInput) {
  const project = await projectScope(user, input);
  const cycles = await listCycles(project.id);
  return {
    items: cycles.map(({ id, name, status, startDate, endDate, goal, counts, total, done, remaining, percent }) => ({
      id,
      name,
      status,
      startDate,
      endDate,
      goal,
      counts,
      total,
      done,
      remaining,
      percent,
    })),
  };
}

export async function listTasks(user: CurrentUser, input: ListInput & { status?: TaskStatus; assigneeId?: string | null }) {
  const project = await projectScope(user, input);
  const { q, cycle, status, assigneeId } = input;
  const number = q ? numberFor(q, project.key) : undefined;

  let query = taskQuery(user, project);
  if (cycle === "backlog") query = query.where("t.cycleId", "is", null);
  else if (cycle) query = query.where("t.cycleId", "in", projectCycles(project, cycle));
  if (status) query = query.where("t.status", "=", status);
  if (assigneeId === null) query = query.where("t.assigneeId", "is", null);
  else if (assigneeId) query = query.where("t.assigneeId", "=", assigneeId === "me" ? user.id : assigneeId);
  if (q)
    query = query.where((eb) =>
      eb.or([eb("t.title", "ilike", titlePattern(q)), ...(number ? [eb("t.number", "=", number)] : [])]),
    );

  const rows = await query
    .orderBy("t.number", "asc")
    .offset(input.offset)
    .limit(input.limit + 1)
    .execute();
  return paged(
    rows.map((row) => taskSummary(row, project)),
    input,
  );
}

export async function getTask(user: CurrentUser, input: DetailInput) {
  const project = await projectScope(user, input);
  const number = numberFor(input.number, project.key);
  if (!number) throw new ActionError("任务不存在");
  const task = await taskQuery(user, project).where("t.number", "=", number).executeTakeFirst();
  if (!task) throw new ActionError("任务不存在");
  const subtasks = await taskQuery(user, project).where("t.parentId", "=", task.id).orderBy("t.number", "asc").execute();
  return {
    ...taskSummary(task, project),
    description: task.description,
    subtasks: subtasks.map((row) => taskSummary(row, project)),
  };
}

export async function listRequirements(
  user: CurrentUser,
  input: ListInput & { status?: RequirementStatus; ownerId?: string | null },
) {
  const project = await projectScope(user, input);
  const { q, cycle, status, ownerId } = input;
  const number = q ? numberFor(q, "R") : undefined;

  let query = requirementQuery(user, project);
  if (cycle === "backlog") query = query.where("r.cycleId", "is", null);
  else if (cycle) query = query.where("r.cycleId", "in", projectCycles(project, cycle));
  if (status) query = query.where("r.status", "=", status);
  if (ownerId === null) query = query.where("r.ownerId", "is", null);
  else if (ownerId) query = query.where("r.ownerId", "=", ownerId === "me" ? user.id : ownerId);
  if (q)
    query = query.where((eb) =>
      eb.or([eb("r.title", "ilike", titlePattern(q)), ...(number ? [eb("r.number", "=", number)] : [])]),
    );

  const rows = await query
    .orderBy("r.number", "desc")
    .offset(input.offset)
    .limit(input.limit + 1)
    .execute();
  return paged(
    rows.map((row) => requirementSummary(row, project)),
    input,
  );
}

export async function getRequirement(user: CurrentUser, input: DetailInput) {
  const project = await projectScope(user, input);
  const number = numberFor(input.number, "R");
  if (!number) throw new ActionError("需求不存在");
  const requirement = await requirementQuery(user, project)
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("RequirementDoc as d")
          .select(["d.type", "d.name", "d.url"])
          .whereRef("d.requirementId", "=", "r.id")
          .orderBy("d.sort", "asc"),
      ).as("docs"),
    ])
    .where("r.number", "=", number)
    .executeTakeFirst();
  if (!requirement) throw new ActionError("需求不存在");
  const tasks = await taskQuery(user, project).where("t.requirementId", "=", requirement.id).orderBy("t.number", "asc").execute();
  return {
    ...requirementSummary(requirement, project),
    summary: requirement.summary,
    docs: requirement.docs,
    tasks: tasks.map((row) => taskSummary(row, project)),
  };
}

/** 写操作使用：按编号查找本项目内的需求或任务 */
export function findRequirementByNumber(user: CurrentUser, project: Project, number: number) {
  return db
    .selectFrom("Requirement as r")
    .selectAll("r")
    .where("r.projectId", "=", project.id)
    .where("r.projectId", "in", accessibleProjects(user))
    .where("r.number", "=", number)
    .executeTakeFirst();
}

export function findTaskByNumber(user: CurrentUser, project: Project, number: number) {
  return db
    .selectFrom("Task as t")
    .selectAll("t")
    .where("t.projectId", "=", project.id)
    .where("t.projectId", "in", accessibleProjects(user))
    .where("t.number", "=", number)
    .executeTakeFirst();
}

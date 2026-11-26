import { sql } from "kysely";

import { listProjectMembers } from "@/features/projects/queries";
import { toDateString } from "@/lib/dates";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";

import type { TaskFormOptions } from "./components/types";
import type { TaskListFilter } from "./schemas";

/** 任务列表：按周期 / 负责人 / 关键字筛选，包含子任务 */
export async function listTasks(projectId: string, filter: TaskListFilter, currentUserId: string) {
  let query = db
    .selectFrom("Task as t")
    .select((eb) => [
      "t.id",
      "t.number",
      "t.title",
      "t.status",
      "t.priority",
      "t.dueDate",
      "t.parentId",
      "t.carriedFromCycleId",
      "t.blockedAt",
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "t.assigneeId")).as(
        "assignee",
      ),
      jsonObjectFrom(
        eb.selectFrom("Requirement as r").select(["r.id", "r.number", "r.title"]).whereRef("r.id", "=", "t.requirementId"),
      ).as("requirement"),
      jsonArrayFrom(eb.selectFrom("Task as s").select("s.status").whereRef("s.parentId", "=", "t.id")).as("subtasks"),
      eb
        .selectFrom("TaskComment as c")
        .select(sql<number>`count(*)::int`.as("n"))
        .whereRef("c.taskId", "=", "t.id")
        .as("comments"),
    ])
    .where("t.projectId", "=", projectId);

  if (filter.cycle === "backlog") query = query.where("t.cycleId", "is", null);
  else if (filter.cycle !== "all") query = query.where("t.cycleId", "=", filter.cycle);

  if (filter.assignee === "me") query = query.where("t.assigneeId", "=", currentUserId);
  else if (filter.assignee !== "all") query = query.where("t.assigneeId", "=", filter.assignee);

  const q = filter.q.trim();
  if (q) {
    const number = Number(q.replace(/^[A-Za-z]+-/, ""));
    query = query.where((eb) =>
      eb.or([eb("t.title", "ilike", `%${q}%`), ...(Number.isInteger(number) && number > 0 ? [eb("t.number", "=", number)] : [])]),
    );
  }

  const rows = await query.orderBy("t.number", "asc").execute();
  return rows.map(({ comments, ...task }) => ({ ...task, _count: { comments: comments ?? 0 } }));
}

export type TaskListItem = Awaited<ReturnType<typeof listTasks>>[number];

/** 任务详情（侧边抽屉） */
export async function getTaskDetail(projectId: string, number: number) {
  const task = await db
    .selectFrom("Task as t")
    .selectAll("t")
    .select((eb) => [
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "t.assigneeId")).as(
        "assignee",
      ),
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name"]).whereRef("u.id", "=", "t.creatorId"))
        .$notNull()
        .as("creator"),
      jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "t.carriedFromCycleId")).as(
        "carriedFrom",
      ),
      jsonObjectFrom(
        eb
          .selectFrom("Requirement as r")
          .select((r) => [
            "r.id",
            "r.number",
            "r.title",
            jsonArrayFrom(
              r
                .selectFrom("RequirementDoc as d")
                .select(["d.type", "d.name", "d.url"])
                .whereRef("d.requirementId", "=", "r.id")
                .orderBy("d.sort", "asc")
                .limit(1),
            ).as("docs"),
          ])
          .whereRef("r.id", "=", "t.requirementId"),
      ).as("requirement"),
      jsonObjectFrom(eb.selectFrom("Task as p").select(["p.id", "p.number", "p.title"]).whereRef("p.id", "=", "t.parentId")).as(
        "parent",
      ),
      jsonArrayFrom(
        eb
          .selectFrom("Task as s")
          .select((s) => [
            "s.id",
            "s.number",
            "s.title",
            "s.status",
            jsonObjectFrom(
              s.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "s.assigneeId"),
            ).as("assignee"),
          ])
          .whereRef("s.parentId", "=", "t.id")
          .orderBy("s.number", "asc"),
      ).as("subtasks"),
      jsonArrayFrom(
        eb
          .selectFrom("TaskComment as c")
          .select((c) => [
            "c.id",
            "c.body",
            "c.createdAt",
            jsonObjectFrom(c.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "c.authorId"))
              .$notNull()
              .as("author"),
          ])
          .whereRef("c.taskId", "=", "t.id")
          .orderBy("c.createdAt", "asc"),
      ).as("comments"),
      jsonArrayFrom(
        eb
          .selectFrom("Topic as o")
          .select((o) => [
            "o.id",
            "o.title",
            "o.status",
            o
              .selectFrom("Reply as r")
              .select(sql<number>`count(*)::int`.as("n"))
              .whereRef("r.topicId", "=", "o.id")
              .as("replies"),
          ])
          .whereRef("o.taskId", "=", "t.id")
          .orderBy("o.lastActivityAt", "desc"),
      ).as("topics"),
    ])
    .where("t.projectId", "=", projectId)
    .where("t.number", "=", number)
    .executeTakeFirst();
  return task ?? null;
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

/** 新建 / 编辑任务时可选的成员、周期与需求 */
export async function loadTaskFormOptions(project: { id: string; key: string }): Promise<TaskFormOptions> {
  const [members, cycles, requirements] = await Promise.all([
    listProjectMembers(project.id),
    db
      .selectFrom("Cycle")
      .select(["id", "name", "status", "startDate", "endDate"])
      .where("projectId", "=", project.id)
      .orderBy("startDate", "asc")
      .execute(),
    db
      .selectFrom("Requirement")
      .select(["id", "number", "title", "cycleId"])
      .where("projectId", "=", project.id)
      .orderBy("number", "desc")
      .execute(),
  ]);
  return {
    projectId: project.id,
    projectKey: project.key,
    members: members.filter((m) => m.status === "ACTIVE").map(({ id, name, color }) => ({ id, name, color })),
    cycles: cycles.map((c) => ({ ...c, startDate: toDateString(c.startDate), endDate: toDateString(c.endDate) })),
    requirements,
  };
}

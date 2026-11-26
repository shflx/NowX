import { projectMembersQuery } from "@/features/projects/queries";
import { toDateString } from "@/lib/dates";
import { countInt, db } from "@/server/db";
import { jsonArrayFrom, jsonBuildObject, jsonDate, jsonObjectFrom } from "@/server/db/json";

import type { TaskFormOptions } from "./components/types";
import type { TaskListFilter } from "./schemas";

// 以下函数返回查询（不执行），由页面接口合并为一条 SQL 后执行

/** 任务列表：按周期 / 负责人 / 关键字筛选，包含子任务 */
export function taskListQuery(projectId: string, filter: TaskListFilter, currentUserId: string) {
  let query = db
    .selectFrom("Task as t")
    .select((eb) => [
      "t.id",
      "t.number",
      "t.title",
      "t.status",
      "t.priority",
      jsonDate<Date | null>("t.dueDate").as("dueDate"),
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
      jsonBuildObject({
        comments: eb.selectFrom("TaskComment as c").select(countInt.as("n")).whereRef("c.taskId", "=", "t.id").$castTo<number>(),
      }).as("_count"),
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

  return query.orderBy("t.number", "asc");
}

export type TaskListItem = Awaited<ReturnType<ReturnType<typeof taskListQuery>["execute"]>>[number];

/** 任务详情（侧边抽屉） */
export function taskDetailQuery(projectId: string, number: number) {
  return db
    .selectFrom("Task as t")
    .select((eb) => [
      "t.id",
      "t.number",
      "t.title",
      "t.description",
      "t.status",
      "t.priority",
      jsonDate<Date | null>("t.dueDate").as("dueDate"),
      "t.assigneeId",
      "t.cycleId",
      "t.requirementId",
      "t.blockedAt",
      "t.creatorId",
      "t.createdAt",
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
            o.selectFrom("Reply as r").select(countInt.as("n")).whereRef("r.topicId", "=", "o.id").as("replies"),
          ])
          .whereRef("o.taskId", "=", "t.id")
          .orderBy("o.lastActivityAt", "desc"),
      ).as("topics"),
    ])
    .where("t.projectId", "=", projectId)
    .where("t.number", "=", number);
}

export type TaskDetail = NonNullable<Awaited<ReturnType<ReturnType<typeof taskDetailQuery>["executeTakeFirst"]>>>;

/** 新建 / 编辑任务时可选的成员、周期与需求 */
export function taskFormOptionsQueries(projectId: string) {
  return [
    jsonArrayFrom(projectMembersQuery(projectId)).as("members"),
    jsonArrayFrom(
      db
        .selectFrom("Cycle as c")
        .select(["c.id", "c.name", "c.status", jsonDate("c.startDate").as("startDate"), jsonDate("c.endDate").as("endDate")])
        .where("c.projectId", "=", projectId)
        .orderBy("c.startDate", "asc"),
    ).as("cycles"),
    jsonArrayFrom(
      db
        .selectFrom("Requirement")
        .select(["id", "number", "title", "cycleId"])
        .where("projectId", "=", projectId)
        .orderBy("number", "desc"),
    ).as("requirements"),
  ] as const;
}

type FormOptionRows = Awaited<ReturnType<ReturnType<typeof formOptionsSelect>["executeTakeFirstOrThrow"]>>;
const formOptionsSelect = (projectId: string) => db.selectNoFrom(() => taskFormOptionsQueries(projectId));

/** 把查询结果整理为任务表单的选项（只保留正常状态的成员，日期转为 yyyy-MM-dd） */
export function toTaskFormOptions(project: { id: string; key: string }, rows: FormOptionRows): TaskFormOptions {
  return {
    projectId: project.id,
    projectKey: project.key,
    members: rows.members.filter((m) => m.status === "ACTIVE").map(({ id, name, color }) => ({ id, name, color })),
    cycles: rows.cycles.map((c) => ({ ...c, startDate: toDateString(c.startDate), endDate: toDateString(c.endDate) })),
    requirements: rows.requirements,
  };
}

/** 单独读取任务表单选项（一条查询） */
export async function loadTaskFormOptions(project: { id: string; key: string }) {
  return toTaskFormOptions(project, await formOptionsSelect(project.id).executeTakeFirstOrThrow());
}

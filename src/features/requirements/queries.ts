import { type ExpressionBuilder, sql } from "kysely";

import type { CycleStatus } from "@/lib/enums";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";
import type { DB } from "@/server/db/schema";

type RequirementScope = ExpressionBuilder<DB & { r: DB["Requirement"] }, "r">;

/** 计划交付周期。JSON 中的日期转为 timestamp，前端按 UTC 零点还原为 Date（与 @db.Date 一致） */
const plannedCycle = (eb: RequirementScope) =>
  jsonObjectFrom(
    eb
      .selectFrom("Cycle as c")
      .select([
        "c.id",
        "c.name",
        sql<CycleStatus>`c.status`.as("status"),
        sql<Date>`c."startDate"::timestamp`.as("startDate"),
        sql<Date>`c."endDate"::timestamp`.as("endDate"),
      ])
      .whereRef("c.id", "=", "r.cycleId"),
  );

const relations = (eb: RequirementScope) => [
  jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "r.ownerId")).as("owner"),
  plannedCycle(eb).as("cycle"),
  jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "r.carriedFromCycleId")).as("carriedFrom"),
  jsonArrayFrom(
    eb.selectFrom("RequirementDoc as d").selectAll("d").whereRef("d.requirementId", "=", "r.id").orderBy("d.sort", "asc"),
  ).as("docs"),
];

export async function listRequirements(projectId: string) {
  const rows = await db
    .selectFrom("Requirement as r")
    .selectAll("r")
    .select((eb) => [
      ...relations(eb),
      jsonArrayFrom(
        eb
          .selectFrom("Task as t")
          .select("t.status")
          .whereRef("t.requirementId", "=", "r.id")
          .where("t.parentId", "is", null)
          .where("t.status", "!=", "CANCELED"),
      ).as("tasks"),
    ])
    .where("r.projectId", "=", projectId)
    .orderBy("r.number", "desc")
    .execute();
  return rows.map(({ tasks, ...r }) => ({ ...r, ...progressOf(tasks) }));
}

export async function getRequirement(projectId: string, number: number) {
  const requirement = await db
    .selectFrom("Requirement as r")
    .selectAll("r")
    .select((eb) => [
      ...relations(eb),
      jsonArrayFrom(
        eb
          .selectFrom("Task as t")
          .select((t) => [
            "t.id",
            "t.number",
            "t.title",
            "t.status",
            "t.cycleId",
            jsonObjectFrom(
              t.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "t.assigneeId"),
            ).as("assignee"),
            jsonObjectFrom(
              t
                .selectFrom("Cycle as c")
                .select(["c.name", sql<Date>`c."startDate"::timestamp`.as("startDate")])
                .whereRef("c.id", "=", "t.cycleId"),
            ).as("cycle"),
            t
              .selectFrom("Task as s")
              .select(sql<number>`count(*)::int`.as("n"))
              .whereRef("s.parentId", "=", "t.id")
              .as("subtasks"),
          ])
          .whereRef("t.requirementId", "=", "r.id")
          .where("t.parentId", "is", null)
          .orderBy("t.number", "asc"),
      ).as("tasks"),
      jsonArrayFrom(
        eb
          .selectFrom("Material as m")
          .select(["m.id", "m.name", "m.kind", "m.docType", "m.url", "m.mimeType"])
          .whereRef("m.requirementId", "=", "r.id")
          .orderBy("m.createdAt", "desc"),
      ).as("materials"),
    ])
    .where("r.projectId", "=", projectId)
    .where("r.number", "=", number)
    .executeTakeFirst();
  if (!requirement) return null;

  // 相关讨论：直接关联到需求的帖子 + 关联到其任务的帖子
  const topics = await db
    .selectFrom("Topic as o")
    .leftJoin("Task as t", "t.id", "o.taskId")
    .select((eb) => [
      "o.id",
      "o.title",
      "o.status",
      "o.isFaq",
      eb
        .selectFrom("Reply as p")
        .select(sql<number>`count(*)::int`.as("n"))
        .whereRef("p.topicId", "=", "o.id")
        .as("replies"),
    ])
    .where("o.projectId", "=", projectId)
    .where((eb) => eb.or([eb("o.requirementId", "=", requirement.id), eb("t.requirementId", "=", requirement.id)]))
    .orderBy("o.lastActivityAt", "desc")
    .execute();

  const tasks = requirement.tasks.map(({ subtasks, ...t }) => ({ ...t, _count: { subtasks: subtasks ?? 0 } }));
  return {
    ...requirement,
    tasks,
    topics: topics.map(({ replies, ...t }) => ({ ...t, _count: { replies: replies ?? 0 } })),
    ...progressOf(tasks),
  };
}

function progressOf(tasks: { status: string }[]) {
  const active = tasks.filter((t) => t.status !== "CANCELED");
  const done = active.filter((t) => t.status === "DONE").length;
  return { taskCount: active.length, doneCount: done, percent: active.length ? Math.round((done / active.length) * 100) : 0 };
}

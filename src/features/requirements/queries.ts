import { type ExpressionBuilder, sql } from "kysely";

import type { CycleStatus } from "@/lib/enums";
import { countInt, db } from "@/server/db";
import { jsonArrayFrom, jsonBuildObject, jsonDate, jsonObjectFrom } from "@/server/db/json";
import type { DB } from "@/server/db/schema";

// 以下函数返回查询（不执行），由页面接口合并为一条 SQL 后执行

type RequirementScope = ExpressionBuilder<DB & { r: DB["Requirement"] }, "r">;

const relations = (eb: RequirementScope) => [
  jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "r.ownerId")).as("owner"),
  // 计划交付周期
  jsonObjectFrom(
    eb
      .selectFrom("Cycle as c")
      .select([
        "c.id",
        "c.name",
        sql<CycleStatus>`c.status`.as("status"),
        jsonDate("c.startDate").as("startDate"),
        jsonDate("c.endDate").as("endDate"),
      ])
      .whereRef("c.id", "=", "r.cycleId"),
  ).as("cycle"),
  jsonObjectFrom(eb.selectFrom("Cycle as c").select("c.name").whereRef("c.id", "=", "r.carriedFromCycleId")).as("carriedFrom"),
  jsonArrayFrom(
    eb.selectFrom("RequirementDoc as d").selectAll("d").whereRef("d.requirementId", "=", "r.id").orderBy("d.sort", "asc"),
  ).as("docs"),
];

export function requirementListQuery(projectId: string) {
  return db
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
    .orderBy("r.number", "desc");
}

export function requirementDetailQuery(projectId: string, number: number) {
  return db
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
                .select(["c.name", jsonDate("c.startDate").as("startDate")])
                .whereRef("c.id", "=", "t.cycleId"),
            ).as("cycle"),
            jsonBuildObject({
              subtasks: t.selectFrom("Task as s").select(countInt.as("n")).whereRef("s.parentId", "=", "t.id").$castTo<number>(),
            }).as("_count"),
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
    .where("r.number", "=", number);
}

/** 相关讨论：直接关联到需求的帖子 + 关联到其任务的帖子 */
export function requirementTopicsQuery(projectId: string, number: number) {
  const requirementId = db.selectFrom("Requirement").select("id").where("projectId", "=", projectId).where("number", "=", number);
  return db
    .selectFrom("Topic as o")
    .leftJoin("Task as t", "t.id", "o.taskId")
    .select((eb) => [
      "o.id",
      "o.title",
      "o.status",
      "o.isFaq",
      jsonBuildObject({
        replies: eb.selectFrom("Reply as p").select(countInt.as("n")).whereRef("p.topicId", "=", "o.id").$castTo<number>(),
      }).as("_count"),
    ])
    .where("o.projectId", "=", projectId)
    .where((eb) => eb.or([eb("o.requirementId", "in", requirementId), eb("t.requirementId", "in", requirementId)]))
    .orderBy("o.lastActivityAt", "desc");
}

/** 任务完成进度（不计已取消的任务） */
export function progressOf(tasks: { status: string }[]) {
  const active = tasks.filter((t) => t.status !== "CANCELED");
  const done = active.filter((t) => t.status === "DONE").length;
  return { taskCount: active.length, doneCount: done, percent: active.length ? Math.round((done / active.length) * 100) : 0 };
}

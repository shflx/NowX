import { sql } from "kysely";

import { countInt, db } from "@/server/db";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "@/server/db/json";

import type { TopicFilter } from "./schemas";

// 以下函数返回查询（不执行），由页面接口合并为一条 SQL 后执行

export function topicListQuery(projectId: string, filter: TopicFilter, userId: string) {
  let query = db
    .selectFrom("Topic as o")
    .select((eb) => [
      "o.id",
      "o.title",
      "o.body",
      "o.status",
      "o.isFaq",
      "o.viewCount",
      "o.createdAt",
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "o.authorId"))
        .$notNull()
        .as("author"),
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name"]).whereRef("u.id", "=", "o.assigneeId")).as("assignee"),
      jsonObjectFrom(eb.selectFrom("Task as t").select("t.number").whereRef("t.id", "=", "o.taskId")).as("task"),
      jsonObjectFrom(eb.selectFrom("Requirement as r").select("r.number").whereRef("r.id", "=", "o.requirementId")).as(
        "requirement",
      ),
      jsonBuildObject({
        replies: eb.selectFrom("Reply as p").select(countInt.as("n")).whereRef("p.topicId", "=", "o.id").$castTo<number>(),
      }).as("_count"),
    ])
    .where("o.projectId", "=", projectId);

  switch (filter) {
    case "mine":
      query = query.where("o.assigneeId", "=", userId).where("o.status", "=", "OPEN");
      break;
    case "asked":
      query = query.where("o.authorId", "=", userId);
      break;
    case "open":
      query = query.where("o.status", "=", "OPEN");
      break;
    case "solved":
      query = query.where("o.status", "=", "SOLVED");
      break;
    case "faq":
      query = query.where("o.isFaq", "=", true);
      break;
  }

  return query.orderBy("o.lastActivityAt", "desc");
}

/** 各筛选项的数量（左侧导航） */
export function topicCountsQuery(projectId: string, userId: string) {
  return db
    .selectFrom("Topic")
    .select([
      sql<number>`count(*)::int`.as("all"),
      sql<number>`(count(*) FILTER (WHERE "assigneeId" = ${userId} AND status = 'OPEN'))::int`.as("mine"),
      sql<number>`(count(*) FILTER (WHERE "authorId" = ${userId}))::int`.as("asked"),
      sql<number>`(count(*) FILTER (WHERE status = 'OPEN'))::int`.as("open"),
      sql<number>`(count(*) FILTER (WHERE status = 'SOLVED'))::int`.as("solved"),
      sql<number>`(count(*) FILTER (WHERE "isFaq"))::int`.as("faq"),
    ])
    .where("projectId", "=", projectId);
}

export function topicDetailQuery(projectId: string, topicId: string) {
  return db
    .selectFrom("Topic as o")
    .selectAll("o")
    .select((eb) => [
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "o.authorId"))
        .$notNull()
        .as("author"),
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "o.assigneeId")).as(
        "assignee",
      ),
      jsonObjectFrom(eb.selectFrom("Task as t").select(["t.number", "t.title"]).whereRef("t.id", "=", "o.taskId")).as("task"),
      jsonObjectFrom(
        eb.selectFrom("Requirement as r").select(["r.number", "r.title"]).whereRef("r.id", "=", "o.requirementId"),
      ).as("requirement"),
      jsonArrayFrom(
        eb
          .selectFrom("Reply as p")
          .selectAll("p")
          .select((p) => [
            jsonObjectFrom(
              p.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "p.authorId"),
            ).as("author"),
          ])
          .whereRef("p.topicId", "=", "o.id")
          .orderBy("p.createdAt", "asc"),
      ).as("replies"),
    ])
    .where("o.id", "=", topicId)
    .where("o.projectId", "=", projectId);
}

export function faqQuery(projectId: string, excludeId: string) {
  return db
    .selectFrom("Topic")
    .select(["id", "title"])
    .where("projectId", "=", projectId)
    .where("isFaq", "=", true)
    .where("id", "!=", excludeId)
    .orderBy("lastActivityAt", "desc")
    .limit(8);
}

/** 浏览数 +1（帖子详情页在响应结束后调用） */
export async function incrementTopicView(topicId: string) {
  await db
    .updateTable("Topic")
    .set((eb) => ({ viewCount: eb("viewCount", "+", 1) }))
    .where("id", "=", topicId)
    .execute()
    .catch(() => {});
}

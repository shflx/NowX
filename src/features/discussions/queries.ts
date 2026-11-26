import { sql } from "kysely";

import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";

import type { TopicFilter } from "./schemas";

export function listTopics(projectId: string, filter: TopicFilter, userId: string) {
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
      eb
        .selectFrom("Reply as p")
        .select(sql<number>`count(*)::int`.as("n"))
        .whereRef("p.topicId", "=", "o.id")
        .as("replies"),
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

  return query
    .orderBy("o.lastActivityAt", "desc")
    .execute()
    .then((rows) => rows.map(({ replies, ...t }) => ({ ...t, _count: { replies: replies ?? 0 } })));
}

/** 各筛选项的数量（左侧导航） */
export async function countTopics(projectId: string, userId: string) {
  const { rows } = await sql<Record<TopicFilter, number>>`
    SELECT count(*)::int AS "all",
           (count(*) FILTER (WHERE "assigneeId" = ${userId} AND status = 'OPEN'))::int AS mine,
           (count(*) FILTER (WHERE "authorId" = ${userId}))::int AS asked,
           (count(*) FILTER (WHERE status = 'OPEN'))::int AS open,
           (count(*) FILTER (WHERE status = 'SOLVED'))::int AS solved,
           (count(*) FILTER (WHERE "isFaq"))::int AS faq
    FROM "Topic"
    WHERE "projectId" = ${projectId}
  `.execute(db);
  return rows[0];
}

export async function getTopic(projectId: string, topicId: string) {
  const topic = await db
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
    .where("o.projectId", "=", projectId)
    .executeTakeFirst();
  return topic ?? null;
}

export function listFaq(projectId: string, excludeId?: string) {
  let query = db.selectFrom("Topic").select(["id", "title"]).where("projectId", "=", projectId).where("isFaq", "=", true);
  if (excludeId) query = query.where("id", "!=", excludeId);
  return query.orderBy("lastActivityAt", "desc").limit(8).execute();
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

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

import type { TopicFilter } from "./schemas";

function filterWhere(filter: TopicFilter, userId: string): Prisma.TopicWhereInput {
  switch (filter) {
    case "mine":
      return { assigneeId: userId, status: "OPEN" };
    case "asked":
      return { authorId: userId };
    case "open":
      return { status: "OPEN" };
    case "solved":
      return { status: "SOLVED" };
    case "faq":
      return { isFaq: true };
    default:
      return {};
  }
}

export async function listTopics(projectId: string, filter: TopicFilter, userId: string) {
  return db.topic.findMany({
    where: { projectId, ...filterWhere(filter, userId) },
    orderBy: { lastActivityAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      isFaq: true,
      viewCount: true,
      createdAt: true,
      author: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true } },
      task: { select: { number: true } },
      requirement: { select: { number: true } },
      _count: { select: { replies: true } },
    },
  });
}

/** 各筛选项的数量（左侧导航） */
export async function countTopics(projectId: string, userId: string) {
  const filters: TopicFilter[] = ["all", "mine", "asked", "open", "solved", "faq"];
  const counts = await Promise.all(filters.map((f) => db.topic.count({ where: { projectId, ...filterWhere(f, userId) } })));
  return Object.fromEntries(filters.map((f, i) => [f, counts[i]])) as Record<TopicFilter, number>;
}

export async function getTopic(projectId: string, topicId: string) {
  return db.topic.findFirst({
    where: { id: topicId, projectId },
    include: {
      author: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, color: true } },
      task: { select: { number: true, title: true } },
      requirement: { select: { number: true, title: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, color: true } } },
      },
    },
  });
}

export async function listFaq(projectId: string, excludeId?: string) {
  return db.topic.findMany({
    where: { projectId, isFaq: true, id: excludeId ? { not: excludeId } : undefined },
    orderBy: { lastActivityAt: "desc" },
    take: 8,
    select: { id: true, title: true },
  });
}

/** 浏览数 +1（帖子详情页在响应结束后调用） */
export async function incrementTopicView(topicId: string) {
  await db.topic.update({ where: { id: topicId }, data: { viewCount: { increment: 1 } } }).catch(() => {});
}

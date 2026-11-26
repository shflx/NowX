import { Hono } from "hono";

import { projectMembersQuery } from "@/features/projects/queries";
import { runInBackground } from "@/server/context";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";
import { NotFoundError } from "@/server/http-errors";
import { requireProjectByKey } from "@/server/permissions";

import { faqQuery, incrementTopicView, topicCountsQuery, topicDetailQuery, topicListQuery } from "./queries";
import { TOPIC_FILTERS, type TopicFilter } from "./schemas";

export const routes = new Hono();

async function loadDiscussions(key: string, raw: string | undefined) {
  const filter: TopicFilter = TOPIC_FILTERS.includes(raw as TopicFilter) ? (raw as TopicFilter) : "all";
  const { user, project } = await requireProjectByKey(key);
  const { topics, counts, members } = await db
    .selectNoFrom(() => [
      jsonArrayFrom(topicListQuery(project.id, filter, user.id)).as("topics"),
      jsonObjectFrom(topicCountsQuery(project.id, user.id)).$notNull().as("counts"),
      jsonArrayFrom(projectMembersQuery(project.id)).as("members"),
    ])
    .executeTakeFirstOrThrow();
  return { user, project: { id: project.id, key: project.key }, filter, topics, counts, members };
}

export type DiscussionsPageData = Awaited<ReturnType<typeof loadDiscussions>>;

async function loadTopicPage(key: string, topicId: string) {
  const { user, project } = await requireProjectByKey(key);
  const { topic, faqs } = await db
    .selectNoFrom(() => [
      jsonObjectFrom(topicDetailQuery(project.id, topicId)).as("topic"),
      jsonArrayFrom(faqQuery(project.id, topicId)).as("faqs"),
    ])
    .executeTakeFirstOrThrow();
  if (!topic) throw new NotFoundError();

  // 响应发送后再累计浏览数，不阻塞页面
  runInBackground(() => incrementTopicView(topic.id));
  return { user, project: { id: project.id, key: project.key }, topic, faqs };
}

export type TopicPageData = Awaited<ReturnType<typeof loadTopicPage>>;

routes.get("/projects/:key/discussions", async (c) => c.json(await loadDiscussions(c.req.param("key"), c.req.query("filter"))));
routes.get("/projects/:key/discussions/:topicId", async (c) =>
  c.json(await loadTopicPage(c.req.param("key"), c.req.param("topicId"))),
);

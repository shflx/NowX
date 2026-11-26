import { Hono } from "hono";

import { tagsQuery } from "@/features/materials/queries";
import { taskFormOptionsQueries, toTaskFormOptions } from "@/features/tasks/queries";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";
import { NotFoundError } from "@/server/http-errors";
import { requireProjectByKey } from "@/server/permissions";

import { progressOf, requirementDetailQuery, requirementListQuery, requirementTopicsQuery } from "./queries";

export const routes = new Hono();

/** 需求列表与任务表单选项（一条查询） */
async function loadRequirementsPage(key: string) {
  const { user, project } = await requireProjectByKey(key);
  const { list, ...options } = await db
    .selectNoFrom(() => [jsonArrayFrom(requirementListQuery(project.id)).as("list"), ...taskFormOptionsQueries(project.id)])
    .executeTakeFirstOrThrow();
  return {
    user,
    project: { id: project.id, key: project.key, requirementSeq: project.requirementSeq },
    requirements: list.map(({ tasks, ...r }) => ({ ...r, ...progressOf(tasks) })),
    options: toTaskFormOptions(project, options),
  };
}

export type RequirementsPageData = Awaited<ReturnType<typeof loadRequirementsPage>>;

/** 需求详情：需求、相关讨论、任务表单选项与材料标签（一条查询） */
async function loadRequirementPage(key: string, number: string) {
  const { user, project } = await requireProjectByKey(key);
  const n = Number(number);
  if (!Number.isInteger(n)) throw new NotFoundError();

  const { requirement, topics, tags, ...options } = await db
    .selectNoFrom(() => [
      jsonObjectFrom(requirementDetailQuery(project.id, n)).as("requirement"),
      jsonArrayFrom(requirementTopicsQuery(project.id, n)).as("topics"),
      jsonArrayFrom(tagsQuery(project.id)).as("tags"),
      ...taskFormOptionsQueries(project.id),
    ])
    .executeTakeFirstOrThrow();
  if (!requirement) throw new NotFoundError();

  return {
    user,
    project: { id: project.id, key: project.key },
    requirement: { ...requirement, topics, ...progressOf(requirement.tasks) },
    options: toTaskFormOptions(project, options),
    tags,
  };
}

export type RequirementPageData = Awaited<ReturnType<typeof loadRequirementPage>>;

routes.get("/projects/:key/requirements", async (c) => c.json(await loadRequirementsPage(c.req.param("key"))));
routes.get("/projects/:key/requirements/:number", async (c) =>
  c.json(await loadRequirementPage(c.req.param("key"), c.req.param("number"))),
);

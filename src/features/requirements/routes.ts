import { Hono } from "hono";

import { listTags } from "@/features/materials/queries";
import { loadTaskFormOptions } from "@/features/tasks/queries";
import { NotFoundError } from "@/server/http-errors";
import { requireProjectByKey } from "@/server/permissions";

import { getRequirement, listRequirements } from "./queries";

export const routes = new Hono();

async function loadRequirementsPage(key: string) {
  const { user, project } = await requireProjectByKey(key);
  const [requirements, options] = await Promise.all([listRequirements(project.id), loadTaskFormOptions(project)]);
  return { user, project: { id: project.id, key: project.key, requirementSeq: project.requirementSeq }, requirements, options };
}

export type RequirementsPageData = Awaited<ReturnType<typeof loadRequirementsPage>>;

async function loadRequirementPage(key: string, number: string) {
  const { user, project } = await requireProjectByKey(key);
  const n = Number(number);
  if (!Number.isInteger(n)) throw new NotFoundError();

  const [requirement, options, tags] = await Promise.all([
    getRequirement(project.id, n),
    loadTaskFormOptions(project),
    listTags(project.id),
  ]);
  if (!requirement) throw new NotFoundError();
  return { user, project: { id: project.id, key: project.key }, requirement, options, tags };
}

export type RequirementPageData = Awaited<ReturnType<typeof loadRequirementPage>>;

routes.get("/projects/:key/requirements", async (c) => c.json(await loadRequirementsPage(c.req.param("key"))));
routes.get("/projects/:key/requirements/:number", async (c) =>
  c.json(await loadRequirementPage(c.req.param("key"), c.req.param("number"))),
);

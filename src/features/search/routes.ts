import { Hono } from "hono";

import { requireProjectByKey } from "@/server/permissions";

import { searchProject } from "./queries";

export const routes = new Hono();

async function loadSearch(key: string, raw: string | undefined) {
  const q = (raw ?? "").trim();
  const { project } = await requireProjectByKey(key);
  const result = q ? await searchProject(project.id, q) : null;
  return { project: { key: project.key, name: project.name }, q, result };
}

export type SearchPageData = Awaited<ReturnType<typeof loadSearch>>;

routes.get("/projects/:key/search", async (c) => c.json(await loadSearch(c.req.param("key"), c.req.query("q"))));

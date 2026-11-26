import { Hono } from "hono";

import { requireProjectByKey } from "@/server/permissions";

import { listAnnouncements } from "./queries";

export const routes = new Hono();

async function loadAnnouncements(key: string) {
  const { user, project } = await requireProjectByKey(key);
  return { user, project: { id: project.id }, announcements: await listAnnouncements(project.id) };
}

export type AnnouncementsData = Awaited<ReturnType<typeof loadAnnouncements>>;

routes.get("/projects/:key/announcements", async (c) => c.json(await loadAnnouncements(c.req.param("key"))));

import { Hono } from "hono";

import { requireUser } from "@/server/auth/dal";

import { getDashboardData } from "./queries";

export const routes = new Hono();

routes.get("/dashboard", async (c) => {
  const user = await requireUser();
  return c.json({ user, data: await getDashboardData(user) });
});

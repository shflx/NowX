import { Hono } from "hono";

import { requireUser } from "@/server/auth/dal";

import { listMyAccessTokens } from "./queries";

export const routes = new Hono();

routes.get("/account/access-tokens", async (c) => {
  const user = await requireUser();
  return c.json({ tokens: await listMyAccessTokens(user.id) });
});

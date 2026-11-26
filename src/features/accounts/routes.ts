import { Hono } from "hono";

import { listOpenProjects } from "@/features/projects/queries";
import { isAdmin, requireUser } from "@/server/auth/dal";

import { listAccounts } from "./queries";

export const routes = new Hono();

/** 账号管理（仅管理员） */
async function loadAccounts() {
  const user = await requireUser();
  if (!isAdmin(user)) return { allowed: false as const };
  const [accounts, projects] = await Promise.all([listAccounts(), listOpenProjects()]);
  return { allowed: true as const, user, accounts, projects };
}

export type AccountsData = Awaited<ReturnType<typeof loadAccounts>>;

routes.get("/admin/accounts", async (c) => c.json(await loadAccounts()));

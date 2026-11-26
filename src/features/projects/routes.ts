import { Hono } from "hono";
import { sql } from "kysely";

import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { isAdmin, requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { requireProjectByKey } from "@/server/permissions";

import { listActiveUsers, listOpenProjects, listProjectMembers, listProjectsForAdmin } from "./queries";

export const routes = new Hono();

/** 项目设置：项目信息、成员及其在进行中周期的未完成任务数（仅管理员） */
async function loadProjectSettings(key: string) {
  const { user, project } = await requireProjectByKey(key);
  if (!isAdmin(user)) return { allowed: false as const };

  const [members, taskCounts, allProjects, directory] = await Promise.all([
    listProjectMembers(project.id),
    db
      .selectFrom("Task as t")
      .innerJoin("Cycle as c", "c.id", "t.cycleId")
      .select(["t.assigneeId", sql<number>`count(*)::int`.as("count")])
      .where("t.projectId", "=", project.id)
      .where("t.status", "in", OPEN_TASK_STATUSES)
      .where("c.status", "=", "ACTIVE")
      .groupBy("t.assigneeId")
      .execute(),
    listOpenProjects(),
    listActiveUsers(),
  ]);

  return {
    allowed: true as const,
    user,
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      color: project.color,
      archived: Boolean(project.archivedAt),
    },
    members: members.map((m) => ({ ...m, activeTasks: taskCounts.find((c) => c.assigneeId === m.id)?.count ?? 0 })),
    allProjects,
    directory,
  };
}

export type ProjectSettingsData = Awaited<ReturnType<typeof loadProjectSettings>>;

/** 项目管理列表（仅管理员） */
async function loadAdminProjects() {
  const user = await requireUser();
  if (!isAdmin(user)) return { allowed: false as const };
  const [projects, directory] = await Promise.all([listProjectsForAdmin(), listActiveUsers()]);
  return { allowed: true as const, user, projects, directory };
}

export type AdminProjectsData = Awaited<ReturnType<typeof loadAdminProjects>>;

routes.get("/projects/:key/settings", async (c) => c.json(await loadProjectSettings(c.req.param("key"))));
routes.get("/admin/projects", async (c) => c.json(await loadAdminProjects()));

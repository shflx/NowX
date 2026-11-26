import { Hono } from "hono";

import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { isAdmin, requireUser } from "@/server/auth/dal";
import { countInt, db } from "@/server/db";
import { jsonArrayFrom } from "@/server/db/json";
import { requireProjectByKey } from "@/server/permissions";

import { activeUsersQuery, adminProjectsQuery, openProjectsQuery, projectMembersQuery } from "./queries";

export const routes = new Hono();

/** 项目设置：项目信息、成员及其在进行中周期的未完成任务数（仅管理员） */
async function loadProjectSettings(key: string) {
  const { user, project } = await requireProjectByKey(key);
  if (!isAdmin(user)) return { allowed: false as const };

  const { members, allProjects, directory } = await db
    .selectNoFrom(() => [
      jsonArrayFrom(
        projectMembersQuery(project.id).select((eb) =>
          eb
            .selectFrom("Task as t")
            .innerJoin("Cycle as c", "c.id", "t.cycleId")
            .select(countInt.as("n"))
            .whereRef("t.assigneeId", "=", "u.id")
            .where("t.projectId", "=", project.id)
            .where("t.status", "in", OPEN_TASK_STATUSES)
            .where("c.status", "=", "ACTIVE")
            .as("activeTasks"),
        ),
      ).as("members"),
      jsonArrayFrom(openProjectsQuery()).as("allProjects"),
      jsonArrayFrom(activeUsersQuery()).as("directory"),
    ])
    .executeTakeFirstOrThrow();

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
    members: members.map((m) => ({ ...m, activeTasks: m.activeTasks ?? 0 })),
    allProjects,
    directory,
  };
}

export type ProjectSettingsData = Awaited<ReturnType<typeof loadProjectSettings>>;

/** 项目管理列表（仅管理员） */
async function loadAdminProjects() {
  const user = await requireUser();
  if (!isAdmin(user)) return { allowed: false as const };
  const { projects, directory } = await db
    .selectNoFrom(() => [jsonArrayFrom(adminProjectsQuery()).as("projects"), jsonArrayFrom(activeUsersQuery()).as("directory")])
    .executeTakeFirstOrThrow();
  return { allowed: true as const, user, projects, directory };
}

export type AdminProjectsData = Awaited<ReturnType<typeof loadAdminProjects>>;

routes.get("/projects/:key/settings", async (c) => c.json(await loadProjectSettings(c.req.param("key"))));
routes.get("/admin/projects", async (c) => c.json(await loadAdminProjects()));

import { OPEN_TASK_STATUSES } from "@/lib/constants";
import type { CurrentUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";

/**
 * 工作台数据（跨项目）：我的任务、进行中的周期、待我回答、置顶公告、最近动态。
 * 范围是「我参与的、未归档的项目」。与日期相关的统计在页面中按当天计算。
 */
export async function getDashboardData(user: CurrentUser) {
  const myProjects = db
    .selectFrom("Project as p")
    .innerJoin("ProjectMember as m", "m.projectId", "p.id")
    .select("p.id")
    .where("p.archivedAt", "is", null)
    .where("m.userId", "=", user.id);

  const [tasks, topics, cycles, pinned, activities] = await Promise.all([
    db
      .selectFrom("Task as t")
      .innerJoin("Cycle as c", "c.id", "t.cycleId")
      .select((eb) => [
        "t.id",
        "t.number",
        "t.title",
        "t.status",
        "t.priority",
        "t.dueDate",
        jsonObjectFrom(eb.selectFrom("Project as p").select(["p.id", "p.key", "p.name"]).whereRef("p.id", "=", "t.projectId"))
          .$notNull()
          .as("project"),
      ])
      .where("t.assigneeId", "=", user.id)
      .where("t.status", "in", OPEN_TASK_STATUSES)
      .where("c.status", "=", "ACTIVE")
      .where("t.projectId", "in", myProjects)
      .orderBy("t.dueDate", (ob) => ob.asc().nullsLast())
      .orderBy("t.number", "asc")
      .execute(),
    db
      .selectFrom("Topic as o")
      .select((eb) => [
        "o.id",
        "o.title",
        "o.createdAt",
        jsonObjectFrom(eb.selectFrom("User as u").select(["u.name", "u.color"]).whereRef("u.id", "=", "o.authorId"))
          .$notNull()
          .as("author"),
        jsonObjectFrom(eb.selectFrom("Project as p").select(["p.key", "p.name"]).whereRef("p.id", "=", "o.projectId"))
          .$notNull()
          .as("project"),
      ])
      .where("o.assigneeId", "=", user.id)
      .where("o.status", "=", "OPEN")
      .where("o.projectId", "in", myProjects)
      .orderBy("o.lastActivityAt", "desc")
      .execute(),
    db
      .selectFrom("Cycle as c")
      .innerJoin("Project as p", "p.id", "c.projectId")
      .select((eb) => [
        "c.id",
        "c.name",
        "c.startDate",
        "c.endDate",
        jsonObjectFrom(eb.selectFrom("Project as x").select(["x.key", "x.name", "x.color"]).whereRef("x.id", "=", "c.projectId"))
          .$notNull()
          .as("project"),
        jsonArrayFrom(
          eb.selectFrom("Task as t").select("t.status").whereRef("t.cycleId", "=", "c.id").where("t.parentId", "is", null),
        ).as("tasks"),
      ])
      .where("c.status", "=", "ACTIVE")
      .where("c.projectId", "in", myProjects)
      .orderBy("p.createdAt", "asc")
      .execute(),
    db
      .selectFrom("Announcement as a")
      .select((eb) => [
        "a.id",
        "a.title",
        "a.createdAt",
        jsonObjectFrom(eb.selectFrom("User as u").select("u.name").whereRef("u.id", "=", "a.authorId"))
          .$notNull()
          .as("author"),
        jsonObjectFrom(eb.selectFrom("Project as p").select("p.key").whereRef("p.id", "=", "a.projectId"))
          .$notNull()
          .as("project"),
      ])
      .where("a.pinned", "=", true)
      .where("a.projectId", "in", myProjects)
      .orderBy("a.createdAt", "desc")
      .execute(),
    db
      .selectFrom("Activity as a")
      .select((eb) => [
        "a.id",
        "a.verb",
        "a.target",
        "a.href",
        "a.createdAt",
        jsonObjectFrom(eb.selectFrom("User as u").select(["u.name", "u.color"]).whereRef("u.id", "=", "a.actorId"))
          .$notNull()
          .as("actor"),
        jsonObjectFrom(eb.selectFrom("Project as p").select("p.name").whereRef("p.id", "=", "a.projectId"))
          .$notNull()
          .as("project"),
      ])
      .where("a.projectId", "in", myProjects)
      .orderBy("a.createdAt", "desc")
      .limit(6)
      .execute(),
  ]);

  return { tasks, topics, cycles, pinned, activities };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

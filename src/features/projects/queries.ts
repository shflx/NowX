import { sql } from "kysely";

import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";

export type NavProject = {
  id: string;
  key: string;
  name: string;
  color: string;
  memberCount: number;
  archived: boolean;
  /** 当前用户是否是成员（管理员可以访问非成员项目） */
  joined: boolean;
  /** 我在进行中周期里未完成的任务数 */
  myOpenTasks: number;
  /** 等我回答的帖子数 */
  waitingForMe: number;
};

/** 侧边栏与项目切换器需要的项目列表及角标数字 */
export async function listNavProjects(user: CurrentUser): Promise<NavProject[]> {
  let query = db
    .selectFrom("Project as p")
    .select((eb) => [
      "p.id",
      "p.key",
      "p.name",
      "p.color",
      eb("p.archivedAt", "is not", null).as("archived"),
      eb
        .selectFrom("ProjectMember as m")
        .select(sql<number>`count(*)::int`.as("n"))
        .whereRef("m.projectId", "=", "p.id")
        .as("memberCount"),
      eb
        .exists(eb.selectFrom("ProjectMember as m").whereRef("m.projectId", "=", "p.id").where("m.userId", "=", user.id))
        .as("joined"),
      eb
        .selectFrom("Task as t")
        .innerJoin("Cycle as c", "c.id", "t.cycleId")
        .select(sql<number>`count(*)::int`.as("n"))
        .whereRef("t.projectId", "=", "p.id")
        .where("t.assigneeId", "=", user.id)
        .where("t.status", "in", OPEN_TASK_STATUSES)
        .where("c.status", "=", "ACTIVE")
        .as("myOpenTasks"),
      eb
        .selectFrom("Topic as o")
        .select(sql<number>`count(*)::int`.as("n"))
        .whereRef("o.projectId", "=", "p.id")
        .where("o.assigneeId", "=", user.id)
        .where("o.status", "=", "OPEN")
        .as("waitingForMe"),
    ])
    .orderBy("p.createdAt", "asc");

  if (!isAdmin(user)) {
    query = query
      .where("p.archivedAt", "is", null)
      .where((eb) =>
        eb.exists(eb.selectFrom("ProjectMember as m").whereRef("m.projectId", "=", "p.id").where("m.userId", "=", user.id)),
      );
  }

  const rows = await query.execute();
  return rows.map((p) => ({
    ...p,
    memberCount: p.memberCount ?? 0,
    myOpenTasks: p.myOpenTasks ?? 0,
    waitingForMe: p.waitingForMe ?? 0,
    archived: Boolean(p.archived),
    joined: Boolean(p.joined),
  }));
}

/** 项目成员（用于各种成员选择器） */
export function listProjectMembers(projectId: string) {
  return (
    db
      .selectFrom("ProjectMember as m")
      .innerJoin("User as u", "u.id", "m.userId")
      .select(["u.id", "u.name", "u.title", "u.color", "u.status"])
      .where("m.projectId", "=", projectId)
      .orderBy("m.joinedAt", "asc")
      // 同一次添加的成员加入时间相同，按写入顺序排列
      .orderBy(sql`m.ctid`)
      .execute()
  );
}

export type ProjectMemberOption = Awaited<ReturnType<typeof listProjectMembers>>[number];

/** 全部正常状态的账号（新建项目、添加成员时选择） */
export function listActiveUsers() {
  return db
    .selectFrom("User")
    .select(["id", "name", "title", "color"])
    .where("status", "=", "ACTIVE")
    .orderBy("createdAt", "asc")
    .execute();
}

/** 未归档的项目（账号管理、成员管理中选择项目） */
export function listOpenProjects() {
  return db
    .selectFrom("Project")
    .select(["id", "key", "name", "color"])
    .where("archivedAt", "is", null)
    .orderBy("createdAt", "asc")
    .execute();
}

/** 项目管理列表（管理员）：全部项目及规模统计 */
export async function listProjectsForAdmin() {
  const count = (table: "ProjectMember" | "Task" | "Requirement" | "Topic" | "Material") =>
    sql<number>`(select count(*)::int from ${sql.table(table)} x where x."projectId" = p.id)`;

  const rows = await db
    .selectFrom("Project as p")
    .selectAll("p")
    .select((eb) => [
      count("ProjectMember").as("members"),
      count("Task").as("tasks"),
      count("Requirement").as("requirements"),
      count("Topic").as("topics"),
      count("Material").as("materials"),
      eb
        .selectFrom("Cycle as c")
        .select("c.name")
        .whereRef("c.projectId", "=", "p.id")
        .where("c.status", "=", "ACTIVE")
        .limit(1)
        .as("activeCycle"),
    ])
    .orderBy(sql`p."archivedAt" asc nulls first`)
    .orderBy("p.createdAt", "asc")
    .execute();

  return rows.map(({ members, tasks, requirements, topics, materials, ...p }) => ({
    ...p,
    _count: { members, tasks, requirements, topics, materials },
  }));
}

export type AdminProjectRow = Awaited<ReturnType<typeof listProjectsForAdmin>>[number];

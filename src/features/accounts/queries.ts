import { sql } from "kysely";

import { db } from "@/server/db";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "@/server/db/json";

/** 账号在各类协作记录中的数量：有任何记录的账号不能删除，只能停用 */
export function usageCounts() {
  const count = (table: string, column: string) =>
    sql<number>`(select count(*)::int from ${sql.table(table)} x where x.${sql.ref(column)} = "User".id)`;
  return jsonBuildObject({
    createdTasks: count("Task", "creatorId"),
    assignedTasks: count("Task", "assigneeId"),
    comments: count("TaskComment", "authorId"),
    topics: count("Topic", "authorId"),
    replies: count("Reply", "authorId"),
    materials: count("Material", "uploaderId"),
    announcements: count("Announcement", "authorId"),
    activities: count("Activity", "actorId"),
  });
}

/** 账号管理列表（不含密码哈希）；返回查询，由页面接口合并执行 */
export function accountsQuery() {
  return db
    .selectFrom("User")
    .select((eb) => [
      "User.id",
      "User.login",
      "User.name",
      "User.title",
      "User.role",
      "User.status",
      "User.color",
      "User.mustChangePassword",
      "User.lastLoginAt",
      usageCounts().as("_count"),
      jsonArrayFrom(
        eb
          .selectFrom("ProjectMember as m")
          .select((member) => [
            jsonObjectFrom(
              member
                .selectFrom("Project as p")
                .select(["p.id", "p.key", "p.name", "p.color"])
                .whereRef("p.id", "=", "m.projectId"),
            )
              .$notNull()
              .as("project"),
          ])
          .whereRef("m.userId", "=", "User.id")
          .orderBy("m.joinedAt", "asc")
          // 同一次添加的成员关系加入时间相同，按写入顺序排列
          .orderBy(sql`m.ctid`),
      ).as("memberships"),
    ])
    .orderBy("User.createdAt", "asc");
}

export type AccountRow = Awaited<ReturnType<ReturnType<typeof accountsQuery>["execute"]>>[number];

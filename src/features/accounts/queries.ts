import { sql } from "kysely";

import { db } from "@/server/db";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";

/** 账号在各类协作记录中的数量：有任何记录的账号不能删除，只能停用 */
export function usageCounts() {
  const count = (table: string, column: string) =>
    sql<number>`(select count(*)::int from ${sql.table(table)} x where x.${sql.ref(column)} = "User".id)`;
  return [
    count("Task", "creatorId").as("createdTasks"),
    count("Task", "assigneeId").as("assignedTasks"),
    count("TaskComment", "authorId").as("comments"),
    count("Topic", "authorId").as("topics"),
    count("Reply", "authorId").as("replies"),
    count("Material", "uploaderId").as("materials"),
    count("Announcement", "authorId").as("announcements"),
    count("Activity", "actorId").as("activities"),
  ];
}

/** 账号管理列表（不含密码哈希） */
export async function listAccounts() {
  const rows = await db
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
      ...usageCounts(),
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
    .orderBy("User.createdAt", "asc")
    .execute();

  return rows.map(
    ({ createdTasks, assignedTasks, comments, topics, replies, materials, announcements, activities, ...user }) => ({
      ...user,
      _count: { createdTasks, assignedTasks, comments, topics, replies, materials, announcements, activities },
    }),
  );
}

export type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number];

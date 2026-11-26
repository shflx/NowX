import { db } from "@/server/db";
import { jsonObjectFrom } from "@/server/db/json";

/** 公告列表：置顶在前，其余按时间倒序 */
export function listAnnouncements(projectId: string) {
  return db
    .selectFrom("Announcement as a")
    .selectAll("a")
    .select((eb) => [
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "a.authorId"))
        .$notNull()
        .as("author"),
    ])
    .where("a.projectId", "=", projectId)
    .orderBy("a.pinned", "desc")
    .orderBy("a.createdAt", "desc")
    .execute();
}

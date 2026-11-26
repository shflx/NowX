import { sql } from "kysely";

import { db } from "@/server/db";

/** 最近的通知与未读数（顶栏铃铛使用） */
export async function getNotificationSummary(userId: string) {
  const [items, { unread }] = await Promise.all([
    db
      .selectFrom("Notification")
      .select(["id", "text", "href", "readAt", "createdAt"])
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc")
      .limit(20)
      .execute(),
    db
      .selectFrom("Notification")
      .select(sql<number>`count(*)::int`.as("unread"))
      .where("userId", "=", userId)
      .where("readAt", "is", null)
      .executeTakeFirstOrThrow(),
  ]);
  return { items, unread };
}

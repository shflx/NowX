import { countInt, db } from "@/server/db";

// 以下函数返回查询（不执行），由页面接口合并为一条 SQL 后执行

/** 最近的通知（顶栏铃铛使用） */
export function recentNotificationsQuery(userId: string) {
  return db
    .selectFrom("Notification")
    .select(["id", "text", "href", "readAt", "createdAt"])
    .where("userId", "=", userId)
    .orderBy("createdAt", "desc")
    .limit(20);
}

/** 未读通知数 */
export function unreadCountQuery(userId: string) {
  return db.selectFrom("Notification").select(countInt.as("n")).where("userId", "=", userId).where("readAt", "is", null);
}

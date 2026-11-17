import "server-only";

import { db } from "@/server/db";

/** 最近的通知与未读数（顶栏铃铛使用） */
export async function getNotificationSummary(userId: string) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

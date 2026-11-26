import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  // 带上 userId 条件，防止标记别人的通知
  await db
    .updateTable("Notification")
    .set({ readAt: new Date() })
    .where("id", "=", id)
    .where("userId", "=", user.id)
    .where("readAt", "is", null)
    .execute();
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db
    .updateTable("Notification")
    .set({ readAt: new Date() })
    .where("userId", "=", user.id)
    .where("readAt", "is", null)
    .execute();
}

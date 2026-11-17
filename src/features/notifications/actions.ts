"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { db } from "@/server/db";

export async function markNotificationRead(id: string) {
  return runAction(async () => {
    const user = await requireUser();
    // 带上 userId 条件，防止标记别人的通知
    await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
    refresh();
  });
}

export async function markAllNotificationsRead() {
  return runAction(async () => {
    const user = await requireUser();
    await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    refresh();
  });
}

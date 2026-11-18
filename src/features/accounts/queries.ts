import "server-only";

import { db } from "@/server/db";

/** 账号管理列表（不含密码哈希） */
export async function listAccounts() {
  return db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      login: true,
      name: true,
      title: true,
      role: true,
      status: true,
      color: true,
      mustChangePassword: true,
      lastLoginAt: true,
      // 有任何协作记录的账号不能删除，只能停用
      _count: {
        select: {
          createdTasks: true,
          assignedTasks: true,
          comments: true,
          topics: true,
          replies: true,
          materials: true,
          announcements: true,
          activities: true,
        },
      },
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: { project: { select: { id: true, key: true, name: true, color: true } } },
      },
    },
  });
}

export type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number];

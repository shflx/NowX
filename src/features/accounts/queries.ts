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
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: { project: { select: { id: true, key: true, name: true, color: true } } },
      },
    },
  });
}

export type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number];

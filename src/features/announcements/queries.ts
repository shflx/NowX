import "server-only";

import { db } from "@/server/db";

/** 公告列表：置顶在前，其余按时间倒序 */
export async function listAnnouncements(projectId: string) {
  return db.announcement.findMany({
    where: { projectId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { id: true, name: true, color: true } } },
  });
}

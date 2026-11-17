import "server-only";

import { db } from "@/server/db";

export async function listMaterials(projectId: string, tagId?: string) {
  return db.material.findMany({
    where: { projectId, ...(tagId ? { tags: { some: { tagId } } } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      uploader: { select: { id: true, name: true, color: true } },
      requirement: { select: { number: true, title: true } },
      tags: { select: { tag: true } },
    },
  });
}

export async function listTags(projectId: string) {
  return db.tag.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: { _count: { select: { materials: true } } },
  });
}

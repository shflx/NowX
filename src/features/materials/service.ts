import "server-only";

import { TAG_COLOR_KEYS } from "@/lib/constants";
import { db } from "@/server/db";

/** 按名称查找项目标签，不存在则创建（颜色按顺序轮换） */
export async function findOrCreateTag(projectId: string, name: string) {
  const existing = await db.tag.findUnique({ where: { projectId_name: { projectId, name } } });
  if (existing) return existing;
  const count = await db.tag.count({ where: { projectId } });
  return db.tag.create({ data: { projectId, name, color: TAG_COLOR_KEYS[count % TAG_COLOR_KEYS.length] } });
}

/** 过滤出属于该项目的标签 ID，防止跨项目挂标签 */
export async function validTagIds(projectId: string, tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const tags = await db.tag.findMany({ where: { projectId, id: { in: tagIds } }, select: { id: true } });
  return tags.map((t) => t.id);
}

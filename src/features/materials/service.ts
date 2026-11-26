import { sql } from "kysely";

import { TAG_COLOR_KEYS } from "@/lib/constants";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";

/** 按名称查找项目标签，不存在则创建（颜色按顺序轮换） */
export async function findOrCreateTag(projectId: string, name: string) {
  const existing = await db
    .selectFrom("Tag")
    .selectAll()
    .where("projectId", "=", projectId)
    .where("name", "=", name)
    .executeTakeFirst();
  if (existing) return existing;
  const { count } = await db
    .selectFrom("Tag")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("projectId", "=", projectId)
    .executeTakeFirstOrThrow();
  return db
    .insertInto("Tag")
    .values({ id: cuid(), projectId, name, color: TAG_COLOR_KEYS[count % TAG_COLOR_KEYS.length] })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** 过滤出属于该项目的标签 ID，防止跨项目挂标签 */
export async function validTagIds(projectId: string, tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const tags = await db.selectFrom("Tag").select("id").where("projectId", "=", projectId).where("id", "in", tagIds).execute();
  return tags.map((t) => t.id);
}

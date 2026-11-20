import "server-only";

import { db } from "@/server/db";

/** 每类结果最多返回的条数 */
const RESULT_LIMIT = 20;

/** 项目内全文检索（标题 / 正文模糊匹配，数据量小，直接用 ILIKE） */
export async function searchProject(projectId: string, q: string) {
  const text = { contains: q, mode: "insensitive" as const };
  const number = Number(q.replace(/^[A-Za-z]+-/, ""));
  const byNumber = Number.isInteger(number) && number > 0 ? [{ number }] : [];

  const [tasks, requirements, topics, materials] = await Promise.all([
    db.task.findMany({
      where: { projectId, OR: [{ title: text }, { description: text }, ...byNumber] },
      orderBy: { number: "desc" },
      take: RESULT_LIMIT,
      select: { id: true, number: true, title: true, status: true },
    }),
    db.requirement.findMany({
      where: { projectId, OR: [{ title: text }, { summary: text }, ...byNumber] },
      orderBy: { number: "desc" },
      take: RESULT_LIMIT,
      select: { id: true, number: true, title: true, status: true },
    }),
    db.topic.findMany({
      where: { projectId, OR: [{ title: text }, { body: text }, { replies: { some: { body: text } } }] },
      orderBy: { lastActivityAt: "desc" },
      take: RESULT_LIMIT,
      select: { id: true, title: true, status: true, isFaq: true },
    }),
    db.material.findMany({
      where: { projectId, name: text },
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT,
      select: { id: true, name: true, kind: true, url: true, docType: true },
    }),
  ]);

  return { tasks, requirements, topics, materials, total: tasks.length + requirements.length + topics.length + materials.length };
}

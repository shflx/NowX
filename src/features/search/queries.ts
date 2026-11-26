import { db } from "@/server/db";

/** 每类结果最多返回的条数 */
const RESULT_LIMIT = 20;

/** 项目内全文检索（标题 / 正文模糊匹配，数据量小，直接用 ILIKE） */
export async function searchProject(projectId: string, q: string) {
  const text = `%${q}%`;
  const number = Number(q.replace(/^[A-Za-z]+-/, ""));
  const byNumber = Number.isInteger(number) && number > 0 ? number : null;

  const [tasks, requirements, topics, materials] = await Promise.all([
    db
      .selectFrom("Task")
      .select(["id", "number", "title", "status"])
      .where("projectId", "=", projectId)
      .where((eb) =>
        eb.or([eb("title", "ilike", text), eb("description", "ilike", text), ...(byNumber ? [eb("number", "=", byNumber)] : [])]),
      )
      .orderBy("number", "desc")
      .limit(RESULT_LIMIT)
      .execute(),
    db
      .selectFrom("Requirement")
      .select(["id", "number", "title", "status"])
      .where("projectId", "=", projectId)
      .where((eb) =>
        eb.or([eb("title", "ilike", text), eb("summary", "ilike", text), ...(byNumber ? [eb("number", "=", byNumber)] : [])]),
      )
      .orderBy("number", "desc")
      .limit(RESULT_LIMIT)
      .execute(),
    db
      .selectFrom("Topic as o")
      .select(["o.id", "o.title", "o.status", "o.isFaq"])
      .where("o.projectId", "=", projectId)
      .where((eb) =>
        eb.or([
          eb("o.title", "ilike", text),
          eb("o.body", "ilike", text),
          eb.exists(eb.selectFrom("Reply as r").whereRef("r.topicId", "=", "o.id").where("r.body", "ilike", text)),
        ]),
      )
      .orderBy("o.lastActivityAt", "desc")
      .limit(RESULT_LIMIT)
      .execute(),
    db
      .selectFrom("Material")
      .select(["id", "name", "kind", "url", "docType"])
      .where("projectId", "=", projectId)
      .where("name", "ilike", text)
      .orderBy("createdAt", "desc")
      .limit(RESULT_LIMIT)
      .execute(),
  ]);

  return { tasks, requirements, topics, materials, total: tasks.length + requirements.length + topics.length + materials.length };
}

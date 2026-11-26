import { ASSISTANT_MENTION, ASSISTANT_NAME } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { jsonArrayFrom, jsonObjectFrom } from "@/server/db/json";
import { publishProjectChange } from "@/server/events";
import { notify } from "@/server/notifications";

import { askAssistant } from "./service";

const AUTHOR_FIELDS = ["u.id", "u.login", "u.name", "u.title", "u.role", "u.color"] as const;

/**
 * 帖子中 @项目助手 时，由助手查找相关的任务、材料与 FAQ 并回复。
 * 以「最后一个 @ 助手的人」的身份和权限查询；在响应之后执行，不阻塞发帖请求。
 */
export async function replyAsAssistant(topicId: string) {
  try {
    const topic = await db
      .selectFrom("Topic as o")
      .selectAll("o")
      .select((eb) => [
        jsonObjectFrom(eb.selectFrom("Project as p").select(["p.id", "p.key", "p.name"]).whereRef("p.id", "=", "o.projectId"))
          .$notNull()
          .as("project"),
        jsonObjectFrom(eb.selectFrom("User as u").select(AUTHOR_FIELDS).whereRef("u.id", "=", "o.authorId"))
          .$notNull()
          .as("author"),
        jsonArrayFrom(
          eb
            .selectFrom("Reply as r")
            .select((r) => [
              "r.body",
              "r.isAssistant",
              jsonObjectFrom(r.selectFrom("User as u").select(AUTHOR_FIELDS).whereRef("u.id", "=", "r.authorId")).as("author"),
            ])
            .whereRef("r.topicId", "=", "o.id")
            .orderBy("r.createdAt", "asc"),
        ).as("replies"),
      ])
      .where("o.id", "=", topicId)
      .executeTakeFirst();
    if (!topic) return;

    const summoner =
      [...topic.replies].reverse().find((r) => r.author && r.body.includes(ASSISTANT_MENTION))?.author ?? topic.author;
    const thread = topic.replies
      .map((r) => `${r.isAssistant ? ASSISTANT_NAME : (r.author?.name ?? "成员")}：${r.body}`)
      .join("\n\n");

    const answer = await askAssistant({
      user: { ...summoner, mustChangePassword: false },
      project: topic.project,
      history: [
        {
          role: "user",
          content: `交流区帖子中有人 @ 了你，请根据项目数据给出有帮助的回复（不要重复帖子内容；没有依据时说明并建议由相关成员解答）。\n\n标题：${topic.title}\n提问者：${topic.author.name}\n正文：${topic.body}${thread ? `\n\n已有回复：\n${thread}` : ""}`,
        },
      ],
    });

    await db.transaction().execute(async (tx) => {
      await tx.insertInto("Reply").values({ id: cuid(), topicId, isAssistant: true, body: answer }).execute();
      await tx.updateTable("Topic").set({ lastActivityAt: new Date() }).where("id", "=", topicId).execute();
    });
    await notify({
      userIds: [summoner.id],
      actorId: "assistant",
      text: `项目助手回复了帖子「${topic.title}」`,
      href: routes.topic(topic.project.key, topicId),
    });
    publishProjectChange(topic.project.id);
  } catch (error) {
    console.error("[assistant] 帖子自动回复失败", error);
  }
}

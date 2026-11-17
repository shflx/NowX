import "server-only";

import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { notify } from "@/server/notifications";

import { askAssistant } from "./service";

/**
 * 帖子中 @项目助手 时，由助手查找相关的任务、材料与 FAQ 并回复。
 * 以「最后一个 @ 助手的人」的身份和权限查询；在 after() 中执行，不阻塞发帖请求。
 */
export async function replyAsAssistant(topicId: string) {
  try {
    const topic = await db.topic.findUnique({
      where: { id: topicId },
      include: {
        project: { select: { id: true, key: true, name: true } },
        author: true,
        replies: { orderBy: { createdAt: "asc" }, include: { author: true } },
      },
    });
    if (!topic) return;

    const summoner =
      [...topic.replies].reverse().find((r) => r.author && r.body.includes("@项目助手"))?.author ?? topic.author;
    const thread = topic.replies
      .map((r) => `${r.isAssistant ? "项目助手" : (r.author?.name ?? "成员")}：${r.body}`)
      .join("\n\n");

    const answer = await askAssistant({
      user: { ...summoner, role: summoner.role, mustChangePassword: false },
      project: topic.project,
      history: [
        {
          role: "user",
          content: `交流区帖子中有人 @ 了你，请根据项目数据给出有帮助的回复（不要重复帖子内容；没有依据时说明并建议由相关成员解答）。\n\n标题：${topic.title}\n提问者：${topic.author.name}\n正文：${topic.body}${thread ? `\n\n已有回复：\n${thread}` : ""}`,
        },
      ],
    });

    await db.$transaction([
      db.reply.create({ data: { topicId, isAssistant: true, body: answer } }),
      db.topic.update({ where: { id: topicId }, data: { lastActivityAt: new Date() } }),
    ]);
    await notify({
      userIds: [summoner.id],
      actorId: "assistant",
      text: `项目助手回复了帖子「${topic.title}」`,
      href: `/projects/${topic.project.key}/discussions/${topicId}`,
    });
    publishProjectChange(topic.project.id);
  } catch (error) {
    console.error("[assistant] 帖子自动回复失败", error);
  }
}

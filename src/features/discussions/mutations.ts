import { replyAsAssistant } from "@/features/assistant/topic-reply";
import { ActionError, parseInput } from "@/lib/action-result";
import { ASSISTANT_MENTION } from "@/lib/constants";
import { requirementCode, taskCode } from "@/lib/format";
import { routes } from "@/lib/routes";
import { sharesKeyword } from "@/lib/text";
import { recordActivity } from "@/server/activity";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { runInBackground } from "@/server/context";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publishProjectChange } from "@/server/events";
import { findMentionedMembers, notify } from "@/server/notifications";
import { assertMembers, requireProjectAccess } from "@/server/permissions";

import { replySchema, topicSchema } from "./schemas";

/** 帖子管理权限：作者、指定回答人、管理员 */
const canManage = (user: CurrentUser, topic: { authorId: string; assigneeId: string | null }) =>
  topic.authorId === user.id || topic.assigneeId === user.id || isAdmin(user);

/** 正文 @项目助手 时，在响应返回后由助手补充回复 */
function maybeSummonAssistant(topicId: string, text: string) {
  if (appConfig.assistantEnabled && text.includes(ASSISTANT_MENTION)) {
    runInBackground(() => replyAsAssistant(topicId));
  }
}

async function loadTopic(topicId: string) {
  const topic = await db.selectFrom("Topic").selectAll().where("id", "=", topicId).executeTakeFirst();
  if (!topic) throw new ActionError("帖子不存在");
  const access = await requireProjectAccess(topic.projectId);
  return { topic, ...access };
}

const belongsTo = (table: "Task" | "Requirement", id: string, projectId: string) =>
  db.selectFrom(table).select("id").where("id", "=", id).where("projectId", "=", projectId).executeTakeFirst();

export async function createTopic(projectId: string, input: unknown) {
  const { user, project } = await requireProjectAccess(projectId);
  const data = parseInput(topicSchema, input);
  await assertMembers(projectId, [data.assigneeId]);

  // 解析并校验关联对象属于本项目
  let taskId: string | null = null;
  let requirementId: string | null = null;
  if (data.link) {
    const [type, id] = data.link.split(":");
    if (type === "task" && (await belongsTo("Task", id, projectId))) taskId = id;
    else if (type === "req" && (await belongsTo("Requirement", id, projectId))) requirementId = id;
    else throw new ActionError("关联的任务或需求不存在");
  }

  const topic = await db
    .insertInto("Topic")
    .values({
      id: cuid(),
      projectId,
      title: data.title,
      body: data.body,
      authorId: user.id,
      assigneeId: data.assigneeId,
      taskId,
      requirementId,
    })
    .returning(["id", "title"])
    .executeTakeFirstOrThrow();
  const href = routes.topic(project.key, topic.id);

  await recordActivity({ projectId, actorId: user.id, verb: "在交流区提问", target: topic.title, href });
  await notify({ userIds: [data.assigneeId], actorId: user.id, text: `${user.name} 在交流区向你提问：${topic.title}`, href });
  const mentioned = await findMentionedMembers(projectId, data.body);
  await notify({ userIds: mentioned, actorId: user.id, text: `${user.name} 在帖子「${topic.title}」中提到了你`, href });

  maybeSummonAssistant(topic.id, data.body);
  publishProjectChange(projectId);
  return { id: topic.id };
}

export async function replyToTopic(topicId: string, input: unknown) {
  const { topic, user, project } = await loadTopic(topicId);
  const data = parseInput(replySchema, input);
  if (topic.status === "CLOSED") throw new ActionError("帖子已关闭，不能回复");

  const solve = data.markSolved && canManage(user, topic);
  await db.transaction().execute(async (tx) => {
    await tx.insertInto("Reply").values({ id: cuid(), topicId, authorId: user.id, body: data.body }).execute();
    await tx
      .updateTable("Topic")
      .set({ lastActivityAt: new Date(), ...(solve ? { status: "SOLVED" as const } : {}) })
      .where("id", "=", topicId)
      .execute();
  });

  const href = routes.topic(project.key, topicId);
  const mentioned = await findMentionedMembers(topic.projectId, data.body);
  await notify({
    userIds: [topic.authorId, topic.assigneeId].filter((id) => id && !mentioned.includes(id)),
    actorId: user.id,
    text: `${user.name} 回复了帖子「${topic.title}」`,
    href,
  });
  await notify({ userIds: mentioned, actorId: user.id, text: `${user.name} 在帖子「${topic.title}」中提到了你`, href });

  maybeSummonAssistant(topicId, data.body);
  publishProjectChange(topic.projectId);
}

/** 采纳答案：同一帖子只保留一个采纳，并标记为已解决 */
export async function acceptReply(replyId: string) {
  const reply = await db.selectFrom("Reply").selectAll().where("id", "=", replyId).executeTakeFirst();
  if (!reply) throw new ActionError("回复不存在");
  const { topic, user, project } = await loadTopic(reply.topicId);
  if (!canManage(user, topic)) throw new ActionError("只有提问者、指定回答人或管理员可以采纳答案");

  await db.transaction().execute(async (tx) => {
    await tx.updateTable("Reply").set({ isAccepted: false }).where("topicId", "=", topic.id).execute();
    await tx.updateTable("Reply").set({ isAccepted: true }).where("id", "=", replyId).execute();
    await tx.updateTable("Topic").set({ status: "SOLVED", lastActivityAt: new Date() }).where("id", "=", topic.id).execute();
  });
  await notify({
    userIds: [reply.authorId],
    actorId: user.id,
    text: `你在「${topic.title}」中的回答被采纳了`,
    href: routes.topic(project.key, topic.id),
  });
  publishProjectChange(topic.projectId);
}

export async function setTopicFaq(topicId: string, isFaq: boolean) {
  const { topic, user } = await loadTopic(topicId);
  if (!canManage(user, topic)) throw new ActionError("只有提问者、指定回答人或管理员可以设置 FAQ");
  await db.updateTable("Topic").set({ isFaq }).where("id", "=", topicId).execute();
  publishProjectChange(topic.projectId);
}

/** 关闭 / 重新打开帖子 */
export async function setTopicStatus(topicId: string, status: "OPEN" | "CLOSED") {
  const { topic, user } = await loadTopic(topicId);
  if (!canManage(user, topic)) throw new ActionError("只有提问者、指定回答人或管理员可以操作");
  await db.updateTable("Topic").set({ status }).where("id", "=", topicId).execute();
  publishProjectChange(topic.projectId);
}

/** 发帖时推荐相似的已解决帖子 / FAQ */
export async function suggestSimilarTopics(projectId: string, title: string) {
  await requireProjectAccess(projectId);
  if (title.trim().length < 2) return [];
  const candidates = await db
    .selectFrom("Topic")
    .select(["id", "title", "isFaq"])
    .where("projectId", "=", projectId)
    .where((eb) => eb.or([eb("status", "=", "SOLVED"), eb("isFaq", "=", true)]))
    .orderBy("isFaq", "desc")
    .orderBy("lastActivityAt", "desc")
    .limit(200)
    .execute();
  return candidates.filter((t) => sharesKeyword(title, t.title)).slice(0, 3);
}

/** 发帖时「关联任务 / 需求」的候选项 */
export async function getTopicLinkOptions(projectId: string) {
  const { project } = await requireProjectAccess(projectId);
  const [requirements, tasks] = await Promise.all([
    db
      .selectFrom("Requirement")
      .select(["id", "number", "title"])
      .where("projectId", "=", projectId)
      .orderBy("number", "desc")
      .execute(),
    db
      .selectFrom("Task")
      .select(["id", "number", "title"])
      .where("projectId", "=", projectId)
      .where("parentId", "is", null)
      .orderBy("number", "desc")
      .limit(300)
      .execute(),
  ]);
  return [
    ...requirements.map((r) => ({ value: `req:${r.id}`, kind: "需求", code: requirementCode(r.number), title: r.title })),
    ...tasks.map((t) => ({ value: `task:${t.id}`, kind: "任务", code: taskCode(project.key, t.number), title: t.title })),
  ];
}

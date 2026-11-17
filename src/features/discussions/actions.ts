"use server";

import { refresh } from "next/cache";
import { after } from "next/server";

import { ActionError, parseInput } from "@/lib/action-result";
import { requirementCode, taskCode } from "@/lib/format";
import { sharesKeyword } from "@/lib/text";
import { replyAsAssistant } from "@/features/assistant/topic-reply";
import { recordActivity } from "@/server/activity";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { appConfig } from "@/server/config";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { findMentionedMembers, notify } from "@/server/notifications";
import { assertMembers, requireProjectAccess } from "@/server/permissions";

import { replySchema, topicSchema } from "./schemas";

/** 帖子管理权限：作者、指定回答人、管理员 */
const canManage = (user: CurrentUser, topic: { authorId: string; assigneeId: string | null }) =>
  topic.authorId === user.id || topic.assigneeId === user.id || isAdmin(user);

const topicHref = (projectKey: string, topicId: string) => `/projects/${projectKey}/discussions/${topicId}`;

/** 正文 @项目助手 时，在响应返回后由助手补充回复 */
function maybeSummonAssistant(topicId: string, text: string) {
  if (appConfig.assistantEnabled && text.includes("@项目助手")) {
    after(() => replyAsAssistant(topicId));
  }
}

async function loadTopic(topicId: string) {
  const topic = await db.topic.findUnique({ where: { id: topicId } });
  if (!topic) throw new ActionError("帖子不存在");
  const access = await requireProjectAccess(topic.projectId);
  return { topic, ...access };
}

export async function createTopic(projectId: string, input: unknown) {
  return runAction(async () => {
    const { user, project } = await requireProjectAccess(projectId);
    const data = parseInput(topicSchema, input);
    await assertMembers(projectId, [data.assigneeId]);

    // 解析并校验关联对象属于本项目
    let taskId: string | null = null;
    let requirementId: string | null = null;
    if (data.link) {
      const [type, id] = data.link.split(":");
      if (type === "task" && (await db.task.findFirst({ where: { id, projectId } }))) taskId = id;
      else if (type === "req" && (await db.requirement.findFirst({ where: { id, projectId } }))) requirementId = id;
      else throw new ActionError("关联的任务或需求不存在");
    }

    const topic = await db.topic.create({
      data: { projectId, title: data.title, body: data.body, authorId: user.id, assigneeId: data.assigneeId, taskId, requirementId },
    });
    const href = topicHref(project.key, topic.id);

    await recordActivity({ projectId, actorId: user.id, verb: "在交流区提问", target: topic.title, href });
    await notify({ userIds: [data.assigneeId], actorId: user.id, text: `${user.name} 在交流区向你提问：${topic.title}`, href });
    const mentioned = await findMentionedMembers(projectId, data.body);
    await notify({ userIds: mentioned, actorId: user.id, text: `${user.name} 在帖子「${topic.title}」中提到了你`, href });

    maybeSummonAssistant(topic.id, data.body);
    publishProjectChange(projectId);
    return { id: topic.id };
  });
}

export async function replyToTopic(topicId: string, input: unknown) {
  return runAction(async () => {
    const { topic, user, project } = await loadTopic(topicId);
    const data = parseInput(replySchema, input);
    if (topic.status === "CLOSED") throw new ActionError("帖子已关闭，不能回复");

    const solve = data.markSolved && canManage(user, topic);
    await db.$transaction([
      db.reply.create({ data: { topicId, authorId: user.id, body: data.body } }),
      db.topic.update({ where: { id: topicId }, data: { lastActivityAt: new Date(), ...(solve ? { status: "SOLVED" } : {}) } }),
    ]);

    const href = topicHref(project.key, topicId);
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
    refresh();
  });
}

/** 采纳答案：同一帖子只保留一个采纳，并标记为已解决 */
export async function acceptReply(replyId: string) {
  return runAction(async () => {
    const reply = await db.reply.findUnique({ where: { id: replyId } });
    if (!reply) throw new ActionError("回复不存在");
    const { topic, user, project } = await loadTopic(reply.topicId);
    if (!canManage(user, topic)) throw new ActionError("只有提问者、指定回答人或管理员可以采纳答案");

    await db.$transaction([
      db.reply.updateMany({ where: { topicId: topic.id }, data: { isAccepted: false } }),
      db.reply.update({ where: { id: replyId }, data: { isAccepted: true } }),
      db.topic.update({ where: { id: topic.id }, data: { status: "SOLVED", lastActivityAt: new Date() } }),
    ]);
    await notify({
      userIds: [reply.authorId],
      actorId: user.id,
      text: `你在「${topic.title}」中的回答被采纳了`,
      href: topicHref(project.key, topic.id),
    });
    publishProjectChange(topic.projectId);
    refresh();
  });
}

export async function setTopicFaq(topicId: string, isFaq: boolean) {
  return runAction(async () => {
    const { topic, user } = await loadTopic(topicId);
    if (!canManage(user, topic)) throw new ActionError("只有提问者、指定回答人或管理员可以设置 FAQ");
    await db.topic.update({ where: { id: topicId }, data: { isFaq } });
    publishProjectChange(topic.projectId);
    refresh();
  });
}

/** 关闭 / 重新打开帖子 */
export async function setTopicStatus(topicId: string, status: "OPEN" | "CLOSED") {
  return runAction(async () => {
    const { topic, user } = await loadTopic(topicId);
    if (!canManage(user, topic)) throw new ActionError("只有提问者、指定回答人或管理员可以操作");
    await db.topic.update({ where: { id: topicId }, data: { status } });
    publishProjectChange(topic.projectId);
    refresh();
  });
}

/** 发帖时推荐相似的已解决帖子 / FAQ */
export async function suggestSimilarTopics(projectId: string, title: string) {
  return runAction(async () => {
    await requireProjectAccess(projectId);
    if (title.trim().length < 2) return [];
    const candidates = await db.topic.findMany({
      where: { projectId, OR: [{ status: "SOLVED" }, { isFaq: true }] },
      orderBy: [{ isFaq: "desc" }, { lastActivityAt: "desc" }],
      take: 200,
      select: { id: true, title: true, isFaq: true },
    });
    return candidates.filter((t) => sharesKeyword(title, t.title)).slice(0, 3);
  });
}

/** 发帖时「关联任务 / 需求」的候选项 */
export async function getTopicLinkOptions(projectId: string) {
  return runAction(async () => {
    const { project } = await requireProjectAccess(projectId);
    const [requirements, tasks] = await Promise.all([
      db.requirement.findMany({ where: { projectId }, orderBy: { number: "desc" }, select: { id: true, number: true, title: true } }),
      db.task.findMany({
        where: { projectId, parentId: null },
        orderBy: { number: "desc" },
        take: 300,
        select: { id: true, number: true, title: true },
      }),
    ]);
    return [
      ...requirements.map((r) => ({ value: `req:${r.id}`, kind: "需求", code: requirementCode(r.number), title: r.title })),
      ...tasks.map((t) => ({ value: `task:${t.id}`, kind: "任务", code: taskCode(project.key, t.number), title: t.title })),
    ];
  });
}

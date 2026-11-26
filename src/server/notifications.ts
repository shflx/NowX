import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publish, userChannel } from "@/server/events";

type NotifyInput = {
  /** 接收人；会自动去重并排除操作者本人 */
  userIds: (string | null | undefined)[];
  actorId: string;
  text: string;
  href: string;
};

/** 创建站内通知并实时推送给在线的接收人 */
export async function notify({ userIds, actorId, text, href }: NotifyInput) {
  const targets = [...new Set(userIds)].filter((id): id is string => Boolean(id) && id !== actorId);
  if (targets.length === 0) return;

  await db
    .insertInto("Notification")
    .values(targets.map((userId) => ({ id: cuid(), userId, text, href })))
    .execute();
  for (const userId of targets) publish(userChannel(userId));
}

/** 从文本中解析 @姓名，返回项目内被提及的成员 ID */
export async function findMentionedMembers(projectId: string, text: string) {
  if (!text.includes("@")) return [];
  const members = await db
    .selectFrom("ProjectMember")
    .innerJoin("User", "User.id", "ProjectMember.userId")
    .select(["User.id", "User.name"])
    .where("ProjectMember.projectId", "=", projectId)
    .execute();
  return members.filter((user) => text.includes(`@${user.name}`)).map((user) => user.id);
}

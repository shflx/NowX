import { ActionError, parseInput } from "@/lib/action-result";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import { isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publishProjectChange } from "@/server/events";
import { notify } from "@/server/notifications";
import { requireProjectAccess } from "@/server/permissions";

import { announcementSchema } from "./schemas";

async function loadAnnouncement(announcementId: string) {
  const announcement = await db.selectFrom("Announcement").selectAll().where("id", "=", announcementId).executeTakeFirst();
  if (!announcement) throw new ActionError("公告不存在");
  return announcement;
}

/** 发布公告：项目成员都可以发布并置顶；发布后通知项目全员 */
export async function publishAnnouncement(projectId: string, input: unknown) {
  const { user, project } = await requireProjectAccess(projectId);
  const data = parseInput(announcementSchema, input);

  const announcement = await db
    .insertInto("Announcement")
    .values({ id: cuid(), projectId, title: data.title, body: data.body, pinned: data.pinned, authorId: user.id })
    .returning("title")
    .executeTakeFirstOrThrow();
  const href = routes.announcements(project.key);
  await recordActivity({ projectId, actorId: user.id, verb: "发布了公告", target: announcement.title, href });

  const members = await db.selectFrom("ProjectMember").select("userId").where("projectId", "=", projectId).execute();
  await notify({
    userIds: members.map((m) => m.userId),
    actorId: user.id,
    text: `${user.name} 在「${project.name}」发布了公告：${announcement.title}`,
    href,
  });

  publishProjectChange(projectId);
}

/** 编辑公告：发布人或管理员。编辑不再重复通知成员 */
export async function updateAnnouncement(announcementId: string, input: unknown) {
  const announcement = await loadAnnouncement(announcementId);
  const { user } = await requireProjectAccess(announcement.projectId);
  if (announcement.authorId !== user.id && !isAdmin(user)) throw new ActionError("只有发布人或管理员可以编辑");
  const data = parseInput(announcementSchema, input);

  await db
    .updateTable("Announcement")
    .set({ title: data.title, body: data.body, pinned: data.pinned, editedAt: new Date() })
    .where("id", "=", announcementId)
    .execute();
  publishProjectChange(announcement.projectId);
}

/** 置顶 / 取消置顶：项目成员都可以操作 */
export async function setAnnouncementPinned(announcementId: string, pinned: boolean) {
  const announcement = await loadAnnouncement(announcementId);
  await requireProjectAccess(announcement.projectId);

  await db.updateTable("Announcement").set({ pinned }).where("id", "=", announcementId).execute();
  publishProjectChange(announcement.projectId);
}

export async function deleteAnnouncement(announcementId: string) {
  const announcement = await loadAnnouncement(announcementId);
  const { user } = await requireProjectAccess(announcement.projectId);
  if (announcement.authorId !== user.id && !isAdmin(user)) throw new ActionError("只有发布人或管理员可以删除");

  await db.deleteFrom("Announcement").where("id", "=", announcementId).execute();
  publishProjectChange(announcement.projectId);
}

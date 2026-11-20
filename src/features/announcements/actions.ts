"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import { isAdmin } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { notify } from "@/server/notifications";
import { requireProjectAccess } from "@/server/permissions";

import { announcementSchema } from "./schemas";

/** 发布公告：项目成员都可以发布并置顶；发布后通知项目全员 */
export async function publishAnnouncement(projectId: string, input: unknown) {
  return runAction(async () => {
    const { user, project } = await requireProjectAccess(projectId);
    const data = parseInput(announcementSchema, input);

    const announcement = await db.announcement.create({
      data: { projectId, title: data.title, body: data.body, pinned: data.pinned, authorId: user.id },
    });
    const href = routes.announcements(project.key);
    await recordActivity({ projectId, actorId: user.id, verb: "发布了公告", target: announcement.title, href });

    const members = await db.projectMember.findMany({ where: { projectId }, select: { userId: true } });
    await notify({
      userIds: members.map((m) => m.userId),
      actorId: user.id,
      text: `${user.name} 在「${project.name}」发布了公告：${announcement.title}`,
      href,
    });

    publishProjectChange(projectId);
    refresh();
  });
}

/** 编辑公告：发布人或管理员。编辑不再重复通知成员 */
export async function updateAnnouncement(announcementId: string, input: unknown) {
  return runAction(async () => {
    const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) throw new ActionError("公告不存在");
    const { user } = await requireProjectAccess(announcement.projectId);
    if (announcement.authorId !== user.id && !isAdmin(user)) throw new ActionError("只有发布人或管理员可以编辑");
    const data = parseInput(announcementSchema, input);

    await db.announcement.update({
      where: { id: announcementId },
      data: { title: data.title, body: data.body, pinned: data.pinned, editedAt: new Date() },
    });
    publishProjectChange(announcement.projectId);
    refresh();
  });
}

/** 置顶 / 取消置顶：项目成员都可以操作 */
export async function setAnnouncementPinned(announcementId: string, pinned: boolean) {
  return runAction(async () => {
    const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) throw new ActionError("公告不存在");
    await requireProjectAccess(announcement.projectId);

    await db.announcement.update({ where: { id: announcementId }, data: { pinned } });
    publishProjectChange(announcement.projectId);
    refresh();
  });
}

export async function deleteAnnouncement(announcementId: string) {
  return runAction(async () => {
    const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) throw new ActionError("公告不存在");
    const { user } = await requireProjectAccess(announcement.projectId);
    if (announcement.authorId !== user.id && !isAdmin(user)) throw new ActionError("只有发布人或管理员可以删除");

    await db.announcement.delete({ where: { id: announcementId } });
    publishProjectChange(announcement.projectId);
    refresh();
  });
}

import "server-only";

import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";

export type NavProject = {
  id: string;
  key: string;
  name: string;
  color: string;
  memberCount: number;
  archived: boolean;
  /** 当前用户是否是成员（管理员可以访问非成员项目） */
  joined: boolean;
  /** 我在进行中周期里未完成的任务数 */
  myOpenTasks: number;
  /** 等我回答的帖子数 */
  waitingForMe: number;
};

/** 侧边栏与项目切换器需要的项目列表及角标数字 */
export async function listNavProjects(user: CurrentUser): Promise<NavProject[]> {
  const projects = await db.project.findMany({
    where: isAdmin(user) ? {} : { members: { some: { userId: user.id } }, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      color: true,
      archivedAt: true,
      _count: { select: { members: true } },
      members: { where: { userId: user.id }, select: { userId: true } },
    },
  });

  const [taskCounts, topicCounts] = await Promise.all([
    db.task.groupBy({
      by: ["projectId"],
      where: { assigneeId: user.id, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] }, cycle: { status: "ACTIVE" } },
      _count: { _all: true },
    }),
    db.topic.groupBy({
      by: ["projectId"],
      where: { assigneeId: user.id, status: "OPEN" },
      _count: { _all: true },
    }),
  ]);
  const countOf = (rows: { projectId: string; _count: { _all: number } }[], id: string) =>
    rows.find((r) => r.projectId === id)?._count._all ?? 0;

  return projects.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    color: p.color,
    memberCount: p._count.members,
    archived: Boolean(p.archivedAt),
    joined: p.members.length > 0,
    myOpenTasks: countOf(taskCounts, p.id),
    waitingForMe: countOf(topicCounts, p.id),
  }));
}

/** 项目成员（用于各种成员选择器） */
export async function listProjectMembers(projectId: string) {
  const rows = await db.projectMember.findMany({
    where: { projectId },
    orderBy: { joinedAt: "asc" },
    select: { user: { select: { id: true, name: true, title: true, color: true, status: true } } },
  });
  return rows.map((r) => r.user);
}

export type ProjectMemberOption = Awaited<ReturnType<typeof listProjectMembers>>[number];

/** 项目管理列表（管理员）：全部项目及规模统计 */
export async function listProjectsForAdmin() {
  const projects = await db.project.findMany({
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    include: {
      _count: { select: { members: true, tasks: true, requirements: true, topics: true, materials: true } },
      cycles: { where: { status: "ACTIVE" }, select: { name: true } },
    },
  });
  return projects.map(({ cycles, ...p }) => ({ ...p, activeCycle: cycles[0]?.name ?? null }));
}

export type AdminProjectRow = Awaited<ReturnType<typeof listProjectsForAdmin>>[number];

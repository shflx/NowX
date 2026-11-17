import type { Metadata } from "next";

import { NoPermission } from "@/components/shared/no-permission";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectInfoForm } from "@/features/projects/components/project-info-form";
import { ProjectMembers } from "@/features/projects/components/project-members";
import { listProjectMembers } from "@/features/projects/queries";
import { isAdmin } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { db } from "@/server/db";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "项目设置" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[key]/settings">) {
  const { key } = await params;
  const { user, project } = await requireProjectByKey(key);
  if (!isAdmin(user)) return <NoPermission feature="项目设置" />;

  const [members, taskCounts, allProjects, directory] = await Promise.all([
    listProjectMembers(project.id),
    db.task.groupBy({
      by: ["assigneeId"],
      where: { projectId: project.id, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] }, cycle: { status: "ACTIVE" } },
      _count: { _all: true },
    }),
    db.project.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, key: true, name: true, color: true } }),
    db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, title: true, color: true } }),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <PageHeader title="项目设置" description="项目信息与成员管理。账号由管理员统一创建，不开放注册" />
      <ProjectInfoForm
        project={{
          id: project.id,
          key: project.key,
          name: project.name,
          description: project.description,
          color: project.color,
          archived: Boolean(project.archivedAt),
        }}
      />
      <ProjectMembers
        projectId={project.id}
        currentUserId={user.id}
        directory={directory}
        members={members.map((m) => ({
          ...m,
          activeTasks: taskCounts.find((c) => c.assigneeId === m.id)?._count._all ?? 0,
        }))}
        allProjects={allProjects}
        appUrl={appConfig.appUrl}
      />
    </div>
  );
}

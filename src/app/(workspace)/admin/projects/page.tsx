import type { Metadata } from "next";

import { NoPermission } from "@/components/shared/no-permission";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import { listProjectsForAdmin } from "@/features/projects/queries";
import { formatDateTime } from "@/lib/dates";
import { isAdmin, requireUser } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "项目管理" };

export default async function AdminProjectsPage() {
  const user = await requireUser();
  if (!isAdmin(user)) return <NoPermission feature="项目管理" />;

  const [projects, directory] = await Promise.all([
    listProjectsForAdmin(),
    db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, title: true, color: true } }),
  ]);

  return (
    <ProjectsTable
      currentUserId={user.id}
      directory={directory}
      projects={projects.map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        color: p.color,
        description: p.description,
        archived: Boolean(p.archivedAt),
        createdAt: formatDateTime(p.createdAt, appConfig.timeZone).slice(0, 10),
        activeCycle: p.activeCycle,
        counts: p._count,
      }))}
    />
  );
}

import { useAppConfig } from "@/components/layout/workspace-context";
import { NoPermission } from "@/components/shared/no-permission";
import { PageTitle } from "@/components/shared/page-title";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import type { AdminProjectsData } from "@/features/projects/routes";
import { formatDateTime } from "@/lib/dates";
import { useApi } from "@/lib/query";

export default function AdminProjectsPage() {
  const data = useApi<AdminProjectsData>("/api/admin/projects");
  const { timeZone } = useAppConfig();

  return (
    <>
      <PageTitle title="项目管理" />
      {data.allowed ? (
        <ProjectsTable
          currentUserId={data.user.id}
          directory={data.directory}
          projects={data.projects.map((p) => ({
            id: p.id,
            key: p.key,
            name: p.name,
            color: p.color,
            description: p.description,
            archived: Boolean(p.archivedAt),
            createdAt: formatDateTime(p.createdAt, timeZone).slice(0, 10),
            activeCycle: p.activeCycle,
            counts: p._count,
          }))}
        />
      ) : (
        <NoPermission feature="项目管理" />
      )}
    </>
  );
}

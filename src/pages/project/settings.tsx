import { useAppConfig } from "@/components/layout/workspace-context";
import { NoPermission } from "@/components/shared/no-permission";
import { PageHeader } from "@/components/shared/page-header";
import { PageTitle } from "@/components/shared/page-title";
import { ProjectDangerZone, ProjectInfoForm } from "@/features/projects/components/project-info-form";
import { ProjectMembers } from "@/features/projects/components/project-members";
import type { ProjectSettingsData } from "@/features/projects/routes";
import { useParams } from "@/lib/navigation";
import { useApi } from "@/lib/query";

export default function ProjectSettingsPage() {
  const { key } = useParams<{ key: string }>();
  const data = useApi<ProjectSettingsData>(`/api/projects/${key}/settings`);
  const { appUrl } = useAppConfig();

  return (
    <>
      <PageTitle title="项目设置" />
      {data.allowed ? (
        <div className="flex max-w-4xl flex-col gap-4">
          <PageHeader title="项目设置" description="项目信息与成员管理。账号由管理员统一创建，不开放注册" />
          <ProjectInfoForm project={data.project} />
          <ProjectMembers
            projectId={data.project.id}
            currentUserId={data.user.id}
            directory={data.directory}
            members={data.members}
            allProjects={data.allProjects}
            appUrl={appUrl}
          />
          <ProjectDangerZone project={data.project} />
        </div>
      ) : (
        <NoPermission feature="项目设置" />
      )}
    </>
  );
}

import { useAppConfig } from "@/components/layout/workspace-context";
import { PageTitle } from "@/components/shared/page-title";
import { MaterialLibrary } from "@/features/materials/components/material-grid";
import type { MaterialsPageData } from "@/features/materials/routes";
import { DOC_TYPE_META } from "@/lib/constants";
import { formatRelative } from "@/lib/dates";
import { formatFileSize, requirementCode } from "@/lib/format";
import { useParams, useSearchParams } from "@/lib/navigation";
import { useApi } from "@/lib/query";

export default function MaterialsPage() {
  const { key } = useParams<{ key: string }>();
  const tag = useSearchParams().get("tag");
  const { user, project, tags, total, requirements, activeTag, materials } = useApi<MaterialsPageData>(
    `/api/projects/${key}/materials${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`,
  );
  const { timeZone } = useAppConfig();
  const admin = user.role === "ADMIN";
  const now = new Date();

  return (
    <>
      <PageTitle title="材料库" />
      <MaterialLibrary
        projectId={project.id}
        projectKey={project.key}
        total={total}
        activeTag={activeTag}
        requirements={requirements}
        tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.materials }))}
        materials={materials.map((m) => ({
          id: m.id,
          kind: m.kind,
          name: m.name,
          url: m.url,
          docType: m.docType,
          meta: m.kind === "LINK" ? `${DOC_TYPE_META[m.docType ?? "OTHER"].label} · 外部链接` : formatFileSize(m.fileSize ?? 0),
          date: formatRelative(m.createdAt, timeZone, now),
          canManage: m.uploaderId === user.id || admin,
          uploader: m.uploader,
          requirement: m.requirement ? { number: m.requirement.number, code: requirementCode(m.requirement.number) } : null,
          tags: m.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
        }))}
      />
    </>
  );
}

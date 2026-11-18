import type { Metadata } from "next";

import { MaterialLibrary } from "@/features/materials/components/material-grid";
import { listMaterials, listTags } from "@/features/materials/queries";
import { DOC_TYPE_META } from "@/lib/constants";
import { formatRelative } from "@/lib/dates";
import { formatFileSize, requirementCode } from "@/lib/format";
import { isAdmin } from "@/server/auth/dal";
import { appConfig } from "@/server/config";
import { db } from "@/server/db";
import { requireProjectByKey } from "@/server/permissions";

export const metadata: Metadata = { title: "材料库" };

export default async function MaterialsPage({ params, searchParams }: PageProps<"/projects/[key]/materials">) {
  const { key } = await params;
  const { tag } = await searchParams;
  const { user, project } = await requireProjectByKey(key);

  const [tags, all, requirements] = await Promise.all([
    listTags(project.id),
    db.material.count({ where: { projectId: project.id } }),
    db.requirement.findMany({ where: { projectId: project.id }, orderBy: { number: "desc" }, select: { id: true, number: true, title: true } }),
  ]);
  const activeTag = typeof tag === "string" && tags.some((t) => t.id === tag) ? tag : null;
  const materials = await listMaterials(project.id, activeTag ?? undefined);
  const now = new Date();

  return (
    <MaterialLibrary
        projectId={project.id}
        projectKey={project.key}
        total={all}
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
          date: formatRelative(m.createdAt, appConfig.timeZone, now),
          canManage: m.uploaderId === user.id || isAdmin(user),
          uploader: m.uploader,
          requirement: m.requirement ? { number: m.requirement.number, code: requirementCode(m.requirement.number) } : null,
          tags: m.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
        }))}
    />
  );
}

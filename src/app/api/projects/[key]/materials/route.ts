import { findOrCreateTag, validTagIds } from "@/features/materials/service";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { recordActivity } from "@/server/activity";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { authorizeProjectRequest } from "@/server/permissions";
import { saveFile } from "@/server/storage";

/**
 * 上传材料文件（multipart/form-data）
 * 字段：file（必填）、name、requirementId、tagIds（可多个）、tagName（按名称挂标签，不存在则创建）
 */
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[key]/materials">) {
  const { key } = await params;
  const auth = await authorizeProjectRequest(key);
  if ("error" in auth) return auth.error;
  const { user, project } = auth;

  // 先按请求头拒绝超大文件，避免把整个文件读进内存
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return Response.json({ error: "单个文件不能超过 100 MB" }, { status: 413 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "请选择文件" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "单个文件不能超过 100 MB" }, { status: 413 });
  }

  const requirementId = String(form.get("requirementId") ?? "") || null;
  if (requirementId && !(await db.requirement.findFirst({ where: { id: requirementId, projectId: project.id } }))) {
    return Response.json({ error: "关联的需求不存在" }, { status: 400 });
  }

  const tagIds = await validTagIds(project.id, form.getAll("tagIds").map(String));
  const tagName = String(form.get("tagName") ?? "").trim();
  if (tagName) tagIds.push((await findOrCreateTag(project.id, tagName)).id);

  const name = String(form.get("name") ?? "").trim() || file.name;
  const storageKey = await saveFile(new Uint8Array(await file.arrayBuffer()), file.name);

  const material = await db.material.create({
    data: {
      projectId: project.id,
      kind: "FILE",
      name: name.slice(0, 120),
      storageKey,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      requirementId,
      uploaderId: user.id,
      tags: { create: [...new Set(tagIds)].map((tagId) => ({ tagId })) },
    },
  });

  await recordActivity({
    projectId: project.id,
    actorId: user.id,
    verb: "上传了材料",
    target: material.name,
    href: `/projects/${project.key}/materials`,
  });
  publishProjectChange(project.id);

  return Response.json({ id: material.id }, { status: 201 });
}

import { Hono } from "hono";
import { sql } from "kysely";

import { AttachmentLimitError } from "@/lib/attachment-limit";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { routes as pages } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import { getCurrentUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publishProjectChange } from "@/server/events";
import { canAccessProject, requireProjectByKey } from "@/server/permissions";
import { deleteFile, openFile, saveFile } from "@/server/storage";

import { listMaterials, listTags } from "./queries";
import { findOrCreateTag, validTagIds } from "./service";

export const routes = new Hono();

/** 材料库：标签及数量、当前标签下的材料 */
async function loadMaterialsPage(key: string, tag: string | undefined) {
  const { user, project } = await requireProjectByKey(key);
  const [tags, { total }, requirements] = await Promise.all([
    listTags(project.id),
    db
      .selectFrom("Material")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("projectId", "=", project.id)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("Requirement")
      .select(["id", "number", "title"])
      .where("projectId", "=", project.id)
      .orderBy("number", "desc")
      .execute(),
  ]);
  const activeTag = tag && tags.some((t) => t.id === tag) ? tag : null;
  const materials = await listMaterials(project.id, activeTag ?? undefined);
  return { user, project: { id: project.id, key: project.key }, tags, total, requirements, activeTag, materials };
}

export type MaterialsPageData = Awaited<ReturnType<typeof loadMaterialsPage>>;

routes.get("/projects/:key/materials", async (c) => c.json(await loadMaterialsPage(c.req.param("key"), c.req.query("tag"))));

/**
 * 上传材料文件（multipart/form-data）
 * 字段：file（必填）、name、requirementId、tagIds（可多个）、tagName（按名称挂标签，不存在则创建）
 */
routes.post("/projects/:key/materials", async (c) => {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return c.json({ error: "未登录" }, 401);
  const project = await db
    .selectFrom("Project")
    .select(["id", "key"])
    .where("key", "=", c.req.param("key").toUpperCase())
    .executeTakeFirst();
  if (!project || !(await canAccessProject(user, project.id))) return c.json({ error: "项目不存在或无权访问" }, 404);

  // 先按请求头拒绝超大文件，避免把整个文件读进内存
  const length = Number(c.req.header("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 1024 * 1024) return c.json({ error: "单个文件不能超过 100 MB" }, 413);

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return c.json({ error: "请选择文件" }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "单个文件不能超过 100 MB" }, 413);

  const requirementId = String(form.get("requirementId") ?? "") || null;
  if (
    requirementId &&
    !(await db
      .selectFrom("Requirement")
      .select("id")
      .where("id", "=", requirementId)
      .where("projectId", "=", project.id)
      .executeTakeFirst())
  ) {
    return c.json({ error: "关联的需求不存在" }, 400);
  }

  const tagIds = await validTagIds(project.id, form.getAll("tagIds").map(String));
  const tagName = String(form.get("tagName") ?? "").trim();
  if (tagName) tagIds.push((await findOrCreateTag(project.id, tagName)).id);

  const name = String(form.get("name") ?? "").trim() || file.name;
  let storageKey: string;
  try {
    storageKey = await saveFile(file);
  } catch (error) {
    if (error instanceof AttachmentLimitError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  const material = await db
    .transaction()
    .execute(async (tx) => {
      const created = await tx
        .insertInto("Material")
        .values({
          id: cuid(),
          projectId: project.id,
          kind: "FILE",
          name: name.slice(0, 120),
          storageKey,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          requirementId,
          uploaderId: user.id,
        })
        .returning(["id", "name"])
        .executeTakeFirstOrThrow();
      const uniqueTags = [...new Set(tagIds)];
      if (uniqueTags.length > 0) {
        await tx
          .insertInto("MaterialTag")
          .values(uniqueTags.map((tagId) => ({ materialId: created.id, tagId })))
          .execute();
      }
      return created;
    })
    .catch(async (error) => {
      // 如写库响应中断，先确认记录确实不存在，避免删除已提交的材料。
      if (!(await db.selectFrom("Material").select("id").where("storageKey", "=", storageKey).executeTakeFirst()))
        await deleteFile(storageKey);
      throw error;
    });

  await recordActivity({
    projectId: project.id,
    actorId: user.id,
    verb: "上传了材料",
    target: material.name,
    href: pages.materials(project.key),
  });
  publishProjectChange(project.id);
  return c.json({ id: material.id }, 201);
});

/** 下载材料文件：校验项目访问权限后以附件形式返回 */
routes.get("/materials/:id/download", async (c) => {
  const user = await getCurrentUser();
  if (!user) return c.text("未登录", 401);

  const material = await db.selectFrom("Material").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
  if (!material || material.kind !== "FILE" || !material.storageKey || !(await canAccessProject(user, material.projectId))) {
    return c.text("文件不存在", 404);
  }

  try {
    const { size, stream } = await openFile(material.storageKey);
    return new Response(stream, {
      headers: {
        "Content-Type": material.mimeType ?? "application/octet-stream",
        "Content-Length": String(size),
        // RFC 5987：用 filename* 传递 UTF-8 文件名，避免中文乱码
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(material.name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AttachmentLimitError) return c.text(error.message, error.status);
    return c.text("文件已丢失", 410);
  }
});

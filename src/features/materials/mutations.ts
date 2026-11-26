import { ActionError, parseInput } from "@/lib/action-result";
import { DOC_TYPE_META, detectDocType } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { recordActivity } from "@/server/activity";
import { isAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cuid } from "@/server/db/id";
import { publishProjectChange } from "@/server/events";
import { requireProjectAccess } from "@/server/permissions";
import { deleteFile } from "@/server/storage";

import { linkMaterialSchema, materialNameSchema, tagNameSchema, tagUpdateSchema } from "./schemas";
import { findOrCreateTag, validTagIds } from "./service";

export async function createLinkMaterial(projectId: string, input: unknown) {
  const { user, project } = await requireProjectAccess(projectId);
  const data = parseInput(linkMaterialSchema, input);
  if (
    data.requirementId &&
    !(await db
      .selectFrom("Requirement")
      .select("id")
      .where("id", "=", data.requirementId)
      .where("projectId", "=", projectId)
      .executeTakeFirst())
  ) {
    throw new ActionError("关联的需求不存在");
  }

  const docType = detectDocType(data.url);
  const tagIds = await validTagIds(projectId, data.tagIds);
  const material = await db.transaction().execute(async (tx) => {
    const created = await tx
      .insertInto("Material")
      .values({
        id: cuid(),
        projectId,
        kind: "LINK",
        url: data.url,
        docType,
        name: data.name || DOC_TYPE_META[docType].defaultName,
        requirementId: data.requirementId,
        uploaderId: user.id,
      })
      .returning(["id", "name"])
      .executeTakeFirstOrThrow();
    if (tagIds.length > 0) {
      await tx
        .insertInto("MaterialTag")
        .values(tagIds.map((tagId) => ({ materialId: created.id, tagId })))
        .execute();
    }
    return created;
  });
  await recordActivity({
    projectId,
    actorId: user.id,
    verb: "添加了材料",
    target: material.name,
    href: routes.materials(project.key),
  });
  publishProjectChange(projectId);
}

async function loadMaterial(materialId: string) {
  const material = await db.selectFrom("Material").selectAll().where("id", "=", materialId).executeTakeFirst();
  if (!material) throw new ActionError("材料不存在");
  const access = await requireProjectAccess(material.projectId);
  return { material, ...access };
}

export async function updateMaterialTags(materialId: string, tagIds: string[]) {
  const { material } = await loadMaterial(materialId);
  const ids = await validTagIds(material.projectId, tagIds);
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom("MaterialTag").where("materialId", "=", materialId).execute();
    if (ids.length > 0) {
      await tx
        .insertInto("MaterialTag")
        .values(ids.map((tagId) => ({ materialId, tagId })))
        .execute();
    }
  });
  publishProjectChange(material.projectId);
}

/** 文件扩展名（含点），没有则为空串 */
const extOf = (name: string) => name.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? "";

/**
 * 重命名材料：仅上传人或管理员。
 * 文件材料的下载文件名取自名称，新名称缺少原扩展名时自动补上，避免下载后无法打开。
 */
export async function renameMaterial(materialId: string, name: string) {
  const { material, user } = await loadMaterial(materialId);
  if (material.uploaderId !== user.id && !isAdmin(user)) throw new ActionError("只有上传人或管理员可以重命名");

  let next = parseInput(materialNameSchema, name);
  const ext = material.kind === "FILE" ? extOf(material.name) : "";
  if (ext && !next.toLowerCase().endsWith(ext.toLowerCase())) next = `${next}${ext}`;

  await db.updateTable("Material").set({ name: next }).where("id", "=", materialId).execute();
  publishProjectChange(material.projectId);
  return { name: next };
}

/** 删除材料：仅上传人或管理员；文件一并从存储中删除 */
export async function deleteMaterial(materialId: string) {
  const { material, user } = await loadMaterial(materialId);
  if (material.uploaderId !== user.id && !isAdmin(user)) throw new ActionError("只有上传人或管理员可以删除");
  await db.deleteFrom("Material").where("id", "=", materialId).execute();
  if (material.storageKey) await deleteFile(material.storageKey);
  publishProjectChange(material.projectId);
}

/** 新建标签（同名标签已存在时直接返回已有标签） */
export async function createTag(projectId: string, name: string) {
  await requireProjectAccess(projectId);
  const tag = await findOrCreateTag(projectId, parseInput(tagNameSchema, name));
  publishProjectChange(projectId);
  return { id: tag.id, name: tag.name, color: tag.color };
}

async function loadTag(tagId: string) {
  const tag = await db.selectFrom("Tag").selectAll().where("id", "=", tagId).executeTakeFirst();
  if (!tag) throw new ActionError("标签不存在");
  await requireProjectAccess(tag.projectId);
  return tag;
}

export async function updateTag(tagId: string, input: unknown) {
  const tag = await loadTag(tagId);
  const data = parseInput(tagUpdateSchema, input);
  if (
    data.name &&
    data.name !== tag.name &&
    (await db
      .selectFrom("Tag")
      .select("id")
      .where("projectId", "=", tag.projectId)
      .where("name", "=", data.name)
      .executeTakeFirst())
  ) {
    throw new ActionError(`标签「${data.name}」已存在`);
  }
  if (Object.keys(data).length > 0) await db.updateTable("Tag").set(data).where("id", "=", tagId).execute();
  publishProjectChange(tag.projectId);
}

/** 删除标签：材料上的该标签一并移除，材料本身保留 */
export async function deleteTag(tagId: string) {
  const tag = await loadTag(tagId);
  const used = await db.selectFrom("MaterialTag").select("materialId").where("tagId", "=", tagId).execute();
  await db.deleteFrom("Tag").where("id", "=", tagId).execute();
  publishProjectChange(tag.projectId);
  return { name: tag.name, used: used.length };
}

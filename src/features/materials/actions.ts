"use server";

import { refresh } from "next/cache";

import { ActionError, parseInput } from "@/lib/action-result";
import { DOC_TYPE_META, detectDocType } from "@/lib/constants";
import { recordActivity } from "@/server/activity";
import { isAdmin } from "@/server/auth/dal";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { publishProjectChange } from "@/server/events";
import { requireProjectAccess } from "@/server/permissions";
import { deleteFile } from "@/server/storage";

import { linkMaterialSchema, materialNameSchema, tagNameSchema, tagUpdateSchema } from "./schemas";
import { findOrCreateTag, validTagIds } from "./service";

export async function createLinkMaterial(projectId: string, input: unknown) {
  return runAction(async () => {
    const { user, project } = await requireProjectAccess(projectId);
    const data = parseInput(linkMaterialSchema, input);
    if (data.requirementId && !(await db.requirement.findFirst({ where: { id: data.requirementId, projectId } }))) {
      throw new ActionError("关联的需求不存在");
    }

    const docType = detectDocType(data.url);
    const material = await db.material.create({
      data: {
        projectId,
        kind: "LINK",
        url: data.url,
        docType,
        name: data.name || DOC_TYPE_META[docType].defaultName,
        requirementId: data.requirementId,
        uploaderId: user.id,
        tags: { create: (await validTagIds(projectId, data.tagIds)).map((tagId) => ({ tagId })) },
      },
    });
    await recordActivity({ projectId, actorId: user.id, verb: "添加了材料", target: material.name, href: `/projects/${project.key}/materials` });
    publishProjectChange(projectId);
    refresh();
  });
}

async function loadMaterial(materialId: string) {
  const material = await db.material.findUnique({ where: { id: materialId } });
  if (!material) throw new ActionError("材料不存在");
  const access = await requireProjectAccess(material.projectId);
  return { material, ...access };
}

export async function updateMaterialTags(materialId: string, tagIds: string[]) {
  return runAction(async () => {
    const { material } = await loadMaterial(materialId);
    const ids = await validTagIds(material.projectId, tagIds);
    await db.$transaction([
      db.materialTag.deleteMany({ where: { materialId } }),
      db.materialTag.createMany({ data: ids.map((tagId) => ({ materialId, tagId })) }),
    ]);
    publishProjectChange(material.projectId);
    refresh();
  });
}

/** 文件扩展名（含点），没有则为空串 */
const extOf = (name: string) => name.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? "";

/**
 * 重命名材料：仅上传人或管理员。
 * 文件材料的下载文件名取自名称，新名称缺少原扩展名时自动补上，避免下载后无法打开。
 */
export async function renameMaterial(materialId: string, name: string) {
  return runAction(async () => {
    const { material, user } = await loadMaterial(materialId);
    if (material.uploaderId !== user.id && !isAdmin(user)) throw new ActionError("只有上传人或管理员可以重命名");

    let next = parseInput(materialNameSchema, name);
    const ext = material.kind === "FILE" ? extOf(material.name) : "";
    if (ext && !next.toLowerCase().endsWith(ext.toLowerCase())) next = `${next}${ext}`;

    await db.material.update({ where: { id: materialId }, data: { name: next } });
    publishProjectChange(material.projectId);
    refresh();
    return { name: next };
  });
}

/** 删除材料：仅上传人或管理员；文件一并从存储中删除 */
export async function deleteMaterial(materialId: string) {
  return runAction(async () => {
    const { material, user } = await loadMaterial(materialId);
    if (material.uploaderId !== user.id && !isAdmin(user)) throw new ActionError("只有上传人或管理员可以删除");
    await db.material.delete({ where: { id: materialId } });
    if (material.storageKey) await deleteFile(material.storageKey);
    publishProjectChange(material.projectId);
    refresh();
  });
}

/** 新建标签（同名标签已存在时直接返回已有标签） */
export async function createTag(projectId: string, name: string) {
  return runAction(async () => {
    await requireProjectAccess(projectId);
    const tag = await findOrCreateTag(projectId, parseInput(tagNameSchema, name));
    publishProjectChange(projectId);
    return { id: tag.id, name: tag.name, color: tag.color };
  });
}

async function loadTag(tagId: string) {
  const tag = await db.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw new ActionError("标签不存在");
  await requireProjectAccess(tag.projectId);
  return tag;
}

export async function updateTag(tagId: string, input: unknown) {
  return runAction(async () => {
    const tag = await loadTag(tagId);
    const data = parseInput(tagUpdateSchema, input);
    if (data.name && data.name !== tag.name && (await db.tag.findUnique({ where: { projectId_name: { projectId: tag.projectId, name: data.name } } }))) {
      throw new ActionError(`标签「${data.name}」已存在`);
    }
    await db.tag.update({ where: { id: tagId }, data });
    publishProjectChange(tag.projectId);
    refresh();
  });
}

/** 删除标签：材料上的该标签一并移除，材料本身保留 */
export async function deleteTag(tagId: string) {
  return runAction(async () => {
    const tag = await loadTag(tagId);
    const used = await db.materialTag.count({ where: { tagId } });
    await db.tag.delete({ where: { id: tagId } });
    publishProjectChange(tag.projectId);
    refresh();
    return { name: tag.name, used };
  });
}

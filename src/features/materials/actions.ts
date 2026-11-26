import { action } from "@/lib/action-client";

import type * as mutations from "./mutations";

export const createLinkMaterial = action<typeof mutations.createLinkMaterial>("materials.createLinkMaterial");
export const updateMaterialTags = action<typeof mutations.updateMaterialTags>("materials.updateMaterialTags");
export const renameMaterial = action<typeof mutations.renameMaterial>("materials.renameMaterial");
export const deleteMaterial = action<typeof mutations.deleteMaterial>("materials.deleteMaterial");
export const createTag = action<typeof mutations.createTag>("materials.createTag");
export const updateTag = action<typeof mutations.updateTag>("materials.updateTag");
export const deleteTag = action<typeof mutations.deleteTag>("materials.deleteTag");

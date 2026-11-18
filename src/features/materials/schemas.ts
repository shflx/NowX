import { z } from "zod";

import { TAG_COLOR_KEYS } from "@/lib/constants";

export const linkMaterialSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: "请填写以 http:// 或 https:// 开头的链接" }),
  name: z.string().trim().max(120, "名称不能超过 120 个字").default(""),
  tagIds: z.array(z.string()).default([]),
  requirementId: z.string().min(1).nullable(),
});

export const tagNameSchema = z.string().trim().min(1, "标签名称不能为空").max(12, "标签名称不能超过 12 个字");

export const tagUpdateSchema = z.object({
  name: tagNameSchema.optional(),
  color: z.enum(TAG_COLOR_KEYS as [string, ...string[]]).optional(),
});

export const materialNameSchema = z.string().trim().min(1, "名称不能为空").max(120, "名称不能超过 120 个字");

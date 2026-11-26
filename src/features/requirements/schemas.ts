import { z } from "zod";

import { RequirementStatus } from "@/lib/enums";

export const docLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: "链接需要以 http:// 或 https:// 开头" }),
  name: z.string().trim().max(60, "文档名称不能超过 60 个字").default(""),
});

export const requirementSchema = z.object({
  title: z.string().trim().min(1, "请填写需求标题").max(80, "标题不能超过 80 个字"),
  summary: z.string().trim().max(2000, "摘要不能超过 2000 个字").default(""),
  status: z.enum(RequirementStatus),
  ownerId: z.string().nullable(),
  docs: z.array(docLinkSchema).max(10, "最多 10 个外部链接").default([]),
});

/** 新建需求时可以直接排入周期；之后通过「调整周期」移动 */
export const createRequirementSchema = requirementSchema.extend({
  cycleId: z.string().min(1).nullable().default(null),
});

export const moveRequirementSchema = z.object({
  /** 目标周期；null 表示移回待排期 */
  cycleId: z.string().min(1).nullable(),
  /** 是否同时移动原周期中未完成的任务 */
  moveTasks: z.boolean().default(true),
});

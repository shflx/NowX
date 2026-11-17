import { z } from "zod";

export const docLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: "链接需要以 http:// 或 https:// 开头" }),
  name: z.string().trim().max(60, "文档名称不能超过 60 个字").default(""),
});

export const requirementSchema = z.object({
  title: z.string().trim().min(1, "请填写需求标题").max(80, "标题不能超过 80 个字"),
  summary: z.string().trim().max(2000, "摘要不能超过 2000 个字").default(""),
  status: z.enum(["BACKLOG", "DESIGN", "DEVELOPING", "DELIVERED"]),
  ownerId: z.string().nullable(),
  docs: z.array(docLinkSchema).max(10, "最多 10 个外部链接").default([]),
});

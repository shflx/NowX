import { z } from "zod";

import { PROJECT_COLORS } from "@/lib/constants";

export const projectFieldsSchema = z.object({
  name: z.string().trim().min(1, "请填写项目名称").max(40, "项目名称不能超过 40 个字"),
  description: z.string().trim().max(200, "描述不能超过 200 个字").default(""),
  color: z.enum(PROJECT_COLORS as [string, ...string[]], "请选择颜色"),
});

export const createProjectSchema = projectFieldsSchema.extend({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, "编号前缀需为 2–6 个英文字母"),
  memberIds: z.array(z.string()).default([]),
});

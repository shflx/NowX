import { z } from "zod";

import { passwordRule } from "@/features/auth/schemas";
import { UserRole } from "@/generated/prisma/enums";

export const accountFieldsSchema = z.object({
  name: z.string().trim().min(1, "请填写姓名").max(20, "姓名不能超过 20 个字"),
  title: z.string().trim().max(20, "职能不能超过 20 个字").default(""),
  role: z.enum(UserRole),
  projectIds: z.array(z.string()).default([]),
});

export const createAccountSchema = accountFieldsSchema.extend({
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "登录名需为 3–20 位小写字母、数字或下划线"),
  password: passwordRule,
});

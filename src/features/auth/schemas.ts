import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, "请输入账号"),
  password: z.string().min(1, "请输入密码"),
});

export const passwordRule = z
  .string()
  .min(8, "密码至少 8 位")
  .max(72, "密码不能超过 72 位")
  .regex(/[a-zA-Z]/, "密码需要包含字母")
  .regex(/\d/, "密码需要包含数字");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "两次输入的新密码不一致", path: ["confirmPassword"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "新密码不能与当前密码相同", path: ["newPassword"] });

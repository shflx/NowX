"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { type ActionResult, ActionError, parseInput } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/dal";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, deleteCurrentSession, deleteUserSessions } from "@/server/auth/session";
import { runAction } from "@/server/action";
import { db } from "@/server/db";
import { hitLimit, isLimited, resetLimit } from "@/server/rate-limit";

import { changePasswordSchema, loginSchema } from "./schemas";

/** 同一账号 + IP 在 15 分钟内最多失败 5 次 */
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW = 15 * 60 * 1000;

// 账号不存在时也执行一次哈希校验，使响应时间与「密码错误」一致，避免枚举账号
const DUMMY_HASH = hashPassword("nowx-dummy-password");

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const input = parseInput(loginSchema, Object.fromEntries(formData));
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limitKey = `login:${input.login}:${ip}`;

    if (isLimited(limitKey, LOGIN_LIMIT)) {
      throw new ActionError("尝试次数过多，请 15 分钟后再试");
    }

    const user = await db.user.findUnique({ where: { login: input.login } });
    const valid = await verifyPassword(user?.passwordHash ?? (await DUMMY_HASH), input.password);

    if (!user || !valid) {
      hitLimit(limitKey, LOGIN_LIMIT, LOGIN_WINDOW);
      throw new ActionError("账号或密码错误");
    }
    if (user.status === "DISABLED") {
      throw new ActionError("该账号已停用，请联系管理员");
    }

    resetLimit(limitKey);
    await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return user.mustChangePassword;
  });

  if (!result.ok) return result;
  redirect(result.data ? "/change-password" : "/");
}

export async function logout() {
  await deleteCurrentSession();
  redirect("/login");
}

export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    // 这里不用 requireUser：需要改密的用户本来就会被它重定向到本页
    const current = await getCurrentUser();
    if (!current) redirect("/login");

    const input = parseInput(changePasswordSchema, Object.fromEntries(formData));
    const user = await db.user.findUniqueOrThrow({ where: { id: current.id } });
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new ActionError("当前密码不正确", { currentPassword: "当前密码不正确" });
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword), mustChangePassword: false },
    });
    // 改密后让其他设备上的会话失效
    await deleteUserSessions(user.id, true);
  });

  if (!result.ok) return result;
  redirect("/");
}

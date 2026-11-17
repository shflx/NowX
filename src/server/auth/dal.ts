import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { ActionError } from "@/lib/action-result";
import { SESSION_COOKIE } from "@/lib/cookies";
import { validateSessionToken } from "@/server/auth/session";

/** 当前登录用户（只暴露界面与权限判断需要的字段，不包含密码哈希） */
export type CurrentUser = {
  id: string;
  login: string;
  name: string;
  title: string;
  role: "ADMIN" | "MEMBER";
  color: string;
  mustChangePassword: boolean;
};

/**
 * 读取当前用户。同一次渲染内通过 React cache 去重；
 * 已停用账号视同未登录。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await validateSessionToken(token);
  if (!session || session.user.status !== "ACTIVE") return null;

  const { id, login, name, title, role, color, mustChangePassword } = session.user;
  return { id, login, name, title, role, color, mustChangePassword };
});

/**
 * 页面与 Server Action 的统一入口：未登录跳转登录页，
 * 需要修改初始密码的用户先跳转改密页。
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export const isAdmin = (user: CurrentUser) => user.role === "ADMIN";

/** Server Action 中使用：非管理员直接拒绝 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) throw new ActionError("只有管理员可以执行该操作");
  return user;
}

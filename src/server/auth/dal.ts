import { ActionError } from "@/lib/action-result";
import { SESSION_COOKIE } from "@/lib/cookies";
import type { UserRole } from "@/lib/enums";
import { getCookie, memo } from "@/server/context";
import { MustChangePasswordError, UnauthenticatedError } from "@/server/http-errors";

import { validateSessionToken } from "./session";

/** 当前登录用户（只暴露界面与权限判断需要的字段，不包含密码哈希） */
export type CurrentUser = {
  id: string;
  login: string;
  name: string;
  title: string;
  role: UserRole;
  color: string;
  mustChangePassword: boolean;
};

/**
 * 读取当前用户。同一请求内只查询一次；
 * 已停用账号视同未登录。
 */
export function getCurrentUser(): Promise<CurrentUser | null> {
  return memo("currentUser", async () => {
    const token = getCookie(SESSION_COOKIE);
    if (!token) return null;

    const session = await validateSessionToken(token);
    if (!session || session.status !== "ACTIVE") return null;

    const { id, login, name, title, role, color, mustChangePassword } = session;
    return { id, login, name, title, role, color, mustChangePassword };
  });
}

/**
 * 接口的统一入口：未登录返回 401，需要修改初始密码的用户返回 403，
 * 由前端分别跳转登录页和改密页。
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (user.mustChangePassword) throw new MustChangePasswordError();
  return user;
}

export const isAdmin = (user: CurrentUser) => user.role === "ADMIN";

/** 管理操作：非管理员直接拒绝 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) throw new ActionError("只有管理员可以执行该操作");
  return user;
}

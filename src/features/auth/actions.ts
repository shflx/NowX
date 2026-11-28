import { action } from "@/lib/action-client";
import type { ActionResult } from "@/lib/action-result";
import { redirectTo } from "@/lib/api";
import { queryClient } from "@/lib/query";

import type * as mutations from "./mutations";

// 登录、退出后都会清空缓存并跳转，不需要刷新页面数据；退出时刷新会因会话已失效而挂起，拖到下次登录后才继续执行并跳回登录页
const loginAction = action<typeof mutations.login>("auth.login", { refresh: false });
const logoutAction = action<typeof mutations.logout>("auth.logout", { refresh: false });
const changePasswordAction = action<typeof mutations.changePassword>("auth.changePassword");

// 跳转与表单提交处于同一个过渡中：动作需要正常结束，跳转才能完成
const done: ActionResult = { ok: true, data: undefined };

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await loginAction(Object.fromEntries(formData));
  if (!result.ok) return result;
  queryClient.clear();
  redirectTo(result.data.mustChangePassword ? "/change-password" : "/");
  return done;
}

export async function logout() {
  await logoutAction();
  // 清空上一个账号的页面数据
  queryClient.clear();
  redirectTo("/login");
}

export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await changePasswordAction(Object.fromEntries(formData));
  if (!result.ok) return result;
  redirectTo("/");
  return done;
}

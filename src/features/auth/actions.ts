import { action } from "@/lib/action-client";
import type { ActionResult } from "@/lib/action-result";
import { redirectTo } from "@/lib/api";
import { queryClient } from "@/lib/query";

import type * as mutations from "./mutations";

const loginAction = action<typeof mutations.login>("auth.login");
const logoutAction = action<typeof mutations.logout>("auth.logout");
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

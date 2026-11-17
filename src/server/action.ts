import "server-only";

import { unstable_rethrow } from "next/navigation";

import { ActionError, type ActionResult } from "@/lib/action-result";

/**
 * 包装 Server Action 的业务逻辑：ActionError 转换为失败结果返回给界面，
 * redirect / notFound 等框架控制流原样抛出，其余异常记录日志后返回通用错误。
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("[action]", error);
    return { ok: false, error: "服务器出错了，请稍后重试" };
  }
}

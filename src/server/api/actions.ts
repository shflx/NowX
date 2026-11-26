import * as accessTokens from "@/features/access-tokens/mutations";
import * as accounts from "@/features/accounts/mutations";
import * as announcements from "@/features/announcements/mutations";
import * as auth from "@/features/auth/mutations";
import * as cycles from "@/features/cycles/mutations";
import * as discussions from "@/features/discussions/mutations";
import * as materials from "@/features/materials/mutations";
import * as notifications from "@/features/notifications/mutations";
import * as projects from "@/features/projects/mutations";
import * as requirements from "@/features/requirements/mutations";
import * as tasks from "@/features/tasks/mutations";
import { ActionError, type ActionResult } from "@/lib/action-result";

type ServerFunction = (...args: never[]) => Promise<unknown>;

// 各模块 mutations.ts 只导出写操作，按「模块.函数名」对外开放，与前端 action("模块.函数名") 对应
const registry: Record<string, Record<string, ServerFunction>> = {
  accessTokens,
  accounts,
  announcements,
  auth,
  cycles,
  discussions,
  materials,
  notifications,
  projects,
  requirements,
  tasks,
};

export function findAction(name: string) {
  const [module, fn] = name.split(".");
  const target = Object.hasOwn(registry, module) ? registry[module] : undefined;
  return target && Object.hasOwn(target, fn) ? (target[fn] as (...args: unknown[]) => Promise<unknown>) : undefined;
}

/**
 * 执行写操作：ActionError 转换为失败结果返回给界面；
 * 其余异常继续抛出，由入口统一处理（鉴权错误转换为 401 / 403，其他记录日志后返回通用错误）。
 */
export async function runAction<A extends unknown[], T>(fn: (...args: A) => Promise<T>, args: A): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(...args) };
  } catch (error) {
    if (error instanceof ActionError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    throw error;
  }
}

// 写操作的统一返回结构与错误类型（前后端共用，不依赖服务端模块）
import { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** 可直接展示给用户的业务错误；其余异常按服务器错误处理 */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** 把 zod 校验结果转换为 { 字段: 第一条错误 } */
export function fieldErrorsOf(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/** 校验输入，失败时抛出带字段错误的 ActionError */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors = fieldErrorsOf(result.error);
    throw new ActionError(Object.values(fieldErrors)[0] ?? "输入不正确", fieldErrors);
  }
  return result.data;
}

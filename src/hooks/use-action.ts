import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

type Options<T> = {
  /** 成功后的提示文案 */
  successMessage?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
};

/**
 * 在组件中调用写操作（各模块 actions.ts 导出的函数）的统一封装：
 * 管理提交中状态、字段错误，并在失败时用 toast 提示（有字段错误时由表单就地展示）。
 */
export function useAction<A extends unknown[], T>(
  action: (...args: A) => Promise<ActionResult<T>>,
  options: Options<T> = {},
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function run(...args: A) {
    return new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        const result = await action(...args);
        if (result.ok) {
          setFieldErrors({});
          const { successMessage, onSuccess } = options;
          if (successMessage) {
            toast.success(typeof successMessage === "function" ? successMessage(result.data) : successMessage);
          }
          onSuccess?.(result.data);
        } else {
          setFieldErrors(result.fieldErrors ?? {});
          if (!result.fieldErrors) toast.error(result.error);
        }
        resolve(result);
      });
    });
  }

  return { run, pending, fieldErrors, setFieldErrors };
}

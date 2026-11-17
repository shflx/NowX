"use client";

import { type FormEvent, startTransition, useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";

/**
 * 基于 useActionState 的表单提交，但通过 onSubmit 触发：
 * React 19 用 <form action> 提交后会重置表单，校验失败时用户已输入的内容会丢失，这里避免这种情况。
 */
export function useFormAction<T>(action: (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>) {
  const [state, dispatch, pending] = useActionState(action, null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const formError = state && !state.ok && !state.fieldErrors ? state.error : undefined;
  return { onSubmit, pending, fieldErrors, formError };
}

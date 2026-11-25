"use client";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";

import { login } from "../actions";

export function LoginForm() {
  const { onSubmit, pending, fieldErrors: errors, formError } = useFormAction(login);

  return (
    <form method="post" onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">登录</h1>
        <p className="mt-1 text-sm text-muted-foreground">账号由管理员创建，如需开通请联系管理员</p>
      </div>
      <FormField label="账号" htmlFor="login" error={errors?.login}>
        <Input id="login" name="login" autoComplete="username" autoFocus required className="h-10" />
      </FormField>
      <FormField label="密码" htmlFor="password" error={errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10" />
      </FormField>
      {formError && <FieldError>{formError}</FieldError>}
      <Button type="submit" disabled={pending} size="lg" className="h-10">
        {pending && <Spinner />}
        登录
      </Button>
    </form>
  );
}

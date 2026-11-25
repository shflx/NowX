"use client";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";

import { changePassword } from "../actions";

export function ChangePasswordForm() {
  const { onSubmit, pending, fieldErrors: errors, formError } = useFormAction(changePassword);

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormField label="当前密码" htmlFor="currentPassword" error={errors?.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </FormField>
      <FormField label="新密码" htmlFor="newPassword" error={errors?.newPassword} description="至少 8 位，需同时包含字母和数字">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </FormField>
      <FormField label="确认新密码" htmlFor="confirmPassword" error={errors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </FormField>
      {formError && <FieldError>{formError}</FieldError>}
      <Button type="submit" disabled={pending}>
        {pending && <Spinner />}保存新密码</Button>
    </form>
  );
}

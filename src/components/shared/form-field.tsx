import type { ReactNode } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

type FormFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** 表单字段：标签 + 控件 + 说明 / 错误，统一表单排版 */
export function FormField({ label, htmlFor, error, description, className, children }: FormFieldProps) {
  return (
    <Field data-invalid={Boolean(error) || undefined} className={className}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

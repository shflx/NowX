import type { ReactNode } from "react";

/** 页面标题区：标题 + 说明 + 右侧操作 */
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 flex items-center gap-2">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-wide">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

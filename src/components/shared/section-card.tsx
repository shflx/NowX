import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 带标题的白色卡片区块 */
export function SectionCard({
  title,
  extra,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  /** 标题旁的补充信息（徽标、说明） */
  extra?: ReactNode;
  /** 右侧操作 */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-xs", className)}>
      {title && (
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {extra}
          {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
        </div>
      )}
      <div className={cn("px-4 pb-4", !title && "pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

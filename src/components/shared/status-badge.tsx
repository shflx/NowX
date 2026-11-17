import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent-soft text-accent-text",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-destructive",
};

/** 圆角状态徽标（需求状态、帖子状态、周期状态等） */
export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 text-xs leading-5 whitespace-nowrap [&_svg]:size-3", TONES[tone], className)}>
      {children}
    </span>
  );
}

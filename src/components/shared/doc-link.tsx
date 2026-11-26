import { ExternalLinkIcon } from "lucide-react";

import { DOC_TYPE_META } from "@/lib/constants";
import type { DocType } from "@/lib/enums";
import { cn } from "@/lib/utils";

const DOC_COLOR: Record<DocType, string> = {
  FEISHU: "bg-[#3370ff]",
  TENCENT: "bg-gradient-to-br from-[#2a8cff] to-[#13c2a3]",
  FIGMA: "bg-[#1e1e1e]",
  APIFOX: "bg-[#f2551f]",
  OTHER: "bg-[#8b8982]",
};

/** 外部文档类型小图标 */
export function DocTypeIcon({ type, className }: { type: DocType; className?: string }) {
  return (
    <span className={cn("inline-grid size-4 shrink-0 place-items-center rounded-[3px] text-[9px] font-bold text-white", DOC_COLOR[type], className)} title={DOC_TYPE_META[type].label}>
      {DOC_TYPE_META[type].mark}
    </span>
  );
}

/** 外部文档链接（新窗口打开） */
export function DocLink({ doc }: { doc: { type: DocType; name: string; url: string } }) {
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 rounded border bg-card px-2 py-0.5 text-xs whitespace-nowrap transition-colors hover:border-primary hover:text-accent-text"
    >
      <DocTypeIcon type={doc.type} />
      <span className="truncate">{doc.name}</span>
      <ExternalLinkIcon className="size-3 shrink-0" />
    </a>
  );
}

import { TAG_COLORS, type TagColor } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function tagColors(color: string) {
  return TAG_COLORS[color as TagColor] ?? TAG_COLORS.gray;
}

/** 材料标签 */
export function TagChip({ tag, className }: { tag: { name: string; color: string }; className?: string }) {
  const [bg, fg] = tagColors(tag.color);
  return (
    <span className={cn("inline-flex items-center rounded px-2 text-xs leading-5 whitespace-nowrap", className)} style={{ background: bg, color: fg }}>
      {tag.name}
    </span>
  );
}

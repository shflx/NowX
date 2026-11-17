import { cn } from "@/lib/utils";

/** 项目色块：项目编号首字母 */
export function ProjectDot({ project, className }: { project: { key: string; color: string }; className?: string }) {
  return (
    <span
      className={cn("inline-grid size-5.5 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white", className)}
      style={{ background: project.color }}
    >
      {project.key[0]}
    </span>
  );
}

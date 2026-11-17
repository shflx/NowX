import { BOARD_STATUSES, TASK_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type StatusCounts = Record<(typeof BOARD_STATUSES)[number], number>;

const SEGMENT_COLOR = {
  TODO: "bg-status-todo",
  IN_PROGRESS: "bg-status-doing",
  IN_REVIEW: "bg-status-review",
  DONE: "bg-status-done",
} as const;

/** 按状态堆叠的进度条；scale 用于成员负载等需要按比例缩短的场景 */
export function StatusBar({ counts, scale = 1, className }: { counts: StatusCounts; scale?: number; className?: string }) {
  const total = BOARD_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  if (total === 0) return <div className={cn("h-2.5 rounded bg-muted", className)} />;
  return (
    <div className={cn("flex h-2.5 gap-0.5", className)} style={{ width: `${scale * 100}%` }} role="img" aria-label={legendText(counts)}>
      {BOARD_STATUSES.filter((s) => counts[s] > 0).map((s) => (
        <i
          key={s}
          className={cn("block h-full first:rounded-l last:rounded-r", SEGMENT_COLOR[s])}
          style={{ flexGrow: counts[s] }}
          title={`${TASK_STATUS_LABEL[s]}：${counts[s]} 个`}
        />
      ))}
    </div>
  );
}

/** 状态图例：色块 + 名称 + 数量（保证不只靠颜色区分） */
export function StatusLegend({ counts }: { counts: StatusCounts }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
      {BOARD_STATUSES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <i className={cn("size-2.5 rounded-[3px]", SEGMENT_COLOR[s])} />
          {TASK_STATUS_LABEL[s]}
          <b className="font-semibold text-foreground tabular-nums">{counts[s]}</b>
        </span>
      ))}
    </div>
  );
}

const legendText = (counts: StatusCounts) => BOARD_STATUSES.map((s) => `${TASK_STATUS_LABEL[s]} ${counts[s]}`).join("，");

/** 单色完成度进度条 */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i className="block h-full rounded-full bg-status-done" style={{ width: `${value}%` }} />
    </div>
  );
}

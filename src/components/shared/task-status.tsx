import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "text-status-todo",
  IN_PROGRESS: "text-status-doing",
  BLOCKED: "text-status-blocked",
  IN_REVIEW: "text-status-review",
  DONE: "text-status-done",
  CANCELED: "text-muted-foreground",
};

/** 环形填充比例表达状态推进程度；阻塞与进行中同为半环，以红色区分 */
const STATUS_FILL: Record<TaskStatus, string> = {
  TODO: "",
  IN_PROGRESS: "bg-[conic-gradient(currentColor_0_50%,transparent_50%_100%)]",
  BLOCKED: "bg-[conic-gradient(currentColor_0_50%,transparent_50%_100%)]",
  IN_REVIEW: "bg-[conic-gradient(currentColor_0_75%,transparent_75%_100%)]",
  DONE: "bg-current",
  CANCELED: "",
};

/** 任务状态图标；showLabel 时附带文字 */
export function TaskStatusIcon({ status, showLabel, className }: { status: TaskStatus; showLabel?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", STATUS_COLOR[status], className)} title={TASK_STATUS_LABEL[status]}>
      <span className={cn("size-3 shrink-0 rounded-full border-2 border-current", STATUS_FILL[status])} aria-hidden />
      {showLabel ? <span className="text-muted-foreground">{TASK_STATUS_LABEL[status]}</span> : <span className="sr-only">{TASK_STATUS_LABEL[status]}</span>}
    </span>
  );
}

const PRIORITY_BARS: Record<TaskPriority, number> = { URGENT: 3, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** 优先级：三格信号条 + 文字；紧急用红色 */
export function PriorityIndicator({ priority, hideLabel }: { priority: TaskPriority; hideLabel?: boolean }) {
  const filled = PRIORITY_BARS[priority];
  const urgent = priority === "URGENT";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", urgent && "font-medium text-destructive")}
      title={`优先级：${TASK_PRIORITY_LABEL[priority]}`}
    >
      <span className="inline-flex items-end gap-px" aria-hidden>
        {[6, 9, 12].map((h, i) => (
          <i
            key={h}
            className={cn("inline-block w-[3px] rounded-[1px] bg-border", i < filled && (urgent ? "bg-destructive" : "bg-foreground/70"))}
            style={{ height: h }}
          />
        ))}
      </span>
      {hideLabel ? <span className="sr-only">{TASK_PRIORITY_LABEL[priority]}</span> : TASK_PRIORITY_LABEL[priority]}
    </span>
  );
}

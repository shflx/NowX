import { GitBranchIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityIndicator } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatMonthDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { TaskCardData } from "../serialize";
import { blockedLabel } from "../status-flow";

/** 截止日期：逾期标红 */
export function DueDate({ task, className }: { task: Pick<TaskCardData, "due" | "overdue">; className?: string }) {
  if (!task.due) return null;
  return (
    <span className={cn("text-xs tabular-nums", task.overdue ? "font-medium text-destructive" : "text-muted-foreground", className)}>
      {task.overdue && "已逾期 · "}
      {formatMonthDay(task.due)}
    </span>
  );
}

/** 看板卡片；href 用整卡覆盖的链接打开详情 */
export function TaskCard({ task, href, dragging }: { task: TaskCardData; href: string; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-md border bg-card px-3 py-2.5 shadow-xs transition-shadow hover:border-input hover:shadow-sm",
        dragging && "rotate-1 shadow-lg",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">{task.code}</span>
        <PriorityIndicator priority={task.priority} />
      </div>
      <Link href={href} scroll={false} className="mt-1 mb-2 block leading-snug font-medium after:absolute after:inset-0">
        {task.title}
      </Link>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {task.requirement && (
          <span className="rounded border bg-muted px-1.5 leading-[18px]" title={task.requirement.title}>
            {task.requirement.code}
          </span>
        )}
        {task.blockedDays !== null && <StatusBadge tone="danger">{blockedLabel(task.blockedDays)}</StatusBadge>}
        {task.carried && <StatusBadge tone="warn">顺延</StatusBadge>}
        {task.subtasksTotal > 0 && (
          <span className="inline-flex items-center gap-0.5" title="子任务">
            <GitBranchIcon className="size-3.5" />
            {task.subtasksDone}/{task.subtasksTotal}
          </span>
        )}
        {task.comments > 0 && (
          <span className="inline-flex items-center gap-0.5" title="评论">
            <MessageSquareIcon className="size-3.5" />
            {task.comments}
          </span>
        )}
        {task.status !== "DONE" && <DueDate task={task} />}
        <span className="ml-auto">{task.assignee && <UserAvatar user={task.assignee} size="sm" />}</span>
      </div>
    </div>
  );
}

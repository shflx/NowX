import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityIndicator, TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import type { TaskCardData } from "../serialize";
import { DueDate } from "./task-card";
import { useTaskLink } from "./use-task-link";

/** 列表视图：按来源需求分组，子任务缩进显示在父任务下 */
export function TaskList({ tasks }: { tasks: TaskCardData[] }) {
  const link = useTaskLink();

  const groups = new Map<string, { title: string; tasks: TaskCardData[] }>();
  for (const t of tasks) {
    const key = t.requirement?.id ?? "none";
    const group = groups.get(key) ?? { title: t.requirement ? `${t.requirement.code} ${t.requirement.title}` : "未关联需求", tasks: [] };
    group.tasks.push(t);
    groups.set(key, group);
  }
  // 「未关联需求」放在最后
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : 0));

  const row = (t: TaskCardData, child = false) => (
    <TableRow key={t.id} className="relative">
      <TableCell className="pl-4 text-xs text-muted-foreground tabular-nums">{t.code}</TableCell>
      <TableCell className={cn(child && "pl-8")}>
        {child && <span className="text-muted-foreground">└ </span>}
        <Link href={link(t.number)} scroll={false} className="after:absolute after:inset-0 hover:text-accent-text">
          {t.title}
        </Link>
        {t.carried && <StatusBadge tone="warn" className="ml-2">顺延</StatusBadge>}
      </TableCell>
      <TableCell>
        <TaskStatusIcon status={t.status} showLabel />
      </TableCell>
      <TableCell>
        <PriorityIndicator priority={t.priority} />
      </TableCell>
      <TableCell>
        {t.assignee ? (
          <span className="flex items-center gap-1.5">
            <UserAvatar user={t.assignee} size="sm" />
            {t.assignee.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">未指派</span>
        )}
      </TableCell>
      <TableCell>
        <DueDate task={t} />
      </TableCell>
    </TableRow>
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24 pl-4">编号</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-24">状态</TableHead>
            <TableHead className="w-20">优先级</TableHead>
            <TableHead className="w-28">负责人</TableHead>
            <TableHead className="w-32">截止</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map(([key, group]) => {
            const ids = new Set(group.tasks.map((t) => t.id));
            const roots = group.tasks.filter((t) => !t.parentId || !ids.has(t.parentId));
            return [
              <TableRow key={`group-${key}`} className="bg-muted/60 hover:bg-muted/60">
                <TableCell colSpan={6} className="py-1.5 pl-4 text-xs font-medium text-muted-foreground">
                  {group.title} · {group.tasks.length}
                </TableCell>
              </TableRow>,
              ...roots.flatMap((t) => [row(t), ...group.tasks.filter((c) => c.parentId === t.id).map((c) => row(c, true))]),
            ];
          })}
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                没有符合条件的任务
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

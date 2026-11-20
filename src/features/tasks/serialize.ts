// 把查询结果转换为客户端组件使用的精简结构（纯函数）
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { isOpenTask } from "@/lib/constants";
import { toDateString } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";

import type { TaskListItem } from "./queries";
import { blockedDays } from "./status-flow";

export type TaskCardData = {
  id: string;
  number: number;
  code: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string | null;
  overdue: boolean;
  carried: boolean;
  /** 阻塞中的任务已阻塞的天数，其余为 null */
  blockedDays: number | null;
  parentId: string | null;
  assignee: { id: string; name: string; color: string } | null;
  requirement: { id: string; code: string; title: string } | null;
  subtasksDone: number;
  subtasksTotal: number;
  comments: number;
};

export const isOverdue = (due: string | null, status: TaskStatus, today: string) => Boolean(due && due < today && isOpenTask(status));

export function toTaskCard(task: TaskListItem, projectKey: string, today: string, timeZone: string): TaskCardData {
  const due = task.dueDate ? toDateString(task.dueDate) : null;
  return {
    id: task.id,
    number: task.number,
    code: taskCode(projectKey, task.number),
    title: task.title,
    status: task.status,
    priority: task.priority,
    due,
    overdue: isOverdue(due, task.status, today),
    carried: Boolean(task.carriedFromCycleId),
    blockedDays: task.status === "BLOCKED" && task.blockedAt ? blockedDays(task.blockedAt, today, timeZone) : null,
    parentId: task.parentId,
    assignee: task.assignee,
    requirement: task.requirement
      ? { id: task.requirement.id, code: requirementCode(task.requirement.number), title: task.requirement.title }
      : null,
    subtasksDone: task.subtasks.filter((s) => s.status === "DONE").length,
    subtasksTotal: task.subtasks.length,
    comments: task._count.comments,
  };
}

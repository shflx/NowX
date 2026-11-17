// 把查询结果转换为客户端组件使用的精简结构（纯函数）
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { toDateString } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";

import type { TaskListItem } from "./queries";

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
  parentId: string | null;
  assignee: { id: string; name: string; color: string } | null;
  requirement: { id: string; code: string; title: string } | null;
  subtasksDone: number;
  subtasksTotal: number;
  comments: number;
};

const OPEN: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW"];

export const isOverdue = (due: string | null, status: TaskStatus, today: string) => Boolean(due && due < today && OPEN.includes(status));

export function toTaskCard(task: TaskListItem, projectKey: string, today: string): TaskCardData {
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

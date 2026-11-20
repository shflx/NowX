import "server-only";

import { formatDateTime, formatRelative, toDateString } from "@/lib/dates";
import { requirementCode, taskCode } from "@/lib/format";
import { type CurrentUser, isAdmin } from "@/server/auth/dal";
import { appConfig } from "@/server/config";

import type { TaskSheetData } from "./components/task-sheet";
import type { TaskDetail } from "./queries";
import { isOverdue } from "./serialize";
import { BLOCK_COMMENT_PREFIX, blockedDays, blockedLabel } from "./status-flow";

/** 任务详情 → 抽屉组件需要的数据（时间按应用时区格式化） */
export function toTaskSheetData(task: TaskDetail, projectKey: string, today: string, user: CurrentUser): TaskSheetData {
  const due = task.dueDate ? toDateString(task.dueDate) : null;
  const now = new Date();
  const doc = task.requirement?.docs[0];
  return {
    id: task.id,
    number: task.number,
    code: taskCode(projectKey, task.number),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due,
    overdue: isOverdue(due, task.status, today),
    assigneeId: task.assigneeId,
    cycleId: task.cycleId,
    requirementId: task.requirementId,
    carriedFrom: task.carriedFrom?.name ?? null,
    blocked: task.status === "BLOCKED" ? blockedInfo(task, today) : null,
    creatorName: task.creator.name,
    createdAt: formatDateTime(task.createdAt, appConfig.timeZone),
    canDelete: task.creatorId === user.id || isAdmin(user),
    parent: task.parent ? { number: task.parent.number, code: taskCode(projectKey, task.parent.number), title: task.parent.title } : null,
    requirement: task.requirement
      ? {
          number: task.requirement.number,
          code: requirementCode(task.requirement.number),
          title: task.requirement.title,
          doc: doc ? { type: doc.type, name: doc.name, url: doc.url } : null,
        }
      : null,
    subtasks: task.subtasks.map((s) => ({ ...s, code: taskCode(projectKey, s.number) })),
    comments: task.comments.map((c) => ({ id: c.id, body: c.body, author: c.author, time: formatRelative(c.createdAt, appConfig.timeZone, now) })),
    topics: task.topics.map((t) => ({ id: t.id, title: t.title, status: t.status, replies: t._count.replies })),
  };
}

/** 阻塞提示：已阻塞天数，以及评论中最近一次填写的阻塞原因 */
function blockedInfo(task: TaskDetail, today: string) {
  const comment = task.comments.findLast((c) => c.body.startsWith(BLOCK_COMMENT_PREFIX));
  return {
    label: task.blockedAt ? blockedLabel(blockedDays(task.blockedAt, today, appConfig.timeZone)) : "阻塞中",
    reason: comment ? comment.body.slice(BLOCK_COMMENT_PREFIX.length) : null,
  };
}

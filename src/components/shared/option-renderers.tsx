// 常用选项的富文本渲染，供 OptionSelect / SearchSelect 使用
import { PriorityIndicator, TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { canBlock, canChangeStatus } from "@/features/tasks/status-flow";
import { PRIORITY_ORDER, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/constants";

import { NONE, type Option } from "./option-select";

type Person = { id: string; name: string; color: string };

export function memberOptions(members: Person[], none?: string): Option[] {
  const options: Option[] = members.map((m) => ({
    value: m.id,
    label: m.name,
    render: (
      <>
        <UserAvatar user={m} size="sm" />
        {m.name}
      </>
    ),
  }));
  return none ? [{ value: NONE, label: none, render: <span className="text-muted-foreground">{none}</span> }, ...options] : options;
}

/** 任务状态选项；按状态流转规则禁用当前状态不能切换到的目标 */
export function statusOptions(current: TaskStatus): Option[] {
  return (Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => ({
    value: s,
    label: TASK_STATUS_LABEL[s],
    render: <TaskStatusIcon status={s} showLabel />,
    disabled: !(canChangeStatus(current, s) || (s === "BLOCKED" && canBlock(current))),
  }));
}

export function priorityOptions(): Option[] {
  return PRIORITY_ORDER.map((p: TaskPriority) => ({
    value: p,
    label: TASK_PRIORITY_LABEL[p],
    render: <PriorityIndicator priority={p} />,
  }));
}

/** NONE 哨兵值 → null */
export const orNull = (value: string | null | undefined) => (!value || value === NONE ? null : value);

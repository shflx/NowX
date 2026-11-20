import { z } from "zod";

import { TaskPriority, TaskStatus } from "@/generated/prisma/enums";

const optionalId = z.string().min(1).nullable();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式不正确")
  .nullable();

export const taskFieldsSchema = z.object({
  title: z.string().trim().min(1, "请填写任务标题").max(120, "标题不能超过 120 个字"),
  description: z.string().max(10000, "描述太长了").default(""),
  status: z.enum(TaskStatus),
  priority: z.enum(TaskPriority),
  assigneeId: optionalId,
  dueDate: optionalDate,
  cycleId: optionalId,
  requirementId: optionalId,
});

export const createTaskSchema = taskFieldsSchema.partial({ status: true, description: true });

/** 任务详情中逐项修改 */
export const updateTaskSchema = taskFieldsSchema.partial();

export const subtaskSchema = z.object({
  title: z.string().trim().min(1, "请填写子任务标题").max(120, "标题不能超过 120 个字"),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "评论不能为空").max(5000, "评论不能超过 5000 个字"),
});

export type TaskListFilter = {
  /** 周期 ID；all = 全部；backlog = 未规划 */
  cycle: string;
  /** all / me / 用户 ID */
  assignee: string;
  q: string;
};

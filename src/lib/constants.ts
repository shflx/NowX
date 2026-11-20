// 各类枚举的中文文案与展示配置（前后端共用）
import type {
  CycleStatus,
  DocType,
  RequirementStatus,
  TaskPriority,
  TaskStatus,
  TopicStatus,
} from "@/generated/prisma/enums";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "待办",
  IN_PROGRESS: "进行中",
  IN_REVIEW: "评审中",
  DONE: "已完成",
  CANCELED: "已取消",
};

/** 未完成的任务状态：计入周期剩余、逾期判断与顺延（不含已完成、已取消） */
export const OPEN_TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW"];

export const isOpenTask = (status: TaskStatus) => OPEN_TASK_STATUSES.includes(status);

/** 看板列与进度统计使用的状态顺序（不含已取消） */
export const BOARD_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const satisfies TaskStatus[];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  URGENT: "紧急",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

export const PRIORITY_ORDER: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  BACKLOG: "待排期",
  DESIGN: "设计中",
  DEVELOPING: "开发中",
  DELIVERED: "已交付",
};

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  OPEN: "待回答",
  SOLVED: "已解决",
  CLOSED: "已关闭",
};

export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  PLANNED: "计划中",
  ACTIVE: "进行中",
  ENDED: "已结束",
};

/** 外部文档类型：图标字、名称、未填写名称时的默认名 */
export const DOC_TYPE_META: Record<DocType, { mark: string; label: string; defaultName: string }> = {
  FEISHU: { mark: "飞", label: "飞书", defaultName: "飞书文档" },
  TENCENT: { mark: "腾", label: "腾讯文档", defaultName: "腾讯文档" },
  FIGMA: { mark: "F", label: "Figma", defaultName: "Figma 设计稿" },
  APIFOX: { mark: "A", label: "Apifox", defaultName: "接口文档" },
  OTHER: { mark: "链", label: "链接", defaultName: "外部链接" },
};

/** 按链接地址识别文档类型 */
export function detectDocType(url: string): DocType {
  if (/feishu\.cn|feishu\.net|larksuite\.com/i.test(url)) return "FEISHU";
  if (/docs\.qq\.com/i.test(url)) return "TENCENT";
  if (/figma\.com/i.test(url)) return "FIGMA";
  if (/apifox/i.test(url)) return "APIFOX";
  return "OTHER";
}

/** 标签配色：[背景, 文字] */
export const TAG_COLORS = {
  blue: ["#e8f0fd", "#1f5fbf"],
  purple: ["#f0ecfd", "#5b45c9"],
  green: ["#e5f6ee", "#137a52"],
  orange: ["#fdeee6", "#b4501b"],
  pink: ["#fdeaf2", "#b0306a"],
  yellow: ["#fdf5e0", "#8a600b"],
  red: ["#fdeceb", "#c0322f"],
  gray: ["#efeeea", "#57554f"],
} as const;

export type TagColor = keyof typeof TAG_COLORS;
export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as TagColor[];

/** 项目与头像的可选底色 */
export const PROJECT_COLORS = ["#4f46e5", "#0e7fc2", "#138a5e", "#c2410c", "#be185d", "#7c3aed", "#44403c"];
export const AVATAR_COLORS = ["#4f46e5", "#0e7fc2", "#c26a0e", "#138a5e", "#c2410c", "#be185d", "#7c3aed", "#0f766e"];

/** 单个上传文件的大小上限 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

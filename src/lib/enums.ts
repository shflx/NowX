// 数据库枚举（前后端共用）。值与 prisma/schema.prisma 中的 enum 一一对应，修改 schema 时同步更新。

export const UserRole = { ADMIN: "ADMIN", MEMBER: "MEMBER" } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = { ACTIVE: "ACTIVE", DISABLED: "DISABLED" } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const CycleStatus = { PLANNED: "PLANNED", ACTIVE: "ACTIVE", ENDED: "ENDED" } as const;
export type CycleStatus = (typeof CycleStatus)[keyof typeof CycleStatus];

export const RequirementStatus = {
  BACKLOG: "BACKLOG",
  DESIGN: "DESIGN",
  DEVELOPING: "DEVELOPING",
  DELIVERED: "DELIVERED",
} as const;
export type RequirementStatus = (typeof RequirementStatus)[keyof typeof RequirementStatus];

export const DocType = { FEISHU: "FEISHU", TENCENT: "TENCENT", FIGMA: "FIGMA", APIFOX: "APIFOX", OTHER: "OTHER" } as const;
export type DocType = (typeof DocType)[keyof typeof DocType];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
  CANCELED: "CANCELED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = { URGENT: "URGENT", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" } as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TopicStatus = { OPEN: "OPEN", SOLVED: "SOLVED", CLOSED: "CLOSED" } as const;
export type TopicStatus = (typeof TopicStatus)[keyof typeof TopicStatus];

export const MaterialKind = { FILE: "FILE", LINK: "LINK" } as const;
export type MaterialKind = (typeof MaterialKind)[keyof typeof MaterialKind];

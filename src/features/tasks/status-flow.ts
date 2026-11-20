// 任务状态流转规则（前后端共用）：阻塞只能从进行中进入，解除后回到进行中。

import type { TaskStatus } from "@/generated/prisma/enums";

/** 阻塞原因以评论保存，评论正文以该前缀开头，便于识别 */
export const BLOCK_COMMENT_PREFIX = "**标记为阻塞**：";

/** 只有进行中的任务可以标记阻塞 */
export const canBlock = (status: TaskStatus) => status === "IN_PROGRESS";

/**
 * 普通的状态修改（看板拖拽、详情中切换状态）是否允许。
 * 进入阻塞需要填写原因，必须走「标记阻塞」；阻塞中的任务只能恢复为进行中。
 */
export function canChangeStatus(from: TaskStatus, to: TaskStatus) {
  if (from === to) return true;
  if (to === "BLOCKED") return false;
  if (from === "BLOCKED") return to === "IN_PROGRESS";
  return true;
}

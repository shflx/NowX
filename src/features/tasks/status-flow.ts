// 任务状态流转规则（前后端共用）：阻塞只能从进行中进入，解除后回到进行中。

import { diffDays, todayIn } from "@/lib/dates";
import type { TaskStatus } from "@/lib/enums";

/** 标记和解除阻塞都会自动写一条评论，正文以对应前缀开头，便于识别 */
export const BLOCK_COMMENT_PREFIX = "**标记为阻塞**：";
export const UNBLOCK_COMMENT_PREFIX = "**解除阻塞**：";

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

/** 已阻塞的天数（按应用时区的自然日计算，当天进入阻塞为 0） */
export const blockedDays = (blockedAt: Date, today: string, timeZone: string) => diffDays(todayIn(timeZone, blockedAt), today);

export const blockedLabel = (days: number) => (days === 0 ? "今天开始阻塞" : `已阻塞 ${days} 天`);

/** 解除阻塞时评论中的阻塞时长 */
export const unblockSummary = (days: number) => (days === 0 ? "当天即解除" : `共阻塞 ${days} 天`);

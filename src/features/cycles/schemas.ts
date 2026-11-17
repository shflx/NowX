import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式不正确");

export const cycleSchema = z
  .object({
    name: z.string().trim().min(1, "请填写周期名称").max(30, "名称不能超过 30 个字"),
    startDate: dateString,
    endDate: dateString,
    goal: z.string().trim().max(200, "目标不能超过 200 个字").default(""),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "结束日期不能早于开始日期", path: ["endDate"] });

export const endCycleSchema = z.object({
  /** 未完成任务顺延到的周期；为空表示放回待规划 */
  targetCycleId: z.string().nullable(),
  startTarget: z.boolean().default(false),
});

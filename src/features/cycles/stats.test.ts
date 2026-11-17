import { describe, expect, it } from "vitest";

import { behindPlan, burndown, countByStatus, idealRemaining, summarize, timeline } from "./stats";

const at = (s: string) => new Date(`${s}T04:00:00Z`); // 北京时间中午

describe("countByStatus / summarize", () => {
  it("忽略已取消的任务并计算完成率", () => {
    const counts = countByStatus([
      { status: "TODO" },
      { status: "DONE" },
      { status: "DONE" },
      { status: "IN_REVIEW" },
      { status: "CANCELED" },
    ]);
    expect(counts).toEqual({ TODO: 1, IN_PROGRESS: 0, IN_REVIEW: 1, DONE: 2 });
    expect(summarize(counts)).toEqual({ total: 4, done: 2, remaining: 2, percent: 50 });
  });

  it("没有任务时完成率为 0", () => {
    expect(summarize(countByStatus([])).percent).toBe(0);
  });
});

describe("timeline", () => {
  it("计算已进行天数与剩余天数，并限制在周期范围内", () => {
    expect(timeline("2026-11-10", "2026-11-23", "2026-11-17")).toEqual({ days: 14, elapsed: 7, daysLeft: 6 });
    expect(timeline("2026-11-24", "2026-12-07", "2026-11-17")).toEqual({ days: 14, elapsed: 0, daysLeft: 20 });
    expect(timeline("2026-10-27", "2026-11-09", "2026-11-17")).toEqual({ days: 14, elapsed: 13, daysLeft: 0 });
  });
});

describe("idealRemaining / behindPlan", () => {
  it("理想燃尽线从总数线性降到 0", () => {
    expect(idealRemaining(13, 0, 14)).toBe(13);
    expect(idealRemaining(13, 13, 14)).toBe(0);
  });

  it("剩余多于理想值时为正数", () => {
    // 第 8 天理想剩余 round(19 * 6/13) = 9
    expect(behindPlan(19, 10, "2026-11-10", "2026-11-23", "2026-11-17")).toBe(1);
  });
});

describe("burndown", () => {
  const base = { start: "2026-11-10", end: "2026-11-13", timeZone: "Asia/Shanghai" };

  it("按完成日期逐日减少，今天之后没有实际值", () => {
    const points = burndown({
      ...base,
      today: "2026-11-12",
      tasks: [
        { status: "DONE", createdAt: at("2026-11-01"), completedAt: at("2026-11-10") },
        { status: "DONE", createdAt: at("2026-11-01"), completedAt: at("2026-11-12") },
        { status: "TODO", createdAt: at("2026-11-01"), completedAt: null },
      ],
    });
    expect(points.map((p) => p.actual)).toEqual([2, 2, 1, null]);
    expect(points.map((p) => p.ideal)).toEqual([3, 2, 1, 0]);
  });

  it("周期中途新增的任务从创建当天计入", () => {
    const points = burndown({
      ...base,
      today: "2026-11-13",
      tasks: [
        { status: "TODO", createdAt: at("2026-11-01"), completedAt: null },
        { status: "TODO", createdAt: at("2026-11-12"), completedAt: null },
        { status: "CANCELED", createdAt: at("2026-11-01"), completedAt: null },
      ],
    });
    expect(points.map((p) => p.actual)).toEqual([1, 1, 2, 2]);
  });
});

import { describe, expect, it } from "vitest";

import { blockedDays, blockedLabel, canBlock, canChangeStatus, unblockSummary } from "./status-flow";

describe("canBlock", () => {
  it("只有进行中的任务可以标记阻塞", () => {
    expect(canBlock("IN_PROGRESS")).toBe(true);
    expect(canBlock("TODO")).toBe(false);
    expect(canBlock("IN_REVIEW")).toBe(false);
    expect(canBlock("BLOCKED")).toBe(false);
  });
});

describe("canChangeStatus", () => {
  it("普通修改不能直接进入阻塞，需要填写原因", () => {
    expect(canChangeStatus("IN_PROGRESS", "BLOCKED")).toBe(false);
    expect(canChangeStatus("TODO", "BLOCKED")).toBe(false);
  });

  it("阻塞中的任务只能恢复为进行中", () => {
    expect(canChangeStatus("BLOCKED", "IN_PROGRESS")).toBe(true);
    expect(canChangeStatus("BLOCKED", "DONE")).toBe(false);
    expect(canChangeStatus("BLOCKED", "TODO")).toBe(false);
  });

  it("其他状态之间可以自由切换", () => {
    expect(canChangeStatus("TODO", "DONE")).toBe(true);
    expect(canChangeStatus("IN_REVIEW", "IN_PROGRESS")).toBe(true);
    expect(canChangeStatus("BLOCKED", "BLOCKED")).toBe(true);
  });
});

describe("blockedDays / blockedLabel", () => {
  it("按应用时区的自然日计算阻塞天数", () => {
    // 北京时间 11-18 07:00（UTC 11-17 23:00）进入阻塞，到 11-20 为 2 天
    expect(blockedDays(new Date("2026-11-17T23:00:00Z"), "2026-11-20", "Asia/Shanghai")).toBe(2);
    expect(blockedDays(new Date("2026-11-20T01:00:00Z"), "2026-11-20", "Asia/Shanghai")).toBe(0);
  });

  it("当天进入阻塞时单独提示", () => {
    expect(blockedLabel(0)).toBe("今天开始阻塞");
    expect(blockedLabel(3)).toBe("已阻塞 3 天");
  });

  it("解除阻塞时说明阻塞时长", () => {
    expect(unblockSummary(0)).toBe("当天即解除");
    expect(unblockSummary(2)).toBe("共阻塞 2 天");
  });
});

import { describe, expect, it } from "vitest";

import { canBlock, canChangeStatus } from "./status-flow";

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

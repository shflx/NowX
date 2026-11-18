import { describe, expect, it } from "vitest";

import { groupByCycle } from "./grouping";

const cycle = (id: string, status: "PLANNED" | "ACTIVE" | "ENDED", start: string) => ({
  id,
  name: id,
  status,
  startDate: new Date(start),
  endDate: new Date(start),
});

describe("groupByCycle", () => {
  it("按进行中、计划中、待排期、已结束排序，已结束的周期最近的在前", () => {
    const items = [
      { id: 1, cycle: cycle("c1", "ENDED", "2026-10-01") },
      { id: 2, cycle: null },
      { id: 3, cycle: cycle("c4", "PLANNED", "2026-12-01") },
      { id: 4, cycle: cycle("c2", "ENDED", "2026-10-15") },
      { id: 5, cycle: cycle("c3", "ACTIVE", "2026-11-10") },
      { id: 6, cycle: cycle("c5", "PLANNED", "2026-11-24") },
      { id: 7, cycle: cycle("c3", "ACTIVE", "2026-11-10") },
    ];
    expect(groupByCycle(items).map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ["c3", [5, 7]],
      ["c5", [6]],
      ["c4", [3]],
      ["backlog", [2]],
      ["c2", [4]],
      ["c1", [1]],
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { laterThanRequirement, requirementCycle } from "./cycle-hint";
import type { CycleLite } from "./types";

const cycles: CycleLite[] = [
  { id: "c1", name: "第 1 期", status: "ENDED", startDate: "2026-10-27", endDate: "2026-11-09" },
  { id: "c2", name: "第 2 期", status: "ACTIVE", startDate: "2026-11-10", endDate: "2026-11-23" },
  { id: "c3", name: "第 3 期", status: "PLANNED", startDate: "2026-11-24", endDate: "2026-12-07" },
];
const requirements = [
  { id: "r1", number: 1, title: "A", cycleId: "c2" },
  { id: "r2", number: 2, title: "B", cycleId: null },
];

describe("cycle-hint", () => {
  it("找到需求的计划交付周期", () => {
    expect(requirementCycle("r1", requirements, cycles)?.id).toBe("c2");
    expect(requirementCycle("r2", requirements, cycles)).toBeNull();
    expect(requirementCycle(null, requirements, cycles)).toBeNull();
  });

  it("只有任务排在交付周期之后才提示；前置工作放在更早的周期是正常的", () => {
    expect(laterThanRequirement("c3", "r1", requirements, cycles)?.name).toBe("第 2 期");
    expect(laterThanRequirement("c2", "r1", requirements, cycles)).toBeNull();
    expect(laterThanRequirement("c1", "r1", requirements, cycles)).toBeNull();
    expect(laterThanRequirement(null, "r1", requirements, cycles)).toBeNull();
    expect(laterThanRequirement("c3", "r2", requirements, cycles)).toBeNull();
  });
});

// 需求列表按计划交付周期分组（纯函数）
// 排序：进行中 → 计划中（按开始日期）→ 待排期 → 已结束（最近的在前）

type CycleInfo = { id: string; name: string; status: "PLANNED" | "ACTIVE" | "ENDED"; startDate: Date; endDate: Date };

export type RequirementGroup<T> = { key: string; cycle: CycleInfo | null; items: T[] };

const RANK = { ACTIVE: 0, PLANNED: 1, BACKLOG: 2, ENDED: 3 } as const;

export function groupByCycle<T extends { cycle: CycleInfo | null }>(items: T[]): RequirementGroup<T>[] {
  const groups = new Map<string, RequirementGroup<T>>();
  for (const item of items) {
    const key = item.cycle?.id ?? "backlog";
    const group = groups.get(key) ?? { key, cycle: item.cycle, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => {
    const ra = RANK[a.cycle?.status ?? "BACKLOG"];
    const rb = RANK[b.cycle?.status ?? "BACKLOG"];
    if (ra !== rb) return ra - rb;
    if (!a.cycle || !b.cycle) return 0;
    const diff = a.cycle.startDate.getTime() - b.cycle.startDate.getTime();
    return a.cycle.status === "ENDED" ? -diff : diff;
  });
}

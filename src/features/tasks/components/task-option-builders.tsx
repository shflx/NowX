// 任务表单中周期、需求下拉框的选项
import { NONE, type Option } from "@/components/shared/option-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMonthDay } from "@/lib/dates";
import { requirementCode } from "@/lib/format";

import type { CycleLite, RequirementLite } from "./types";

export function cycleOptions(cycles: CycleLite[], noneLabel = "待规划（不放入周期）"): Option[] {
  return [
    { value: NONE, label: noneLabel, render: <span className="text-muted-foreground">{noneLabel}</span> },
    ...cycles
      .filter((c) => c.status !== "ENDED")
      .map((c) => ({
        value: c.id,
        label: c.name,
        render: (
          <>
            {c.name}
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatMonthDay(c.startDate)}–{formatMonthDay(c.endDate)}
            </span>
            {c.status === "ACTIVE" && <StatusBadge tone="accent">进行中</StatusBadge>}
          </>
        ),
      })),
  ];
}

export function requirementOptions(requirements: RequirementLite[]): Option[] {
  return [
    { value: NONE, label: "不关联", render: <span className="text-muted-foreground">不关联（技术任务 / 缺陷）</span> },
    ...requirements.map((r) => ({
      value: r.id,
      label: `${requirementCode(r.number)} ${r.title}`,
      render: (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">{requirementCode(r.number)}</span>
          <span className="truncate">{r.title}</span>
        </>
      ),
    })),
  ];
}

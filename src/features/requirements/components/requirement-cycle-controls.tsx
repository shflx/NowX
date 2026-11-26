import { CalendarRangeIcon, CheckCircle2Icon } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { orNull } from "@/components/shared/option-renderers";
import { NONE, OptionSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cycleOptions } from "@/features/tasks/components/task-option-builders";
import type { CycleLite } from "@/features/tasks/components/types";
import { useAction } from "@/hooks/use-action";

import { moveRequirement, setRequirementStatus } from "../actions";

type MoveProps = {
  requirement: { id: string; code: string; cycleId: string | null; cycleName: string | null };
  cycles: CycleLite[];
  /** 需求在当前周期中未完成的顶层任务数 */
  unfinishedInCycle: number;
};

/** 调整需求的计划交付周期，默认同时移动其在当前周期中未完成的任务 */
export function MoveRequirementButton({ requirement, cycles, unfinishedInCycle }: MoveProps) {
  const [open, setOpen] = useState(false);
  const candidates = cycles.filter((c) => c.status !== "ENDED" && c.id !== requirement.cycleId);
  const [target, setTarget] = useState(candidates[0]?.id ?? NONE);
  const [moveTasks, setMoveTasks] = useState(true);

  const move = useAction(moveRequirement.bind(null, requirement.id), {
    successMessage: ({ moved, targetName }) =>
      `${requirement.code} 已${targetName ? `排入「${targetName}」` : "移回待排期"}${moved ? `，${moved} 个任务一起移动` : ""}`,
    onSuccess: () => setOpen(false),
  });

  const options = cycleOptions(candidates, "待排期").filter((o) => o.value !== NONE || requirement.cycleId);
  const from = requirement.cycleName ?? "待排期";

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarRangeIcon />
        {requirement.cycleId ? "调整周期" : "排入周期"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{requirement.cycleId ? "调整计划交付周期" : "排入周期"}</DialogTitle>
            <DialogDescription>当前：{from}</DialogDescription>
          </DialogHeader>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有可选的周期，请先在周期页新建一个计划中的周期。</p>
          ) : (
            <div className="flex flex-col gap-4">
              <FormField label="移动到">
                <OptionSelect options={options} value={target} onValueChange={setTarget} className="w-full" />
              </FormField>
              {unfinishedInCycle > 0 && (
                <div className="flex items-start gap-2">
                  <Checkbox id="move-tasks" checked={moveTasks} onCheckedChange={(c) => setMoveTasks(c === true)} className="mt-0.5" />
                  <Label htmlFor="move-tasks" className="font-normal leading-relaxed">
                    同时移动「{from}」中 {unfinishedInCycle} 个未完成的任务（含子任务）；已完成的任务保留在原周期
                  </Label>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button disabled={move.pending || options.length === 0} onClick={() => move.run({ cycleId: orNull(target), moveTasks })}>
              {move.pending && <Spinner />}
              移动
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 任务全部完成但需求尚未标记交付时的提示（状态不自动修改，交付通常还需要验收） */
export function DeliveredHint({ requirementId }: { requirementId: string }) {
  const mark = useAction(setRequirementStatus.bind(null, requirementId), { successMessage: "已标记为已交付" });
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-ok/20 bg-ok-soft px-3.5 py-2.5 text-sm text-ok">
      <CheckCircle2Icon className="size-4 shrink-0" />
      <span className="flex-1">拆解出的任务已全部完成，验收通过后可以把需求标记为已交付。</span>
      <Button size="sm" disabled={mark.pending} onClick={() => mark.run("DELIVERED")}>
        标记为已交付
      </Button>
    </div>
  );
}

import { CheckCircle2Icon } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { orNull } from "@/components/shared/option-renderers";
import { NONE, OptionSelect } from "@/components/shared/option-select";
import { TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { formatMonthDay } from "@/lib/dates";
import type { TaskStatus } from "@/lib/enums";

import { endCycle } from "../actions";

export type UndeliveredRequirement = {
  id: string;
  code: string;
  title: string;
  /** 拆解出的任务已全部完成，只是还没标记交付 */
  allTasksDone: boolean;
};

type Props = {
  cycle: { id: string; name: string };
  requirements: UndeliveredRequirement[];
  unfinished: { id: string; code: string; title: string; status: TaskStatus; assignee: { name: string; color: string } | null }[];
  planned: { id: string; name: string; startDate: string; endDate: string }[];
  onClose: () => void;
};

/**
 * 结束周期：先决定未交付的需求是否随周期顺延，再处理未完成的任务（全部移出）。
 * 任务已全部完成的需求默认不顺延，通常只是还没标记交付。
 */
export function EndCycleDialog({ cycle, requirements, unfinished, planned, onClose }: Props) {
  const [target, setTarget] = useState(planned[0]?.id ?? NONE);
  const [startTarget, setStartTarget] = useState(true);
  const [carry, setCarry] = useState(() => requirements.filter((r) => !r.allTasksDone).map((r) => r.id));

  const end = useAction(endCycle.bind(null, cycle.id), {
    successMessage: ({ moved, movedRequirements, targetName, started }) => {
      const dest = targetName ? `顺延到「${targetName}」` : "移入待排期";
      const parts = [movedRequirements && `${movedRequirements} 条需求`, moved && `${moved} 个任务`].filter(Boolean);
      return `「${cycle.name}」已结束${parts.length ? `，${parts.join("、")}${dest}` : ""}${started ? `；「${targetName}」已开始` : ""}`;
    },
    onSuccess: onClose,
  });

  const targetId = orNull(target);
  const targetName = planned.find((p) => p.id === targetId)?.name;
  const nothingLeft = requirements.length === 0 && unfinished.length === 0;
  const toggle = (id: string, on: boolean) => setCarry((ids) => (on ? [...ids, id] : ids.filter((v) => v !== id)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>结束「{cycle.name}」</DialogTitle>
        </DialogHeader>

        {nothingLeft ? (
          <div className="flex items-start gap-2 rounded-md bg-ok-soft px-3 py-2.5 text-sm text-ok">
            <CheckCircle2Icon className="mt-0.5 size-4" />
            需求都已交付、任务都已完成，可以放心结束这个周期。
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {requirements.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-sm font-medium">未交付的需求 {requirements.length} 条</h3>
                <p className="mb-2 text-xs text-muted-foreground">勾选的需求随周期顺延；不勾选则留在本周期（例如只差验收的需求）。</p>
                <ul className="rounded-md border px-3">
                  {requirements.map((r) => (
                    <li key={r.id} className="border-b py-2 last:border-0">
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                        <Checkbox checked={carry.includes(r.id)} onCheckedChange={(c) => toggle(r.id, c === true)} />
                        <span className="text-xs text-muted-foreground tabular-nums">{r.code}</span>
                        <span className="flex-1 truncate">{r.title}</span>
                        {r.allTasksDone && <span className="shrink-0 text-xs text-ok">任务已全部完成，可去标记交付</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {unfinished.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-sm font-medium">未完成的任务 {unfinished.length} 个</h3>
                <p className="mb-2 text-xs text-muted-foreground">任务会全部移出本周期（含子任务），避免遗留在已结束的周期里。</p>
                <ul className="max-h-48 overflow-y-auto rounded-md border px-3">
                  {unfinished.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 border-b py-2 text-sm last:border-0">
                      <TaskStatusIcon status={t.status} />
                      <span className="text-xs text-muted-foreground tabular-nums">{t.code}</span>
                      <span className="flex-1 truncate">{t.title}</span>
                      {t.assignee && <UserAvatar user={t.assignee} size="sm" />}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <FormField label="顺延到">
              <OptionSelect
                value={target}
                onValueChange={setTarget}
                className="w-full"
                options={[
                  ...planned.map((p) => ({
                    value: p.id,
                    label: p.name,
                    render: (
                      <>
                        {p.name}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatMonthDay(p.startDate)}–{formatMonthDay(p.endDate)}
                        </span>
                      </>
                    ),
                  })),
                  { value: NONE, label: "不放入任何周期（待排期 / 待规划）" },
                ]}
              />
            </FormField>
          </div>
        )}

        {targetId ? (
          <div className="flex items-center gap-2">
            <Checkbox id="start-target" checked={startTarget} onCheckedChange={(c) => setStartTarget(c === true)} />
            <Label htmlFor="start-target">同时开始「{targetName}」</Label>
          </div>
        ) : (
          planned.length === 0 && <p className="text-xs text-muted-foreground">还没有计划中的周期，可以结束后再新建。</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={end.pending}
            onClick={() => end.run({ targetCycleId: targetId, startTarget: Boolean(targetId) && startTarget, requirementIds: carry })}
          >
            {end.pending && <Spinner />}
            结束周期
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

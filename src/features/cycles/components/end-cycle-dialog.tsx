"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { NONE, OptionSelect } from "@/components/shared/option-select";
import { orNull } from "@/components/shared/option-renderers";
import { TaskStatusIcon } from "@/components/shared/task-status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { useAction } from "@/hooks/use-action";
import { formatMonthDay } from "@/lib/dates";

import { endCycle } from "../actions";

type Props = {
  cycle: { id: string; name: string };
  unfinished: { id: string; code: string; title: string; status: TaskStatus; assignee: { name: string; color: string } | null }[];
  planned: { id: string; name: string; startDate: string; endDate: string }[];
  onClose: () => void;
};

export function EndCycleDialog({ cycle, unfinished, planned, onClose }: Props) {
  const [target, setTarget] = useState(planned[0]?.id ?? NONE);
  const [startTarget, setStartTarget] = useState(true);

  const end = useAction(endCycle.bind(null, cycle.id), {
    successMessage: ({ moved, targetName, started }) =>
      `「${cycle.name}」已结束${moved ? `，${moved} 个任务${targetName ? `顺延到「${targetName}」` : "移入待规划"}` : ""}${started ? `；「${targetName}」已开始` : ""}`,
    onSuccess: onClose,
  });

  const targetId = orNull(target);
  const targetName = planned.find((p) => p.id === targetId)?.name;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>结束「{cycle.name}」</DialogTitle>
        </DialogHeader>
        {unfinished.length ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              还有 <b>{unfinished.length}</b> 个未完成任务（含其子任务），结束后将一并移动：
            </p>
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
                  { value: NONE, label: "不放入任何周期（待规划）" },
                ]}
              />
            </FormField>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md bg-ok-soft px-3 py-2.5 text-sm text-ok">
            <CheckCircle2Icon className="mt-0.5 size-4" />
            所有任务都已完成，可以放心结束这个周期。
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
          <Button disabled={end.pending} onClick={() => end.run({ targetCycleId: targetId, startTarget: Boolean(targetId) && startTarget })}>
            {end.pending && <Spinner />}
            结束周期
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

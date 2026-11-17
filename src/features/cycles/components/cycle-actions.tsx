"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmButton } from "@/components/shared/confirm-button";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/generated/prisma/enums";
import { useAction } from "@/hooks/use-action";

import { deleteCycle, startCycle } from "../actions";
import { CycleFormDialog } from "./cycle-form-dialog";
import { EndCycleDialog } from "./end-cycle-dialog";

type CycleLite = { id: string; name: string; startDate: string; endDate: string; goal: string; status: string };

type NewCycleProps = { projectId: string; cycles: CycleLite[]; defaultStart: string };

/** 页头的「新建周期」按钮 */
export function NewCycleButton({ projectId, cycles, defaultStart }: NewCycleProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        新建周期
      </Button>
      {open && (
        <CycleFormDialog
          projectId={projectId}
          existing={cycles}
          defaultName={`第 ${cycles.length + 1} 期`}
          defaultStart={defaultStart}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

type CycleActionsProps = {
  projectId: string;
  cycle: CycleLite;
  cycles: CycleLite[];
  unfinished: { id: string; code: string; title: string; status: TaskStatus; assignee: { name: string; color: string } | null }[];
};

/** 周期详情右上角的操作：编辑 / 删除 / 开始 / 结束 */
export function CycleActions({ projectId, cycle, cycles, unfinished }: CycleActionsProps) {
  const [editing, setEditing] = useState(false);
  const [ending, setEnding] = useState(false);
  const start = useAction(startCycle, { successMessage: `「${cycle.name}」已开始` });
  const remove = useAction(deleteCycle, { successMessage: "周期已删除" });

  return (
    <div className="flex items-center gap-1.5">
      {cycle.status !== "ENDED" && (
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon />
          编辑
        </Button>
      )}
      {cycle.status === "PLANNED" && (
        <>
          <ConfirmButton
            trigger={
              <Button variant="ghost" size="sm">
                <Trash2Icon />
                删除
              </Button>
            }
            title={`删除「${cycle.name}」？`}
            description="周期中的任务不会被删除，会回到待规划状态。"
            confirmLabel="删除"
            destructive
            onConfirm={() => remove.run(cycle.id)}
          />
          <Button disabled={start.pending} onClick={() => start.run(cycle.id)}>
            开始周期
          </Button>
        </>
      )}
      {cycle.status === "ACTIVE" && (
        <Button variant="outline" onClick={() => setEnding(true)}>
          结束周期
        </Button>
      )}

      {editing && (
        <CycleFormDialog
          projectId={projectId}
          cycle={cycle}
          existing={cycles}
          defaultName={cycle.name}
          defaultStart={cycle.startDate}
          onClose={() => setEditing(false)}
        />
      )}
      {ending && (
        <EndCycleDialog
          cycle={cycle}
          unfinished={unfinished}
          planned={cycles.filter((c) => c.status === "PLANNED")}
          onClose={() => setEnding(false)}
        />
      )}
    </div>
  );
}

"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { memberOptions, orNull, priorityOptions } from "@/components/shared/option-renderers";
import { NONE, OptionSelect, SearchSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

import { createTask } from "../actions";
import { laterThanRequirement, requirementCycle } from "./cycle-hint";
import { cycleOptions, requirementOptions } from "./task-option-builders";
import type { TaskFormOptions } from "./types";

/** 已结束的周期不能再放入新任务 */
const plannable = <T extends { status: string }>(cycle: T | null) => (cycle && cycle.status !== "ENDED" ? cycle : null);

type Props = TaskFormOptions & {
  currentUserId: string;
  defaultRequirementId?: string;
  /** 创建后打开任务详情 */
  openAfterCreate?: boolean;
  onClose: () => void;
};

export function TaskFormDialog({ projectId, projectKey, members, cycles, requirements, currentUserId, defaultRequirementId, openAfterCreate, onClose }: Props) {
  const router = useRouter();
  const active = cycles.find((c) => c.status === "ACTIVE");
  // 默认周期：需求的计划交付周期（未结束时），否则为进行中的周期
  const initialCycle = plannable(requirementCycle(defaultRequirementId ?? null, requirements, cycles)) ?? active;
  const [requirementId, setRequirementId] = useState(defaultRequirementId ?? NONE);
  const [cycleId, setCycleId] = useState(initialCycle?.id ?? NONE);
  const [assigneeId, setAssigneeId] = useState(members.some((m) => m.id === currentUserId) ? currentUserId : NONE);
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState(initialCycle?.endDate ?? "");
  const late = laterThanRequirement(orNull(cycleId), orNull(requirementId), requirements, cycles);

  const create = useAction(createTask.bind(null, projectId), {
    successMessage: ({ code }) => `已创建 ${code}`,
    onSuccess: ({ number }) => {
      onClose();
      if (openAfterCreate) router.push(`/projects/${projectKey}/tasks?task=${number}`);
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.run({
      title: form.get("title"),
      description: form.get("description"),
      priority,
      assigneeId: orNull(assigneeId),
      cycleId: orNull(cycleId),
      requirementId: orNull(requirementId),
      dueDate: dueDate || null,
    });
  }

  // 切换周期时，截止日期默认跟随周期结束日
  // 选择需求后，周期跟随需求的计划交付周期
  function changeRequirement(id: string) {
    setRequirementId(id);
    const target = plannable(requirementCycle(orNull(id), requirements, cycles));
    if (target) changeCycle(target.id);
  }

  function changeCycle(id: string) {
    setCycleId(id);
    const cycle = cycles.find((c) => c.id === id);
    if (cycle) setDueDate(cycle.endDate);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>
        <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="标题" htmlFor="task-title" error={create.fieldErrors.title}>
            <Input id="task-title" name="title" placeholder="例如：客户导入：重复客户合并策略" autoFocus />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="来源需求">
              <SearchSelect options={requirementOptions(requirements)} value={requirementId} onValueChange={changeRequirement} />
            </FormField>
            <FormField label="周期" description={late && <span className="text-warn">晚于需求的计划交付周期「{late.name}」，可能赶不上交付</span>}>
              <OptionSelect options={cycleOptions(cycles)} value={cycleId} onValueChange={changeCycle} className="w-full" />
            </FormField>
            <FormField label="负责人">
              <OptionSelect options={memberOptions(members, "暂不指派")} value={assigneeId} onValueChange={setAssigneeId} className="w-full" />
            </FormField>
            <FormField label="优先级">
              <OptionSelect options={priorityOptions()} value={priority} onValueChange={setPriority} className="w-full" />
            </FormField>
            <FormField label="截止日期" htmlFor="task-due" error={create.fieldErrors.dueDate}>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
          </div>
          <FormField label="描述" htmlFor="task-desc" error={create.fieldErrors.description}>
            <Textarea id="task-desc" name="description" rows={4} placeholder="支持 Markdown" />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="task-form" disabled={create.pending}>
            {create.pending && <Spinner />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 「新建任务 / 拆解任务」按钮 */
export function NewTaskButton({ label = "新建任务", ...props }: Omit<Props, "onClose"> & { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        {label}
      </Button>
      {open && <TaskFormDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/hooks/use-action";
import { addDays, addOneMonth, diffDays, formatMonthDay } from "@/lib/dates";
import { useRouter } from "@/lib/navigation";

import { createCycle, updateCycle } from "../actions";

type CycleLite = { id: string; name: string; startDate: string; endDate: string; goal?: string };
type Length = "two-weeks" | "month" | "custom";

type Props = {
  projectId: string;
  /** 编辑时传入 */
  cycle?: CycleLite;
  existing: CycleLite[];
  defaultName: string;
  defaultStart: string;
  onClose: () => void;
};

function endFor(start: string, length: Length, current: string) {
  if (length === "two-weeks") return addDays(start, 13);
  if (length === "month") return addOneMonth(start);
  return current;
}

export function CycleFormDialog({ projectId, cycle, existing, defaultName, defaultStart, onClose }: Props) {
  const router = useRouter();
  const [length, setLength] = useState<Length>(cycle ? "custom" : "two-weeks");
  const [start, setStart] = useState(cycle?.startDate ?? defaultStart);
  const [end, setEnd] = useState(cycle?.endDate ?? addDays(defaultStart, 13));

  const create = useAction(createCycle.bind(null, projectId), {
    successMessage: "周期已创建",
    onSuccess: ({ id }) => {
      onClose();
      router.push(`?cycle=${id}`, { scroll: false });
    },
  });
  const update = useAction(updateCycle.bind(null, cycle?.id ?? ""), { successMessage: "已保存", onSuccess: onClose });
  const { pending, fieldErrors } = cycle ? update : create;

  const clash = existing.find((c) => c.id !== cycle?.id && start <= c.endDate && end >= c.startDate);
  const invalid = end < start;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { name: form.get("name"), goal: form.get("goal"), startDate: start, endDate: end };
    if (cycle) update.run(input);
    else create.run(input);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cycle ? "编辑周期" : "新建周期"}</DialogTitle>
          {!cycle && <DialogDescription>新周期创建后为「计划中」，可以先往里放任务，到时间再点「开始周期」。</DialogDescription>}
        </DialogHeader>
        <form id="cycle-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="名称" htmlFor="cycle-name" error={fieldErrors.name}>
            <Input id="cycle-name" name="name" defaultValue={cycle?.name ?? defaultName} />
          </FormField>
          <FormField label="周期长度">
            <ToggleGroup
              type="single"
              variant="outline"
              value={length}
              onValueChange={(v: Length) => {
                if (!v) return;
                setLength(v);
                setEnd(endFor(start, v, end));
              }}
              className="w-fit"
            >
              <ToggleGroupItem value="two-weeks">两周</ToggleGroupItem>
              <ToggleGroupItem value="month">一个月</ToggleGroupItem>
              <ToggleGroupItem value="custom">自定义</ToggleGroupItem>
            </ToggleGroup>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="开始日期" htmlFor="cycle-start" error={fieldErrors.startDate}>
              <Input
                id="cycle-start"
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setEnd(endFor(e.target.value, length, end));
                }}
                required
              />
            </FormField>
            <FormField label="结束日期" htmlFor="cycle-end" error={fieldErrors.endDate}>
              <Input
                id="cycle-end"
                type="date"
                value={end}
                onChange={(e) => {
                  setLength("custom");
                  setEnd(e.target.value);
                }}
                required
              />
            </FormField>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
            {invalid ? (
              <span className="text-destructive">结束日期不能早于开始日期</span>
            ) : (
              <>
                共 {diffDays(start, end) + 1} 天
                {clash && (
                  <span className="text-destructive">
                    {" "}
                    · 与「{clash.name}」（{formatMonthDay(clash.startDate)}–{formatMonthDay(clash.endDate)}）时间重叠
                  </span>
                )}
              </>
            )}
          </p>
          <FormField label="周期目标（可选）" htmlFor="cycle-goal" error={fieldErrors.goal}>
            <Textarea id="cycle-goal" name="goal" defaultValue={cycle?.goal} rows={2} placeholder="例如：客户导入功能上线；销售漏斗联调" />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="cycle-form" disabled={pending || invalid || Boolean(clash)}>
            {pending && <Spinner />}
            {cycle ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

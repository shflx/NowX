import { useState } from "react";

import { ColorSwatches } from "@/components/shared/color-swatches";
import { FormField } from "@/components/shared/form-field";
import { UserChecklist } from "@/components/shared/user-checklist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { PROJECT_COLORS } from "@/lib/constants";
import { useRouter } from "@/lib/navigation";
import { routes } from "@/lib/routes";

import { createProject } from "../actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 创建者本人（固定为成员） */
  currentUserId: string;
  /** 可选的成员（全部正常状态的账号） */
  directory: { id: string; name: string; title: string; color: string }[];
};

export function CreateProjectDialog({ open, onOpenChange, currentUserId, directory }: Props) {
  const router = useRouter();
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const { run, pending, fieldErrors } = useAction(createProject, {
    successMessage: "项目已创建，先新建一个周期吧",
    onSuccess: ({ key }) => {
      onOpenChange(false);
      router.push(routes.cycles(key));
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run({ name: form.get("name"), key: form.get("key"), description: form.get("description"), color, memberIds });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
        </DialogHeader>
        <form id="create-project" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <FormField label="项目名称" htmlFor="project-name" error={fieldErrors.name}>
              <Input id="project-name" name="name" placeholder="例如：数据中台" autoFocus />
            </FormField>
            <FormField label="编号前缀" htmlFor="project-key" error={fieldErrors.key}>
              <Input id="project-key" name="key" placeholder="如 DATA" maxLength={6} className="uppercase" autoComplete="off" />
            </FormField>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            编号前缀用于任务编号（如 DATA-1、DATA-2），2–6 个英文字母，创建后不可修改。
          </p>
          <FormField label="描述（可选）" htmlFor="project-desc" error={fieldErrors.description}>
            <Input id="project-desc" name="description" placeholder="一句话说明项目目标" />
          </FormField>
          <FormField label="颜色">
            <ColorSwatches colors={PROJECT_COLORS} value={color} onChange={setColor} />
          </FormField>
          <FormField label="成员" description="之后也可以在项目设置中调整">
            <UserChecklist users={directory} value={memberIds} onChange={setMemberIds} lockedIds={[currentUserId]} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" form="create-project" disabled={pending}>
            {pending && <Spinner />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

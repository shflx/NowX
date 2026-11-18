"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { deleteProject } from "../actions";

type Props = {
  project: { id: string; key: string; name: string };
  /** 删除前展示给管理员的数据规模，帮助判断影响 */
  summary?: string;
  /** 删除后跳转的地址（在项目内部删除时需要离开当前项目） */
  redirectTo?: string;
  trigger?: ReactNode;
};

/** 删除项目：需要输入编号前缀确认，防止误删 */
export function DeleteProjectButton({ project, summary, redirectTo, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmKey, setConfirmKey] = useState("");
  const remove = useAction(deleteProject.bind(null, project.id), {
    successMessage: ({ name }) => `项目「${name}」已删除`,
    onSuccess: () => {
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
    },
  });

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="destructive">
            <Trash2Icon />
            删除项目
          </Button>
        )}
      </span>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmKey("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除项目「{project.name}」？</DialogTitle>
            <DialogDescription>
              项目下的周期、需求、任务、交流区帖子、材料文件和公告会被<b className="text-destructive">永久删除，无法恢复</b>。
              {summary && <>（{summary}）</>}如果只是暂时不用，建议改为归档。
            </DialogDescription>
          </DialogHeader>
          <FormField label={<>请输入编号前缀 <b className="font-mono">{project.key}</b> 确认</>} htmlFor="confirm-key" error={remove.fieldErrors.confirmKey}>
            <Input id="confirm-key" value={confirmKey} onChange={(e) => setConfirmKey(e.target.value)} autoComplete="off" className="font-mono uppercase" />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={remove.pending || confirmKey.trim().toUpperCase() !== project.key}
              onClick={() => remove.run(confirmKey)}
            >
              {remove.pending && <Spinner />}
              永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
